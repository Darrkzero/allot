import { getAgent, isFinalStatus, submitIntentOnce, waitForStatus } from "@/lib/server/near/agent-api";
import { getRouter, updateRouter } from "@/lib/server/db";
import { prepareGrant, STILL_CONFIRMING } from "@/lib/server/near/grant";
import { errorResponse, readJson } from "@/lib/server/http";
import { rateLimit } from "@/lib/server/rate-limit";
import { seal } from "@/lib/server/seal";

// Steps 2 and 3 of setup: the owner's passkey signatures come back here.
//  step "create": agent + policy are created -> we return the grant intent to sign next.
//  step "grant":  the split engine gets permission to act inside the policy -> router is live.
export async function POST(request: Request, ctx: RouteContext<"/api/routers/[handle]/sign">) {
  const limited = rateLimit(request, "setup-sign", 30, 10 * 60_000);
  if (limited) return limited;
  try {
    const { handle } = await ctx.params;
    const body = await readJson(request);
    const step = String(body.step ?? "");
    const correlation_id = String(body.correlation_id ?? "");
    const signed_data = body.signed_data;
    const router = getRouter(handle);
    if (!router || !router.agent_id) return Response.json({ error: "Setup not found. Start again." }, { status: 404 });
    if (router.setup?.[step] !== correlation_id) return Response.json({ error: "This signature doesn't match the current setup step." }, { status: 409 });

    if (step === "create" && router.status === "pending_create") {
      // Safe to retry: a signature that already landed isn't resubmitted, we just pick up its result.
      await submitIntentOnce("agent_create", correlation_id, signed_data);
      const final = await waitForStatus(correlation_id);
      if (!isFinalStatus(final.status)) return Response.json({ error: STILL_CONFIRMING }, { status: 503 });
      if (final.status !== "SUCCESS") return Response.json({ error: `Creating your wallet failed: ${final.failure_code ?? final.status}` }, { status: 502 });

      const agent = await getAgent(router.agent_id);
      const grant = await prepareGrant(router.agent_id);
      updateRouter(handle, {
        intents_account: agent.wallet?.near_account_id ?? null,
        grant_sealed: seal(grant.token),
        grant_expires_at: grant.expiresAt,
        setup: { ...router.setup, grant: grant.intent.correlation_id },
        status: "pending_grant",
      });
      return Response.json({ step: "grant", correlation_id: grant.intent.correlation_id, intent: grant.intent.intent, summary: grant.intent.preview?.summary });
    }

    if (step === "grant" && router.status === "pending_grant") {
      await submitIntentOnce("grant_issue", correlation_id, signed_data);
      const final = await waitForStatus(correlation_id);
      if (!isFinalStatus(final.status)) return Response.json({ error: STILL_CONFIRMING }, { status: 503 });
      if (final.status !== "SUCCESS") return Response.json({ error: `Activating auto-split failed: ${final.failure_code ?? final.status}` }, { status: 502 });
      updateRouter(handle, { status: "active", setup: null });
      return Response.json({ step: "done", handle });
    }

    return Response.json({ error: `Unexpected step "${step}" for status ${router.status}.` }, { status: 409 });
  } catch (e) {
    return errorResponse(e);
  }
}
