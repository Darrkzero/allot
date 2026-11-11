// Runs the REAL split engine (src/lib/server/payments/split.ts) against a MOCK Agent API, for the
// cases NEAR's live service can't produce on demand: results with no amount, and review pauses.
//   npm test
import assert from "node:assert/strict";
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { dbPath, load } from "./_load.mjs";

const SETTLE = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";

// ---- mock Agent API: scripted status per correlation id; records every call ----
const calls = [];
const statusScript = {}; // correlation id -> responses (the last one repeats)
let confidentialAvailable = "990000";
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  calls.push(decodeURIComponent(`${req.method} ${url.pathname}${url.search}`));
  const send = (code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };
  if (req.method === "POST" && /^\/v1\/agents\/[^/]+\/(shield|swap|withdraw)$/.test(url.pathname)) {
    return send(202, { correlation_id: `op_${req.headers["idempotency-key"]}`, status: "QUEUED", failure_code: null }); // key = allot:<leg>:<phase>:<n>
  }
  if (url.pathname === "/v1/status") {
    const corr = url.searchParams.get("correlation_id");
    const seq = statusScript[corr] ?? [{ status: "PROCESSING" }];
    return send(200, { correlation_id: corr, failure_code: null, details: {}, ...(seq.length > 1 ? seq.shift() : seq[0]) });
  }
  if (url.pathname.endsWith("/balances")) return send(200, { balances: [{ asset_id: SETTLE, available_raw: confidentialAvailable }] });
  send(404, { errors: [{ code: "not_found" }] });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
process.env.NEAR_INTENTS_AGENT_API_URL = `http://127.0.0.1:${server.address().port}`;
process.env.NEAR_INTENTS_AGENT_API_KEY = "test";

const db = await load("src/lib/server/db.ts");
const { seal } = await load("src/lib/server/seal.ts");
const { processPayment } = await load("src/lib/server/payments/split.ts");
const raw = new DatabaseSync(dbPath);

db.insertRouter({ handle: "t", name: "T", rules: [], owner: {}, agent_id: "agent1", setup: null });
db.updateRouter("t", { grant_sealed: seal("ngt_test"), status: "active" });
db.insertPayment({ id: "p", handle: "t", amount_usd: 3, memo: null, origin_asset: "x", origin_symbol: "X", origin_chain: "x",
  deposit_address: "d", deposit_memo: null, amount_in_formatted: "1", amount_out: "3000000", deadline: null, status: "SUCCESS" });
const leg = (idx, o) => ({ id: `p:${idx}`, payment_id: "p", idx, label: `L${idx}`, percent: 33, symbol: "S", chain: "base", address: "0xabc",
  amount_settle: "1000000", withdraw_amount: null, ...o });
db.insertLegs([
  leg(0, { target_asset: SETTLE, private: 1, phase: "shield" }),                       // A: private, shield reports no amount
  leg(1, { target_asset: "nep141:eth", private: 0, phase: "swap" }),                  // B: swap reports only its guaranteed minimum
  leg(2, { target_asset: SETTLE, private: 0, phase: "withdraw", withdraw_amount: "1000000" }), // C: withdrawal paused for review
]);
statusScript["op_allot:p:0:shield:0"] = [{ status: "SUCCESS", details: { amount_out: null, delivered: null, min_amount_out: null } }];
statusScript["op_allot:p:1:swap:0"] = [{ status: "SUCCESS", details: { amount_out: null, delivered: null, min_amount_out: "12345" } }];
statusScript["op_allot:p:2:withdraw:0"] = [{ status: "NEEDS_REVIEW" }];
const L = () => Object.fromEntries(db.getLegs("p").map((l) => [l.idx, l]));

// Run 1
await processPayment("p");
let s = L();
assert.equal(s[0].shield_out, "990000", "A: no reported amount -> uses what is actually spendable (990000), not the 1000000 requested");
assert.equal(s[0].withdraw_amount, "990000");
console.log("✓ A: shield with no reported amount uses the confidential balance actually available (0.99), never the 1.00 requested");
assert.deepEqual([s[1].phase, s[1].swap_out, s[1].withdraw_amount], ["withdraw", "12345", "12345"]);
console.log("✓ B: swap reporting only its guaranteed minimum withdraws exactly that minimum");
assert.deepEqual([s[2].phase, s[2].agent_status], ["withdraw", "NEEDS_REVIEW"]);
assert.match(s[2].error, /review/i);
console.log("✓ C: withdrawal paused for review stays in progress with a clear note (not failed)");

// Run 2, immediately: the reviewed slice is not polled again yet (60 s gap)
const before = calls.filter((c) => c.includes("p:2:withdraw:0")).length;
assert.ok(before >= 1, "run 1 did poll the reviewed withdrawal (guards against a vacuous check)");
await processPayment("p");
assert.equal(calls.filter((c) => c.includes("p:2:withdraw:0")).length, before, "no status poll within the review gap");
console.log("✓ C: review is checked gently (no poll again within 60 s)");

// Run 3, after the gap: polled with refresh=true; review resolved -> done
raw.prepare("UPDATE legs SET updated_at = '2000-01-01T00:00:00.000Z' WHERE id = 'p:2'").run();
statusScript["op_allot:p:2:withdraw:0"] = [{ status: "SUCCESS", details: { tx_hash: "abc" } }];
await processPayment("p");
assert.ok(calls.some((c) => c.includes("p:2:withdraw:0") && c.includes("refresh=true")), "NEEDS_REVIEW re-checked with refresh=true");
s = L();
assert.deepEqual([s[2].phase, s[2].error], ["done", null]);
console.log("✓ C: after review it's re-checked with refresh=true and completes");

// D: a shield reporting no amount while nothing is spendable yet -> retry later, never guess
db.insertPayment({ id: "q", handle: "t", amount_usd: 1, memo: null, origin_asset: "x", origin_symbol: "X", origin_chain: "x",
  deposit_address: "d2", deposit_memo: null, amount_in_formatted: "1", amount_out: "1000000", deadline: null, status: "SUCCESS" });
db.insertLegs([{ ...leg(0, { target_asset: SETTLE, private: 1, phase: "shield" }), id: "q:0", payment_id: "q" }]);
statusScript["op_allot:q:0:shield:0"] = [{ status: "SUCCESS", details: {} }];
confidentialAvailable = "0";
await processPayment("q");
const q = db.getLegs("q")[0];
assert.deepEqual([q.phase, q.shield_out, q.attempts], ["shield", null, 1]);
assert.match(q.error, /nothing is spendable/);
console.log("✓ D: if nothing is spendable yet it retries later instead of assuming the full amount");

server.close();
console.log("\nAll engine checks passed.");
