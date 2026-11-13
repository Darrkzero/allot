import { rateLimit } from "@/lib/server/rate-limit";
import { generateIntent, type PasskeyOwner } from "@/lib/server/near/agent-api";
import { deletePendingRouter, getRouter, insertRouter } from "@/lib/server/db";
import { policyFromRules } from "@/lib/server/near/policy";
import { HANDLE_RE, validateRules } from "@/lib/rules";
import { errorResponse, readJson } from "@/lib/server/http";

const SETUP_HOLD_MS = 15 * 60_000;

// Step 1 of setup: the recipient submits name, handle, rules and their new passkey.
// We build the destination-locked policy and return the intent their passkey must sign.
export async function POST(request: Request) {
  const limited = rateLimit(request, "create-link", 10, 10 * 60_000); // link setups per IP
  if (limited) return limited;
  try {
    const body = await readJson(request);
    const handle = String(body.handle ?? "").trim().toLowerCase();
    const name = String(body.name ?? "").trim();
    if (!HANDLE_RE.test(handle)) return Response.json({ error: "Your link name needs 3 to 30 lowercase letters, numbers or dashes (it can't start or end with a dash)." }, { status: 400 });
    if (!name || name.length > 60) return Response.json({ error: "Add your name (up to 60 characters). It's shown to people who pay you." }, { status: 400 });

    const checked = validateRules(body.rules);
    if (!checked.ok) return Response.json({ error: checked.errors.join(" ") }, { status: 400 });

    const owner = body.owner as PasskeyOwner;
    const str = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 512;
    if (owner?.type !== "passkey" || !str(owner.credential_id) || !str(owner.public_key) || !str(owner.rp_id) || !str(owner.origin)) {
      return Response.json({ error: "Your passkey wasn't set up properly. Please try again." }, { status: 400 });
    }

    const existing = getRouter(handle);
    if (existing?.status === "active") return Response.json({ error: "That link name is already taken. Try another one." }, { status: 409 });
    // Someone mid-setup whose wallet already exists can't be bumped off their handle by a stranger:
    // only the same passkey can restart it, or anyone once it has been abandoned for 15 minutes.
    if (
      existing?.status === "pending_grant" &&
      existing.owner.credential_id !== owner.credential_id &&
      Date.now() - Date.parse(existing.created_at) < SETUP_HOLD_MS
    ) {
      return Response.json({ error: "Someone is setting up that link name right now. Pick another, or try again in 15 minutes." }, { status: 409 });
    }
    if (existing) deletePendingRouter(handle);

    const policy = await policyFromRules(checked.rules);
    const intent = await generateIntent({
      type: "agent_create",
      name: `allot:${handle}`,
      external_user_id: handle,
      owner: {
        type: "passkey",
        credential_id: owner.credential_id,
        public_key: owner.public_key,
        rp_id: owner.rp_id,
        origin: owner.origin,
      },
      policy,
    });

    insertRouter({
      handle,
      name,
      rules: checked.rules,
      owner,
      agent_id: intent.agent_id,
      setup: { create: intent.correlation_id },
    });

    return Response.json({ step: "create", correlation_id: intent.correlation_id, intent: intent.intent, summary: intent.preview?.summary, policy });
  } catch (e) {
    return errorResponse(e);
  }
}
