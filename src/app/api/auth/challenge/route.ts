import { rateLimit } from "@/lib/server/rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { createChallenge, getRouter } from "@/lib/server/db";

// Dashboard sign-in, step 1: a one-time challenge for this link's passkey to sign.
export async function POST(request: Request) {
  const limited = rateLimit(request, "auth-challenge", 20, 60_000);
  if (limited) return limited;
  const { handle } = await request.json().catch(() => ({}));
  const router = typeof handle === "string" ? getRouter(handle) : null;
  if (!router || router.status !== "active") return Response.json({ error: "No active link with that handle." }, { status: 404 });
  const id = randomUUID();
  const challenge = randomBytes(32).toString("base64url");
  createChallenge(router.handle, id, challenge);
  return Response.json({ challengeId: id, challenge, rpId: router.owner.rp_id, credentialId: router.owner.credential_id });
}
