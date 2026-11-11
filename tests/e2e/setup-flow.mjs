// End-to-end check of the setup + payer-quote flow against a running server,
// using a SOFTWARE passkey (P-256 key in memory) that signs exactly like a browser.
// Creates a real (empty) policy-locked agent on NEAR Intents. No funds are moved.
//
//   npm run dev            (in another terminal)
//   npm run e2e   (or: node tests/e2e/setup-flow.mjs [http://localhost:3000])

import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

const BASE = process.argv[2] || "http://localhost:3000";
const origin = new URL(BASE).origin;
const rpId = new URL(BASE).hostname;
const b64url = (b) => Buffer.from(b).toString("base64url");
const sha256 = (b) => createHash("sha256").update(b).digest();
const evm = () => "0x" + randomBytes(20).toString("hex");
// A random Bitcoin P2PKH address with a valid checksum that nobody controls (like evm() above).
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58(buf) {
  let n = BigInt("0x" + buf.toString("hex"));
  let s = "";
  while (n > 0n) {
    s = B58[Number(n % 58n)] + s;
    n /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    s = "1" + s;
  }
  return s;
}
const btc = () => {
  const payload = Buffer.concat([Buffer.from([0]), randomBytes(20)]);
  return base58(Buffer.concat([payload, sha256(sha256(payload)).subarray(0, 4)]));
};
const check = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
};

// --- software passkey ---
const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const credentialId = b64url(randomBytes(16));
const owner = {
  type: "passkey",
  credential_id: credentialId,
  public_key: b64url(publicKey.export({ type: "spki", format: "der" })),
  rp_id: rpId,
  origin,
};
let counter = 1;

function passkeySign(intent) {
  if (intent.standard !== "webauthn") throw new Error(`unexpected standard ${intent.standard}`);
  const p = intent.payload;
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge: p.challenge, origin, crossOrigin: false }));
  const authenticatorData = Buffer.concat([sha256(p.rpId), Buffer.from([0x05]), Buffer.from([0, 0, 0, counter++])]); // UP + UV flags
  const signature = sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJSON)]), privateKey); // DER, like browsers
  return {
    standard: "webauthn",
    payload: p,
    credential: {
      id: credentialId,
      rawId: credentialId,
      type: "public-key",
      response: { clientDataJSON: b64url(clientDataJSON), authenticatorData: b64url(authenticatorData), signature: b64url(signature) },
      clientExtensionResults: {},
      authenticatorAttachment: "platform",
    },
  };
}

async function post(path, body) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status}: ${json.error}`);
  return json;
}
const get = async (path) => (await fetch(BASE + path)).json();
const step = (s) => console.log(`\n▶ ${s}`);

// --- 1. create link ---
const handle = `e2e-${randomBytes(3).toString("hex")}`;
const rules = [
  { label: "Spending", percent: 70, symbol: "USDC", chain: "base", address: evm() },
  { label: "Tax reserve", percent: 20, symbol: "USDC", chain: "arb", address: evm(), private: true },
  { label: "Savings", percent: 10, symbol: "BTC", chain: "btc", address: btc() },
];

step("A private slice to a chain Confidential Intents can't reach is refused");
const tronPrivate = await fetch(BASE + "/api/routers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name: "E2E Tester", handle: `${handle}-x`, owner, rules: [{ label: "All", percent: 100, symbol: "USDT", chain: "tron", address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", private: true }] }),
});
check(tronPrivate.status === 400, `private USDT on Tron is rejected (${tronPrivate.status}: ${(await tronPrivate.json()).error?.slice(0, 80)})`);

step(`Create /pay/${handle}`);
const created = await post("/api/routers", { name: "E2E Tester", handle, rules, owner });
console.log(`  owner is asked to sign: ${created.summary}`);
console.log(`  policy destinations: ${created.policy.destinations.list.map((d) => `${d.chain}:${d.address.slice(0, 8)}…`).join(", ")}`);
check(created.policy.confidential === true, "policy switches confidential on because a slice is private");
check(created.policy.assets.includes("nep141:nbtc.bridge.near"), "BTC slice is held as nBTC (the route with liquidity) before withdrawal to Bitcoin");

step("Passkey signature 1/2: approve rules (creates the locked wallet)");
const grantStep = await post(`/api/routers/${handle}/sign`, { step: "create", correlation_id: created.correlation_id, signed_data: passkeySign(created.intent) });
console.log(`  next: ${grantStep.summary}`);

step("Passkey signature 2/2: switch on auto-split (grant)");
const done = await post(`/api/routers/${handle}/sign`, { step: "grant", correlation_id: grantStep.correlation_id, signed_data: passkeySign(grantStep.intent) });
console.log(`  result: ${done.step}`);

const pub = await get(`/api/routers/${handle}`);
console.log(`  public link info: ${pub.name} · ${pub.rules.map((r) => `${r.label} ${r.percent}%`).join(" / ")}`);
const masked = pub.rules[1];
check(masked.private === true && masked.label === "Private" && !masked.symbol && !masked.chain, "payers see the private slice only as \"Private 20%\" (no label, token or chain)");
const payPage = await (await fetch(`${BASE}/pay/${handle}`)).text();
check(!payPage.includes("Tax reserve"), "the public pay page doesn't leak the private slice's label");

// --- 2. payer side ---
const opts = await get("/api/options");
const payWith = opts.payWith.find((t) => t.symbol === "USDT" && t.chain === "tron") || opts.payWith[0];
step(`Payer: dry quote for $25 paid in ${payWith.symbol} on ${payWith.chain}`);
const dry = await post("/api/pay/quote", { handle, amountUsd: 25, originAsset: payWith.assetId, dry: true });
console.log(`  payer sends ${dry.amountIn} ${dry.symbol} -> recipient gets exactly ${dry.amountOut} USDC (~${dry.timeEstimate}s)`);

const ethArb = opts.payWith.find((t) => t.symbol === "ETH" && t.chain === "arb");
step("Payer: real quote (deposit address) for $25 in ETH on Arbitrum. Nothing is sent.");
const real = await post("/api/pay/quote", { handle, amountUsd: 25, originAsset: ethArb.assetId, refundTo: evm(), memo: "=1+2 E2E test", dry: false });
console.log(`  send ${real.amountIn} ETH to ${real.depositAddress} before ${real.deadline}`);
const status = await get(`/api/pay/${real.id}`);
console.log(`  status: ${status.status}`);
// --- 3. owner dashboard (passkey sign-in) ---
function assertion(challenge, rp) {
  const clientDataJSON = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }));
  const authenticatorData = Buffer.concat([sha256(rp), Buffer.from([0x05]), Buffer.from([0, 0, 0, counter++])]);
  const signature = sign("sha256", Buffer.concat([authenticatorData, sha256(clientDataJSON)]), privateKey);
  return { id: credentialId, response: { clientDataJSON: b64url(clientDataJSON), authenticatorData: b64url(authenticatorData), signature: b64url(signature) } };
}

step("Dashboard security checks");
check((await fetch(`${BASE}/api/dashboard/${handle}`)).status === 401, "dashboard without a session is refused (401)");

const c1 = await post("/api/auth/challenge", { handle });
const forged = assertion(c1.challenge, c1.rpId);
forged.response.signature = b64url(sign("sha256", Buffer.from("something else"), privateKey));
const bad = await fetch(`${BASE}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, challengeId: c1.challengeId, credential: forged }) });
check(bad.status === 401, "a forged passkey signature is rejected (401)");
const replay = await fetch(`${BASE}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, challengeId: c1.challengeId, credential: assertion(c1.challenge, c1.rpId) }) });
check(replay.status === 400, "a used challenge can't be reused (400)");

step("Dashboard sign-in with the real passkey");
const c2 = await post("/api/auth/challenge", { handle });
const ok = await fetch(`${BASE}/api/auth/verify`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle, challengeId: c2.challengeId, credential: assertion(c2.challenge, c2.rpId) }) });
const cookie = (ok.headers.get("set-cookie") || "").split(";")[0];
check(ok.status === 200 && cookie.startsWith("allot_session="), "valid passkey signature → session cookie");

const dash = await (await fetch(`${BASE}/api/dashboard/${handle}`, { headers: { cookie } })).json();
check(dash.payments?.some((p) => p.id === real.id), `dashboard lists the payment (${dash.payments?.length} total, status ${dash.payments?.[0]?.status})`);
check(dash.rules?.length === 3 && dash.rules[0].address.startsWith("0x"), "owner sees full payout addresses");
check(dash.rules[1].private === true && dash.rules[1].label === "Tax reserve", "owner sees the private slice in full (label, address, private flag)");

step("Owner renews the split engine's permission (one passkey approval)");
const grantUrl = `${BASE}/api/dashboard/${handle}/grant`;
const asOwner = { "Content-Type": "application/json", cookie };
check((await fetch(grantUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: "start" }) })).status === 401, "renewal without a session is refused (401)");
const renewStart = await (await fetch(grantUrl, { method: "POST", headers: asOwner, body: JSON.stringify({ step: "start" }) })).json();
check(renewStart.correlation_id && renewStart.intent, `renewal intent issued. Owner sees: ${renewStart.summary?.slice(0, 80)}…`);
const renewed = await (await fetch(grantUrl, { method: "POST", headers: asOwner, body: JSON.stringify({ step: "sign", correlation_id: renewStart.correlation_id, signed_data: passkeySign(renewStart.intent) }) })).json();
check(renewed.ok === true, `grant renewed on NEAR, valid until ${renewed.expiresAt}`);
const dash2 = await (await fetch(`${BASE}/api/dashboard/${handle}`, { headers: { cookie } })).json();
check(dash2.grant.expiresAt === renewed.expiresAt, "dashboard shows the new expiry");
check((await fetch(`${BASE}/api/dashboard/other-handle`, { headers: { cookie } })).status === 401, "session for one link can't open another link's dashboard");
const csv = await (await fetch(`${BASE}/api/dashboard/${handle}/csv`, { headers: { cookie } })).text();
check(csv.startsWith("payment_date_utc,") && csv.includes(real.id), `CSV export works (${csv.split("\r\n").length - 1} data row(s))`);
check(csv.includes(",'=1+2 E2E test,") && !csv.includes(",=1+2"), "a payer memo starting with = is exported as text, not a spreadsheet formula");
check(created.policy.budget.daily_usd === "100000" && created.policy.max_actions_per_hour === 600, "policy limits fit max-size invoices (swap + withdraw both count)");

step("Public endpoints are rate-limited");
const sweeps = [];
for (let i = 0; i < 7; i++) sweeps.push((await fetch(`${BASE}/api/split/sweep`, { method: "POST" })).status);
check(sweeps.slice(0, 6).every((s) => s === 200) && sweeps[6] === 429, `sweep: 6 calls a minute pass, the 7th gets 429 (${sweeps.join(",")})`);

console.log(`\n✅ E2E flow OK. Open ${BASE}/pay/${handle} and ${BASE}/pay/status/${real.id}`);
