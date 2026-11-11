import { isFinalStatus, submitIntentOnce, waitForStatus } from "@/lib/server/near/agent-api";
import { getRouter, updateRouter } from "@/lib/server/db";
import { prepareGrant, STILL_CONFIRMING } from "@/lib/server/near/grant";
import { errorResponse } from "@/lib/server/http";
import { seal } from "@/lib/server/seal";
import { isOwner } from "@/lib/server/auth/session";

// Owner renews the split engine's permission (grant) before it lapses. Two calls, like setup:
//  { step: "start" }                              -> a fresh grant intent for the owner's passkey
//  { step: "sign", correlation_id, signed_data }  -> submitted; the new token replaces the old
//                                                    one only once NEAR confirms it.
// The old grant simply lapses at its own expiry date.
export async function POST(request: Request, ctx: RouteContext<"/api/dashboard/[handle]/grant">) {
  try {
    const { handle } = await ctx.params;
    if (!(await isOwner(handle))) return Response.json({ error: "Sign in with your passkey." }, { status: 401 });
    const router = getRouter(handle);
    if (!router || router.status !== "active" || !router.agent_id) return Response.json({ error: "Not found." }, { status: 404 });
    const body = await request.json().catch(() => ({}));

    if (body.step === "start") {
      const grant = await prepareGrant(router.agent_id);
      updateRouter(handle, {
        setup: { renew: grant.intent.correlation_id, renew_grant: seal(grant.token), renew_expires_at: grant.expiresAt },
      });
      return Response.json({ correlation_id: grant.intent.correlation_id, intent: grant.intent.intent, summary: grant.intent.preview?.summary, expiresAt: grant.expiresAt });
    }

    if (body.step === "sign") {
      const pending = router.setup;
      if (!pending?.renew || pending.renew !== body.correlation_id) return Response.json({ error: "This renewal expired. Start it again." }, { status: 409 });
      await submitIntentOnce("grant_issue", pending.renew, body.signed_data);
      const final = await waitForStatus(pending.renew);
      if (!isFinalStatus(final.status)) return Response.json({ error: STILL_CONFIRMING }, { status: 503 });
      if (final.status !== "SUCCESS") return Response.json({ error: `Renewal failed: ${final.failure_code ?? final.status}` }, { status: 502 });
      updateRouter(handle, { grant_sealed: pending.renew_grant, grant_expires_at: pending.renew_expires_at, setup: null });
      return Response.json({ ok: true, expiresAt: pending.renew_expires_at });
    }

    return Response.json({ error: "Unknown step." }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
