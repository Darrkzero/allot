import "server-only";

/**
 * Small in-memory rate limiter (fixed window per client IP and route). Allot runs as one server
 * process (its SQLite file lives on one disk), so in-process counters are the whole picture.
 *
 * Client IP, in order:
 *  1. ALLOT_CLIENT_IP_HEADER, if set: a header the host's proxy always overwrites with the real client
 *     IP (e.g. x-real-ip, cf-connecting-ip, fly-client-ip).
 *  2. On Railway (it sets RAILWAY_ENVIRONMENT_ID): X-Real-IP, which its edge overwrites. Its
 *     X-Forwarded-For ends in an internal proxy address that changes per request; keyed on that, every
 *     request looked like a new client and no limit ever triggered (measured on the live deploy).
 *  3. Otherwise the X-Forwarded-For entry ALLOT_PROXY_HOPS from the right (default 1: the one our
 *     host's proxy appended). Entries to its left are whatever the client sent and can be forged.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function clientIp(request: Request): string {
  const trusted = process.env.ALLOT_CLIENT_IP_HEADER?.trim().toLowerCase() || (process.env.RAILWAY_ENVIRONMENT_ID ? "x-real-ip" : "");
  const fromTrusted = trusted ? request.headers.get(trusted)?.split(",")[0]?.trim() : "";
  if (fromTrusted) return fromTrusted;
  const hops = Math.max(1, Number(process.env.ALLOT_PROXY_HOPS) || 1);
  const chain = (request.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return chain[chain.length - hops] ?? request.headers.get("x-real-ip") ?? "local";
}

/** Returns a 429 response once `limit` requests from this client hit `name` within `windowMs`, else null. */
export function rateLimit(request: Request, name: string, limit: number, windowMs: number): Response | null {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k); // keep memory bounded
  const key = `${name}:${clientIp(request)}`;
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count++;
  if (b.count <= limit) return null;
  return Response.json(
    { error: "Too many requests. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(Math.ceil((b.resetAt - now) / 1000)) } }
  );
}
