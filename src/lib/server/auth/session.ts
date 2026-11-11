import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env } from "../env";

// Owner sessions: an HMAC-signed cookie "<handle>.<expiry>.<nonce>.<mac>", issued only after
// a verified passkey assertion. httpOnly, so page scripts can't read it.

const COOKIE = "allot_session";
const TTL_MS = 12 * 3600 * 1000;

const mac = (payload: string) => createHmac("sha256", `session:${env.secret}`).update(payload).digest("base64url");

export async function startSession(handle: string) {
  const payload = `${handle}.${Date.now() + TTL_MS}.${randomBytes(8).toString("base64url")}`;
  (await cookies()).set(COOKIE, `${payload}.${mac(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

/** Returns true if the request carries a valid owner session for this handle. */
export async function isOwner(handle: string): Promise<boolean> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf(".");
  const payload = raw.slice(0, i);
  const given = Buffer.from(raw.slice(i + 1));
  const expected = Buffer.from(mac(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return false;
  const [h, exp] = payload.split(".");
  return h === handle && Number(exp) > Date.now();
}
