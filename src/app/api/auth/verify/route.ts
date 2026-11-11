import { rateLimit } from "@/lib/server/rate-limit";
import { getRouter, takeChallenge } from "@/lib/server/db";
import { startSession } from "@/lib/server/auth/session";
import { verifyAssertion } from "@/lib/server/auth/webauthn";

// Dashboard sign-in, step 2: verify the passkey signature, then issue an owner session cookie.
export async function POST(request: Request) {
  const limited = rateLimit(request, "auth-verify", 20, 60_000);
  if (limited) return limited;
  const { handle, challengeId, credential } = await request.json().catch(() => ({}));
  const router = typeof handle === "string" ? getRouter(handle) : null;
  if (!router || router.status !== "active") return Response.json({ error: "No active link with that handle." }, { status: 404 });

  const challenge = typeof challengeId === "string" ? takeChallenge(challengeId, router.handle) : null;
  if (!challenge) return Response.json({ error: "Sign-in expired. Try again." }, { status: 400 });

  const result = verifyAssertion(credential, {
    challenge,
    origin: router.owner.origin,
    rpId: router.owner.rp_id,
    credentialId: router.owner.credential_id,
    publicKeySpki: router.owner.public_key,
  });
  if (!result.ok) return Response.json({ error: result.reason }, { status: 401 });

  await startSession(router.handle);
  return Response.json({ ok: true });
}
