// Extensive check of a deployed Allot instance (about 130 checks). No funds are moved.
//   npm run check:deploy -- https://your-allot-domain [outDir]
//
// Runs tests/e2e/setup-flow.mjs, then checks hostile input, private-pot privacy, input validation,
// owner sessions, rate limits (including forged client-IP headers), security headers, and every page
// in a real browser on desktop and phone (Edge by default; PW_CHANNEL=chrome for Chrome).
//
// It creates real records on the target: an "e2e-" and a "qa-" payment link, each with an empty
// policy-locked NEAR Intents wallet, and 1Click deposit addresses that are never funded. It uses 9 of
// the 10 link setups allowed per IP per 10 minutes, so wait 10 minutes between runs.
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright-core";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
if (!process.argv[2]) {
  console.error("Usage: npm run check:deploy -- https://your-allot-domain [outDir]");
  process.exit(1);
}
const BASE = process.argv[2].replace(/\/$/, "");
const OUT = process.argv[3] || path.join(os.tmpdir(), "allot-deploy-check");
const CHANNEL = process.env.PW_CHANNEL || "msedge";
fs.mkdirSync(`${OUT}/pages`, { recursive: true });
const host = new URL(BASE).host;

// ---------- reporting ----------
const results = [];
let section = "";
const rec = (status, name, detail = "") => {
  results.push({ section, status, name, detail });
  const icon = { PASS: "✓", FAIL: "✗", WARN: "!", INFO: "·" }[status];
  console.log(`  ${icon} ${name}${detail ? ` — ${detail}` : ""}`);
};
const expect = (cond, name, detail = "") => rec(cond ? "PASS" : "FAIL", name, detail);
const head = (s) => {
  section = s;
  console.log(`\n=== ${s} ===`);
};
const safe = async (name, fn) => {
  try {
    await fn();
  } catch (e) {
    rec("FAIL", name, `threw: ${e.message.slice(0, 200)}`);
  }
};

const j = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text.slice(0, 200) };
  }
};
const post = async (path, body, headers = {}) => {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  return { status: res.status, json: await j(res), headers: res.headers };
};
const get = async (path, headers = {}) => {
  const res = await fetch(BASE + path, { headers, redirect: "manual" });
  return { status: res.status, json: await j(res.clone()).catch(() => null), headers: res.headers, res };
};

// ---------- software passkey (same as the e2e test) ----------
const b64url = (b) => Buffer.from(b).toString("base64url");
const sha256 = (b) => createHash("sha256").update(b).digest();
const evm = () => "0x" + randomBytes(20).toString("hex");
function makePasskey() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const id = b64url(randomBytes(16));
  let counter = 1;
  const owner = { type: "passkey", credential_id: id, public_key: b64url(publicKey.export({ type: "spki", format: "der" })), rp_id: new URL(BASE).hostname, origin: new URL(BASE).origin };
  const signIntent = (intent) => {
    const p = intent.payload;
    const cd = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: p.challenge, origin: owner.origin, crossOrigin: false }));
    const ad = Buffer.concat([sha256(p.rpId), Buffer.from([0x05]), Buffer.from([0, 0, 0, counter++])]);
    const sig = sign("sha256", Buffer.concat([ad, sha256(cd)]), privateKey);
    return { standard: "webauthn", payload: p, credential: { id, rawId: id, type: "public-key", response: { clientDataJSON: b64url(cd), authenticatorData: b64url(ad), signature: b64url(sig) }, clientExtensionResults: {}, authenticatorAttachment: "platform" } };
  };
  const assertion = (challenge, rp) => {
    const cd = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: owner.origin, crossOrigin: false }));
    const ad = Buffer.concat([sha256(rp), Buffer.from([0x05]), Buffer.from([0, 0, 0, counter++])]);
    return { id, response: { clientDataJSON: b64url(cd), authenticatorData: b64url(ad), signature: b64url(sign("sha256", Buffer.concat([ad, sha256(cd)]), privateKey)) } };
  };
  return { owner, signIntent, assertion };
}

// =====================================================================================
head("1. Existing end-to-end flow (tests/e2e/setup-flow.mjs, 21 checks)");
let e2eHandle = null;
let e2ePayId = null;
{
  const r = spawnSync("node", ["tests/e2e/setup-flow.mjs", BASE], { cwd: ROOT, encoding: "utf8", timeout: 300_000 });
  const out = (r.stdout || "") + (r.stderr || "");
  const checks = out.split("\n").filter((l) => l.trim().startsWith("✓"));
  for (const c of checks) rec("PASS", c.trim().slice(2));
  const m = out.match(/\/pay\/(e2e-[0-9a-f]+) and .*\/pay\/status\/([0-9a-f-]{36})/);
  if (m) [, e2eHandle, e2ePayId] = m;
  if (r.status !== 0) rec("FAIL", "e2e flow", (out.match(/FAILED:.*|Error:.*/) || [out.slice(-300)])[0]);
  else rec("PASS", `e2e flow complete: /pay/${e2eHandle}, payment ${e2ePayId}`);
}

// =====================================================================================
head("2. Hostile input: a link whose name and pot labels contain HTML/script");
const qa = makePasskey();
const qaHandle = `qa-${randomBytes(3).toString("hex")}`;
const qaPrivateAddr = evm();
const qaPublicAddr = evm();
const XSS_NAME = `<img src=x onerror="window.__xss=1">QA & "Co"`;
const XSS_LABEL = `<script>window.__xss=2</script>`;
let qaPayId = null;
const qaRefund = evm();
await safe("hostile link setup", async () => {
  const created = await post("/api/routers", {
    name: XSS_NAME,
    handle: qaHandle,
    owner: qa.owner,
    rules: [
      { label: XSS_LABEL, percent: 60, symbol: "USDC", chain: "base", address: qaPublicAddr },
      { label: "Secret reserve", percent: 40, symbol: "USDC", chain: "arb", address: qaPrivateAddr, private: true },
    ],
  });
  expect(created.status === 200, "link with HTML in name/labels is accepted as plain text", `${created.status} ${created.json.error ?? ""}`);

  // Before signing: the link must not be payable.
  const pendingHtml = await (await fetch(`${BASE}/pay/${qaHandle}`)).text();
  expect(/take payments/.test(pendingHtml) && /noindex/.test(pendingHtml), "an unsigned (pending) link shows 'can't take payments' (noindex)");
  const pendingQuote = await post("/api/pay/quote", { handle: qaHandle, amountUsd: 10, originAsset: "nep141:arb.omft.near", dry: true });
  expect(pendingQuote.status === 404, "an unsigned link can't be quoted", `${pendingQuote.status} ${pendingQuote.json.error ?? ""}`);

  // A signature from a different passkey must be refused by NEAR, without breaking the setup.
  const stranger = makePasskey();
  const badSign = await post(`/api/routers/${qaHandle}/sign`, { step: "create", correlation_id: created.json.correlation_id, signed_data: stranger.signIntent(created.json.intent) });
  expect(badSign.status >= 400 && badSign.status < 500, "a different passkey's signature is refused (4xx, not 5xx)", `${badSign.status} ${String(badSign.json.error ?? "").slice(0, 90)}`);

  const garbage = await post(`/api/routers/${qaHandle}/sign`, { step: "create", correlation_id: created.json.correlation_id, signed_data: { nonsense: true } });
  expect(garbage.status >= 400 && garbage.status < 500, "a malformed signature is refused (4xx)", `${garbage.status} ${String(garbage.json.error ?? "").slice(0, 90)}`);

  const s1 = await post(`/api/routers/${qaHandle}/sign`, { step: "create", correlation_id: created.json.correlation_id, signed_data: qa.signIntent(created.json.intent) });
  expect(s1.status === 200, "the real owner's signature still works after the failed attempts", `${s1.status} ${s1.json.error ?? ""}`);
  const s2 = await post(`/api/routers/${qaHandle}/sign`, { step: "grant", correlation_id: s1.json.correlation_id, signed_data: qa.signIntent(s1.json.intent) });
  expect(s2.status === 200, "grant step completes; link active", `${s2.status} ${s2.json.error ?? ""}`);

  const replay = await post(`/api/routers/${qaHandle}/sign`, { step: "grant", correlation_id: s1.json.correlation_id, signed_data: qa.signIntent(s1.json.intent) });
  expect(replay.status < 500, "replaying the grant step doesn't crash the server", `${replay.status} ${String(replay.json.error ?? JSON.stringify(replay.json)).slice(0, 90)}`);
  const stillActive = await get(`/api/routers/${qaHandle}`);
  expect(stillActive.status === 200, "link still active after the replay", `${stillActive.status}`);

  // Re-creating an active handle (even by the owner) is refused.
  const dup = await post("/api/routers", { name: "Dup", handle: qaHandle, owner: makePasskey().owner, rules: [{ label: "All", percent: 100, symbol: "USDC", chain: "base", address: evm() }] });
  expect(dup.status === 409, "taking an active link name is refused (409)", `${dup.status} ${dup.json.error ?? ""}`);

  // A real deposit address with a hostile, over-long memo.
  const memo = `<img src=y onerror="window.__xss=3">` + "m".repeat(400);
  const q = await post("/api/pay/quote", { handle: qaHandle, amountUsd: 12, originAsset: "nep141:arb.omft.near", refundTo: qaRefund, memo, dry: false });
  expect(q.status === 200 && q.json.depositAddress, "real quote with hostile memo returns a deposit address", `${q.status} ${q.json.error ?? ""}`);
  qaPayId = q.json.id;
});

// =====================================================================================
head("3. Privacy of the private pot (public API and pages)");
await safe("privacy checks", async () => {
  const pub = await get(`/api/routers/${qaHandle}`);
  const pubText = JSON.stringify(pub.json);
  expect(!pubText.includes(qaPrivateAddr) && !pubText.includes("Secret reserve"), "public link API hides the private pot's label and address");
  expect(!pubText.toLowerCase().includes(qaPublicAddr.toLowerCase()), "public link API doesn't expose any payout address");
  const page = await (await fetch(`${BASE}/pay/${qaHandle}`)).text();
  expect(!page.includes(qaPrivateAddr) && !page.includes("Secret reserve"), "public pay page HTML hides the private pot");
  expect(!page.toLowerCase().includes(qaPublicAddr.toLowerCase()), "public pay page HTML doesn't expose payout addresses");
  if (qaPayId) {
    const st = await get(`/api/pay/${qaPayId}`);
    const stText = JSON.stringify(st.json);
    expect(st.status === 200, "payment status API works", `${st.status}`);
    expect(!stText.includes(qaPrivateAddr) && !stText.includes("Secret reserve"), "payment status API hides the private pot");
    expect(typeof st.json.memo === "string" && st.json.memo.length <= 140, "payer memo is stored truncated (≤140 chars)", `${st.json.memo?.length}`);
    expect(!stText.toLowerCase().includes(qaRefund.toLowerCase()), "payment status API doesn't expose the payer's refund address");
    const sp = await (await fetch(`${BASE}/pay/status/${qaPayId}`)).text();
    expect(!sp.includes(qaPrivateAddr) && !sp.includes("Secret reserve"), "payment status page HTML hides the private pot");
  }
});

// =====================================================================================
head("4. Input validation (each must be a clear 4xx, never a 5xx)");
const goodRules = [{ label: "All", percent: 100, symbol: "USDC", chain: "base", address: evm() }];
const cases = [
  ["create: invalid JSON body", () => post("/api/routers", "{not json")],
  ["create: bad link name 'A!'", () => post("/api/routers", { name: "X", handle: "A!", owner: makePasskey().owner, rules: goodRules })],
  ["create: shares add up to 99%", () => post("/api/routers", { name: "X", handle: `qa-${randomBytes(3).toString("hex")}`, owner: makePasskey().owner, rules: [{ ...goodRules[0], percent: 99 }] })],
  ["create: invalid EVM address", () => post("/api/routers", { name: "X", handle: `qa-${randomBytes(3).toString("hex")}`, owner: makePasskey().owner, rules: [{ ...goodRules[0], address: "0x1234" }] })],
  ["create: 6 pots (max 5)", () => post("/api/routers", { name: "X", handle: `qa-${randomBytes(3).toString("hex")}`, owner: makePasskey().owner, rules: Array.from({ length: 6 }, (_, i) => ({ label: `P${i}`, percent: i < 5 ? 16 : 20, symbol: "USDC", chain: "base", address: evm() })) })],
  ["quote: amount 0", () => post("/api/pay/quote", { handle: qaHandle, amountUsd: 0, originAsset: "nep141:arb.omft.near", dry: true })],
  ["quote: amount 10,001", () => post("/api/pay/quote", { handle: qaHandle, amountUsd: 10001, originAsset: "nep141:arb.omft.near", dry: true })],
  ["quote: amount 'abc'", () => post("/api/pay/quote", { handle: qaHandle, amountUsd: "abc", originAsset: "nep141:arb.omft.near", dry: true })],
  ["quote: unknown currency", () => post("/api/pay/quote", { handle: qaHandle, amountUsd: 10, originAsset: "nep141:nope.near", dry: true })],
  ["quote: link doesn't exist", () => post("/api/pay/quote", { handle: "no-such-link-qa", amountUsd: 10, originAsset: "nep141:arb.omft.near", dry: true })],
  ["quote: real payment without refund address", () => post("/api/pay/quote", { handle: qaHandle, amountUsd: 10, originAsset: "nep141:arb.omft.near", dry: false })],
  ["quote: refund address on the wrong network", () => post("/api/pay/quote", { handle: qaHandle, amountUsd: 10, originAsset: "nep141:arb.omft.near", refundTo: "bc1qnotreallyanaddress", dry: false })],
  ["quote: invalid JSON body", () => post("/api/pay/quote", "{oops")],
  ["estimate: amount 0", () => post("/api/estimate/payment", { amountUsd: 0, originAsset: "nep141:arb.omft.near" })],
  ["estimate: no currency", () => post("/api/estimate/payment", { amountUsd: 10 })],
  ["estimate: unknown currency", () => post("/api/estimate/payment", { amountUsd: 10, originAsset: "nep141:nope.near" })],
  ["estimate payouts: pots not an array", () => post("/api/estimate/payouts", { amountUsd: 10, pots: "x" })],
  ["estimate payouts: invalid JSON", () => post("/api/estimate/payouts", "{oops")],
  ["sign: link doesn't exist", () => post("/api/routers/no-such-link-qa/sign", { step: "create", correlation_id: "x", signed_data: {} })],
  ["sign: unknown step", () => post(`/api/routers/${qaHandle}/sign`, { step: "explode", correlation_id: "x", signed_data: {} })],
  ["auth challenge: link doesn't exist", () => post("/api/auth/challenge", { handle: "no-such-link-qa" })],
  ["auth verify: unknown challenge", () => post("/api/auth/verify", { handle: qaHandle, challengeId: randomUUID(), credential: {} })],
  ["auth verify: malformed credential", async () => {
    const c = await post("/api/auth/challenge", { handle: qaHandle });
    return post("/api/auth/verify", { handle: qaHandle, challengeId: c.json.challengeId, credential: { id: "x", response: { clientDataJSON: "!!", authenticatorData: "", signature: "" } } });
  }],
];
for (const [name, fn] of cases) {
  await safe(name, async () => {
    const r = await fn();
    const msg = String(r.json?.error ?? r.json?._raw ?? "").slice(0, 100);
    if (r.status >= 500) rec("FAIL", name, `${r.status} ${msg}`);
    else if (r.status === 429) rec("WARN", name, "rate-limited before validation (429)");
    else expect(r.status >= 400 && r.status < 500 && msg.length > 0, name, `${r.status} "${msg}"`);
  });
}

// =====================================================================================
head("5. Owner sessions and the dashboard");
await safe("session checks", async () => {
  const c = await post("/api/auth/challenge", { handle: qaHandle });
  const v = await fetch(`${BASE}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle: qaHandle, challengeId: c.json.challengeId, credential: qa.assertion(c.json.challenge, c.json.rpId) }) });
  const setCookie = v.headers.get("set-cookie") || "";
  expect(v.status === 200, "owner signs in with their passkey", `${v.status}`);
  expect(/;\s*httponly/i.test(setCookie), "session cookie is HttpOnly");
  expect(/;\s*secure/i.test(setCookie), "session cookie is Secure (HTTPS only)");
  expect(/;\s*samesite=(lax|strict)/i.test(setCookie), "session cookie is SameSite (blocks cross-site form posts)");
  const cookie = setCookie.split(";")[0];

  const dash = await get(`/api/dashboard/${qaHandle}`, { cookie });
  expect(dash.status === 200 && JSON.stringify(dash.json).includes(qaPrivateAddr), "owner's dashboard shows the private pot in full");
  expect(dash.json.payments?.some((p) => p.id === qaPayId), "dashboard lists the payment");

  const [name, value] = cookie.split("=");
  const tampered = `${name}=${value.slice(0, -3)}${value.slice(-3) === "AAA" ? "BBB" : "AAA"}`;
  expect((await get(`/api/dashboard/${qaHandle}`, { cookie: tampered })).status === 401, "a tampered session cookie is refused (401)");
  if (e2eHandle) expect((await get(`/api/dashboard/${e2eHandle}`, { cookie })).status === 401, "this link's session can't open another link's dashboard");

  const csvNo = await get(`/api/dashboard/${qaHandle}/csv`);
  expect(csvNo.status === 401, "CSV export without a session is refused (401)", `${csvNo.status}`);
  const csv = await (await fetch(`${BASE}/api/dashboard/${qaHandle}/csv`, { headers: { cookie } })).text();
  expect(csv.includes(qaPayId ?? "none"), "CSV export with a session works");
  const retryNo = await post(`/api/dashboard/${qaHandle}/retry`, {});
  expect(retryNo.status === 401, "retry without a session is refused (401)", `${retryNo.status}`);
  const retry = await post(`/api/dashboard/${qaHandle}/retry`, { paymentId: qaPayId }, { cookie });
  expect(retry.status === 200, "retry with a session works (nothing to retry)", `${retry.status} ${JSON.stringify(retry.json).slice(0, 80)}`);
  const evil = await post(`/api/dashboard/${qaHandle}/retry`, { paymentId: qaPayId }, { cookie, Origin: "https://evil.example" });
  rec(evil.status === 200 ? "INFO" : "PASS", "cross-site POST with the cookie attached", evil.status === 200 ? "accepted; browsers won't attach a SameSite=Lax cookie cross-site, so this needs a stolen cookie" : `${evil.status}`);

  const out = await fetch(`${BASE}/api/auth/logout`, { method: "POST", headers: { cookie } });
  const cleared = /allot_session=;|max-age=0|expires=thu, 01 jan 1970/i.test(out.headers.get("set-cookie") || "");
  expect(out.status < 400 && cleared, "logout clears the session cookie", `${out.status}`);
  const after = await get(`/api/dashboard/${qaHandle}`, { cookie });
  rec(after.status === 401 ? "PASS" : "INFO", "old cookie after logout", after.status === 401 ? "refused" : "still valid until it expires (stateless cookie); only matters if the cookie was stolen");
});

// =====================================================================================
head("6. Rate limiting behind Railway's proxy");
await safe("rate limit", async () => {
  // auth-challenge allows 20/min per client in fixed one-minute windows, and earlier sections already
  // opened one. So: ask until refused (a window may close part-way), then, while still refused, try to
  // dodge the limit with forged client-IP headers.
  const challenge = (h = {}) => post("/api/auth/challenge", { handle: "no-such-link-qa" }, h);
  const untilRefused = async () => {
    for (let i = 1; i <= 45; i++) if ((await challenge()).status === 429) return i;
    return null;
  };
  const n = await untilRefused();
  expect(n !== null && n <= 41, "auth challenges are refused (429) after 20 in a minute", n ? `refused at request ${n}` : "never refused in 45 requests");
  const spoofs = [
    { "X-Forwarded-For": "203.0.113.7" },
    { "X-Forwarded-For": "203.0.113.8, 198.51.100.9" },
    { "X-Real-IP": "203.0.113.10" },
    { "X-Forwarded-For": "203.0.113.11", "X-Real-IP": "203.0.113.11" },
  ];
  for (const h of spoofs) {
    if ((await challenge()).status !== 429) await untilRefused(); // the window rolled over: block again first
    const r = await challenge(h);
    expect(r.status === 429, `forged ${Object.keys(h).join(" + ")} can't dodge the limit`, `${r.status}`);
  }
  const ra = (await challenge()).headers.get("retry-after");
  expect(Number(ra) > 0, "429 responses say when to retry (Retry-After)", `${ra}s`);
});

// =====================================================================================
head("7. Infrastructure, headers, errors");
await safe("infra", async () => {
  const http = await fetch(`http://${host}/`, { redirect: "manual" });
  expect([301, 302, 307, 308].includes(http.status) && (http.headers.get("location") || "").startsWith("https://"), "plain http redirects to https", `${http.status} → ${http.headers.get("location")}`);
  const home = await fetch(`${BASE}/`);
  const h = home.headers;
  const hdr = (k) => h.get(k);
  rec(hdr("strict-transport-security") ? "PASS" : "WARN", "HSTS header", hdr("strict-transport-security") ?? "missing");
  rec(hdr("x-content-type-options") ? "PASS" : "WARN", "X-Content-Type-Options", hdr("x-content-type-options") ?? "missing");
  rec(hdr("x-frame-options") || /frame-ancestors/.test(hdr("content-security-policy") ?? "") ? "PASS" : "WARN", "clickjacking protection (X-Frame-Options / frame-ancestors)", hdr("x-frame-options") ?? "missing");
  rec(hdr("referrer-policy") ? "PASS" : "WARN", "Referrer-Policy", hdr("referrer-policy") ?? "missing (browser default: strict-origin-when-cross-origin)");
  rec(hdr("x-powered-by") ? "WARN" : "PASS", "X-Powered-By hidden", hdr("x-powered-by") ?? "");
  const health = await get("/api/health");
  expect(health.status === 200 && health.json?.ok === true, "health check", JSON.stringify(health.json));
  const p404 = await fetch(`${BASE}/definitely-not-a-page`);
  expect(p404.status === 404, "unknown page returns 404", `${p404.status}`);
  const a404 = await fetch(`${BASE}/api/definitely-not-a-route`);
  expect(a404.status === 404, "unknown API route returns 404", `${a404.status}`);
  const wrongMethod = await fetch(`${BASE}/api/pay/quote`);
  expect(wrongMethod.status === 405, "wrong HTTP method returns 405", `${wrongMethod.status}`);
  const html = await home.text();
  const asset = html.match(/\/_next\/static\/[^"]+\.js/)?.[0];
  const ar = asset ? await fetch(BASE + asset, { headers: { "Accept-Encoding": "gzip, br" } }) : null;
  expect(/immutable/.test(ar?.headers.get("cache-control") ?? ""), "static assets cached long-term (immutable)");
  expect(!!ar?.headers.get("content-encoding"), "static assets compressed", ar?.headers.get("content-encoding") ?? "none");
  const err = await post("/api/pay/quote", "{oops");
  expect(!/at \w+ \(|node_modules|\.ts:\d+/.test(JSON.stringify(err.json)), "error responses don't leak stack traces or file paths");
});

// =====================================================================================
head("8. Every page in a real browser (desktop + phone): status, JS errors, failed requests, layout");
const pages = [
  ["/", 200],
  ["/create", 200],
  ["/demo", 200],
  ["/dashboard", 200],
  [`/dashboard/${qaHandle}`, 200],
  [`/pay/${qaHandle}`, 200],
  [e2eHandle ? `/pay/${e2eHandle}` : null, 200],
  ["/pay/no-such-link-qa", 200], // streamed page: Next keeps 200 and adds noindex; content checked below
  [qaPayId ? `/pay/status/${qaPayId}` : null, 200],
  [e2ePayId ? `/pay/status/${e2ePayId}` : null, 200],
  [`/pay/status/${randomUUID()}`, 200],
  ["/pay/status/not-a-uuid", 200],
  ["/definitely-not-a-page", 404],
].filter(([p]) => p);
const browser = await chromium.launch({ channel: CHANNEL });
const internalLinks = new Set();
for (const [label, ctxOpts] of [
  ["desktop", { viewport: { width: 1440, height: 900 } }],
  ["phone", { ...devices["iPhone 13"], defaultBrowserType: undefined }],
]) {
  const ctx = await browser.newContext(ctxOpts);
  for (const [path, want] of pages) {
    await safe(`${label} ${path}`, async () => {
      const page = await ctx.newPage();
      const problems = [];
      page.on("console", (m) => {
        const expected401 = path.startsWith("/dashboard/") && /status of 401/.test(m.text()); // signed-out dashboard asks, gets 401, shows sign-in
        if (m.type() === "error" && !expected401 && !/Failed to load resource: the server responded with a status of 404/.test(m.text())) problems.push(`console: ${m.text().slice(0, 140)}`);
        if (/hydrat/i.test(m.text())) problems.push(`hydration: ${m.text().slice(0, 140)}`);
      });
      page.on("pageerror", (e) => problems.push(`js error: ${e.message.slice(0, 140)}`));
      page.on("dialog", (d) => {
        problems.push(`DIALOG (possible XSS): ${d.message()}`);
        d.dismiss();
      });
      page.on("requestfailed", (r) => {
        const f = r.failure()?.errorText ?? "";
        if (!/ERR_ABORTED|NS_BINDING_ABORTED/.test(f)) problems.push(`request failed: ${r.url().replace(BASE, "")} ${f}`);
      });
      page.on("response", (r) => {
        const u = r.url();
        if (r.status() >= 500 && u.startsWith(BASE)) problems.push(`server error ${r.status()}: ${u.replace(BASE, "")}`);
      });
      const resp = await page.goto(BASE + path, { waitUntil: "load", timeout: 60_000 });
      await page.waitForTimeout(3500);
      const status = resp?.status();
      const layout = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - window.innerWidth, xss: window.__xss ?? null, title: document.title }));
      if (layout.xss) problems.push(`XSS executed (window.__xss=${layout.xss})`);
      if (layout.overflow > 1) problems.push(`page is ${layout.overflow}px wider than the screen (sideways scroll)`);
      for (const a of await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))) if (a && a.startsWith("/") && !a.startsWith("//")) internalLinks.add(a.split("#")[0]);
      await page.screenshot({ path: `${OUT}/pages/${label}${path.replace(/[^a-z0-9]+/gi, "_")}.png`, fullPage: label === "phone" });
      if (status !== want) problems.unshift(`HTTP ${status}, expected ${want}`);
      if (path.includes("no-such-link") && !/take payments/.test(await page.innerText("body"))) problems.push("missing the 'can't take payments' message");
      rec(problems.length ? "FAIL" : "PASS", `${label} ${path}`, problems.length ? problems.join(" | ") : `HTTP ${status}, "${layout.title}"`);
      await page.close();
    });
  }
  await ctx.close();
}

// Hostile text must render as text.
await safe("xss text", async () => {
  const page = await browser.newPage();
  await page.goto(`${BASE}/pay/${qaHandle}`, { waitUntil: "load" });
  const body = await page.innerText("body");
  expect(body.includes('<img src=x onerror="window.__xss=1">QA & "Co"'), "hostile link name is shown literally as text on the pay page");
  await page.close();
  if (qaPayId) {
    const p2 = await browser.newPage();
    await p2.goto(`${BASE}/pay/status/${qaPayId}`, { waitUntil: "load" });
    await p2.waitForTimeout(3000);
    const t = await p2.innerText("body");
    expect(!(await p2.evaluate(() => window.__xss ?? null)), "hostile payer memo doesn't execute on the status page");
    rec(t.includes("onerror") ? "PASS" : "INFO", "status page shows the memo as text", t.includes("onerror") ? "" : "memo not displayed on this page");
    await p2.close();
  }
});
await browser.close();

head("9. Every internal link found on those pages");
for (const href of [...internalLinks].sort()) {
  const r = await fetch(BASE + href, { redirect: "manual" });
  expect(r.status < 400 || href.includes("no-such-link"), `link ${href}`, `${r.status}`);
}

// =====================================================================================
head("10. Speed from this connection (3 tries each, median)");
for (const p of ["/", "/create", "/demo", `/pay/${qaHandle}`, "/api/health", "/api/options"]) {
  const t = [];
  for (let i = 0; i < 3; i++) {
    const s = performance.now();
    const r = await fetch(BASE + p);
    await r.arrayBuffer();
    t.push(performance.now() - s);
  }
  t.sort((a, b) => a - b);
  rec("INFO", `${p}`, `${Math.round(t[1])} ms`);
}

// =====================================================================================
head("11. Status polling limit (runs last: it blocks this machine's status checks for a minute)");
await safe("pay-status limit", async () => {
  // Made-up payment ids: refused or "not found" without any call to 1Click.
  const st = await Promise.all(Array.from({ length: 140 }, () => fetch(`${BASE}/api/pay/${randomUUID()}`).then((r) => r.status)));
  const n429 = st.filter((s) => s === 429).length;
  expect(n429 >= 1 && st.length - n429 <= 120, `at most 120 status checks a minute per visitor (${st.length - n429} passed, ${n429} refused)`);
  console.log(`  → limits are per visitor? Within a minute, open ${BASE}/api/pay/${randomUUID()} from another network`);
  console.log(`    (e.g. a phone on mobile data): "Payment not found" is right; "Too many requests" means visitors share a limit.`);
});

// =====================================================================================
const fails = results.filter((r) => r.status === "FAIL");
const warns = results.filter((r) => r.status === "WARN");
console.log(`\n==== ${results.filter((r) => r.status === "PASS").length} passed, ${fails.length} failed, ${warns.length} warnings ====`);
for (const f of fails) console.log(`FAIL [${f.section}] ${f.name}: ${f.detail}`);
for (const w of warns) console.log(`WARN [${w.section}] ${w.name}: ${w.detail}`);
fs.writeFileSync(`${OUT}/hosted-results.json`, JSON.stringify({ base: BASE, qaHandle, qaPayId, e2eHandle, e2ePayId, results }, null, 2));
console.log(`\nTest links: /pay/${e2eHandle}  /pay/${qaHandle} · screenshots and results in ${OUT}`);
process.exit(fails.length ? 1 : 0);
