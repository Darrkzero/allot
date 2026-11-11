// Can a private slice be paid out to every option? Dry-run confidential withdraw previews only
// (nothing moves; the test wallet is empty). Previews ignore the destination policy, so the
// well-known public addresses below are used purely as valid recipients for the quote.
//   node --env-file=.env spike/confidential-payouts.mjs
import { randomUUID } from "node:crypto";
import fs from "node:fs";

const BASE = (process.env.NEAR_INTENTS_AGENT_API_URL || "").replace(/\/$/, "");
const API_KEY = (process.env.NEAR_INTENTS_AGENT_API_KEY || "").trim();
const state = JSON.parse(fs.readFileSync(new URL("./.spike-state.json", import.meta.url), "utf8"));
const tokens = await (await fetch("https://1click.chaindefuser.com/v0/tokens")).json();

const EVM = "0xb6a6dded8e7886ecceef0279989090f31ee5f6ad"; // the throwaway "allowed" address from the spike
const ADDR = {
  base: EVM, arb: EVM, eth: EVM, op: EVM, pol: EVM, avax: EVM, bsc: EVM,
  sol: "So11111111111111111111111111111111111111112",
  tron: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
  ton: "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
  near: "wrap.near",
  btc: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  zec: "t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs",
};
const HOLD = { "BTC:btc": "nep141:nbtc.bridge.near" }; // see payout-asset.ts
const OPTIONS = [
  ...["base", "arb", "eth", "op", "pol", "avax", "sol", "near"].map((c) => ["USDC", c]),
  ...["tron", "bsc", "eth", "sol", "ton", "pol", "near"].map((c) => ["USDT", c]),
  ["BTC", "btc"], ...["base", "arb", "eth", "op"].map((c) => ["ETH", c]), ["SOL", "sol"], ["ZEC", "zec"],
];
// Roughly $40 of each asset, in atomic units.
const AMOUNT = { USDC: "40000000", USDT: "40000000", BTC: "50000", ETH: "15000000000000000", SOL: "300000000", ZEC: "8000000" };

async function preview(asset, chain, confidential, sym) {
  const r = await fetch(`${BASE}/v1/agents/${state.agentId}/withdraw`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json", "X-Grant-Token": state.grantToken, "Idempotency-Key": randomUUID() },
    body: JSON.stringify({ asset, amount: AMOUNT[sym], chain, recipient: ADDR[chain], confidential, dry: true }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return `${j.errors?.[0]?.code ?? r.status}`;
  const bad = (j.warnings ?? []).map((w) => w.code).filter((c) => !["insufficient_balance", "policy_destination_denied", "policy_asset_denied"].includes(c));
  return `ok${j.fee?.percent ? ` fee ${j.fee.percent}%` : ""}${j.quote?.time_estimate_seconds ? ` ~${j.quote.time_estimate_seconds}s` : ""}${bad.length ? ` [${bad.join(",")}]` : ""}`;
}

console.log("option".padEnd(15), "public".padEnd(26), "private");
for (const [sym, chain] of OPTIONS) {
  const asset = HOLD[`${sym}:${chain}`] ?? tokens.find((t) => t.symbol === sym && t.blockchain === chain)?.assetId;
  const [pub, priv] = await Promise.all([preview(asset, chain, false, sym), preview(asset, chain, true, sym)]);
  console.log(`${sym} on ${chain}`.padEnd(15), pub.padEnd(26), priv);
}
