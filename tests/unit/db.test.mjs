// Retrying a delayed pot must never send twice, and the sweeper must give every pending payment a turn.
//   npm test
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { dbPath, load } from "./_load.mjs";

const db = await load("src/lib/server/db.ts");
const SETTLE = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const raw = new DatabaseSync(dbPath);

db.insertRouter({ handle: "t", name: "T", rules: [], owner: {}, agent_id: "a", setup: null });
const pay = (id) =>
  db.insertPayment({ id, handle: "t", amount_usd: 10, memo: null, origin_asset: "x", origin_symbol: "X", origin_chain: "x",
    deposit_address: id, deposit_memo: null, amount_in_formatted: "1", amount_out: "10000000", deadline: null, status: "SUCCESS" });
pay("p1");

const seed = (s) => {
  const id = `p1:${s.idx}`;
  db.insertLegs([{ id, payment_id: "p1", idx: s.idx, label: `L${s.idx}`, percent: 10, symbol: "S", chain: "c", address: "addr",
    target_asset: s.target ?? "nep141:other", amount_settle: "1000000", private: s.private ?? 0, phase: "failed", withdraw_amount: s.withdraw_amount ?? null }]);
  db.updateLeg(id, { phase: "failed", agent_status: s.agent_status, shield_corr: s.shield_corr ?? null, shield_out: s.shield_out ?? null,
    swap_corr: s.swap_corr ?? null, swap_out: s.swap_out ?? null, withdraw_corr: s.withdraw_corr ?? null, attempts: 60, error: "boom" });
};

seed({ idx: 0, target: SETTLE, agent_status: "PROCESSING", withdraw_corr: "op_inflight", withdraw_amount: "1000000" }); // gave up mid-withdraw
seed({ idx: 1, target: SETTLE, agent_status: "FAILED", withdraw_corr: "op_failed", withdraw_amount: "1000000" });      // withdraw definitively failed
seed({ idx: 2, agent_status: "SUCCESS", swap_corr: "op_swap_ok" });                                                       // swap OK, no amount reported
seed({ idx: 3, agent_status: "REFUNDED", swap_corr: "op_swap_refunded" });                                                // swap refunded
seed({ idx: 4, private: 1, agent_status: "REFUNDED", shield_corr: "op_shield_refunded" });                                // shield refunded
seed({ idx: 5, private: 1, target: SETTLE, agent_status: "FAILED", shield_corr: "op_sh", shield_out: "990000", withdraw_corr: "op_pw", withdraw_amount: "990000" });
seed({ idx: 6, agent_status: null });                                                                                     // refused before anything was submitted

assert.equal(db.resetFailedLegs("p1", SETTLE), 7);
const L = Object.fromEntries(db.getLegs("p1").map((l) => [l.idx, l]));
assert.deepEqual([L[0].phase, L[0].withdraw_corr], ["withdraw", "op_inflight"], "in-flight withdrawal is re-checked, not re-sent");
assert.deepEqual([L[1].phase, L[1].withdraw_corr], ["withdraw", null], "failed withdrawal is re-sent");
assert.deepEqual([L[2].phase, L[2].swap_corr], ["swap", "op_swap_ok"], "succeeded swap is re-checked, not swapped twice");
assert.deepEqual([L[3].phase, L[3].swap_corr], ["swap", null], "refunded swap is re-sent");
assert.deepEqual([L[4].phase, L[4].shield_corr], ["shield", null], "refunded shield is re-sent");
assert.deepEqual([L[5].phase, L[5].shield_corr, L[5].withdraw_corr], ["withdraw", "op_sh", null], "private: shield kept, failed withdraw re-sent");
assert.deepEqual([L[6].phase, L[6].swap_corr], ["swap", null], "nothing submitted: starts the step fresh");
for (const l of Object.values(L)) assert.deepEqual([l.attempts, l.key_n, l.error], [0, 1, null], "attempts reset, fresh idempotency key, error cleared");
console.log("✓ retry: only operations NEAR reported FAILED/REFUNDED are resubmitted (7 cases)");

pay("p2"); // not split yet
pay("p3");
db.insertLegs([{ id: "p3:0", payment_id: "p3", idx: 0, label: "x", percent: 100, symbol: "S", chain: "c", address: "a", target_asset: SETTLE, amount_settle: "1", private: 0, phase: "withdraw", withdraw_amount: "1" }]);
raw.prepare("UPDATE legs SET updated_at = '2000-01-01T00:00:00.000Z' WHERE payment_id = 'p3'").run(); // touched long ago
db.updateLeg("p1:0", { error: null }); // p1 touched just now
assert.deepEqual(db.paymentsNeedingSplit(10).map((p) => p.id), ["p2", "p3", "p1"]);
console.log("✓ sweeper: unsplit payments first, then the least recently touched");
