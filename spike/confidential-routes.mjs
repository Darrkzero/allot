// Which payout options can a private (confidential) slice reach? Dry-run quotes only: nothing moves.
//   node --env-file=.env spike/confidential-routes.mjs
const BASE = (process.env.NEAR_INTENTS_AGENT_API_URL || "").replace(/\/$/, "");
const API_KEY = (process.env.NEAR_INTENTS_AGENT_API_KEY || "").trim();
const state = JSON.parse((await import("node:fs")).readFileSync(new URL("./.spike-state.json", import.meta.url), "utf8"));
const USDC_BASE = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";

const tokens = await (await fetch("https://1click.chaindefuser.com/v0/tokens")).json();
const OPTIONS = [
  ...["base", "arb", "eth", "op", "pol", "avax", "sol", "near"].map((c) => ["USDC", c]),
  ...["tron", "bsc", "eth", "sol", "ton", "pol", "near"].map((c) => ["USDT", c]),
  ["BTC", "btc"], ...["base", "arb", "eth", "op"].map((c) => ["ETH", c]), ["SOL", "sol"], ["ZEC", "zec"],
];

async function swap(dest, confidential, amount) {
  const res = await fetch(`${BASE}/v1/agents/${state.agentId}/swap`, {
    method: "POST",
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ origin_asset: USDC_BASE, destination_asset: dest, amount, confidential, dry: true }),
  });
  const j = await res.json().catch(() => ({}));
  return res.ok ? `ok (fee ${j.fee?.percent ?? "?"}%)` : j.errors?.[0]?.code ?? res.status;
}

console.log("option".padEnd(16), "public $50".padEnd(22), "private $50".padEnd(22), "private $200");
for (const [sym, chain] of OPTIONS) {
  const t = tokens.find((x) => x.symbol === sym && x.blockchain === chain);
  if (!t) { console.log(`${sym} on ${chain}`.padEnd(16), "not listed"); continue; }
  if (t.assetId === USDC_BASE) { console.log(`${sym} on ${chain}`.padEnd(16), "(settlement asset: no swap needed)"); continue; }
  const [pub, priv, priv200] = await Promise.all([swap(t.assetId, false, "50000000"), swap(t.assetId, true, "50000000"), swap(t.assetId, true, "200000000")]);
  console.log(`${sym} on ${chain}`.padEnd(16), String(pub).padEnd(22), String(priv).padEnd(22), priv200);
}
