// Private-slice test: can a policy-locked Agent API wallet route a slice through
// NEAR Confidential Intents (shield -> confidential swap/withdraw), still locked to the owner's addresses?
// Reuses the THROWAWAY test wallet from agent-policy-test.mjs (throwaway owner key, zero balance:
// nothing can move). Run from the project root:
//   node --env-file=.env spike/confidential-test.mjs
//
//   C0 shield while policy.confidential = false        (expect: blocked by policy)
//   -- owner signs policy_update with confidential = true --
//   C1 LIVE shield 1 USDC                               (expect: passes policy, fails only on balance)
//   C2 dry confidential withdraw -> allowed address      (expect: preview)
//   C3 LIVE confidential withdraw -> stranger            (expect: BLOCKED by destination policy)
//   C4 dry confidential swap USDC -> BTC                 (expect: quote)
//   C5 confidential balances                             (expect: empty list)

import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { privateKeyToAccount } from "viem/accounts";

const BASE = (process.env.NEAR_INTENTS_AGENT_API_URL || "").replace(/\/$/, "");
const API_KEY = (process.env.NEAR_INTENTS_AGENT_API_KEY || "").trim();
if (!BASE || !API_KEY) throw new Error("Set NEAR_INTENTS_AGENT_API_URL and NEAR_INTENTS_AGENT_API_KEY in .env");

const STATE_FILE = new URL("./.spike-state.json", import.meta.url);
const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
if (!state.agentId || !state.grantToken) throw new Error("Run agent-policy-test.mjs first (it creates the throwaway test wallet).");

const owner = privateKeyToAccount(state.ownerPk);
const allowed = privateKeyToAccount(state.allowedPk).address.toLowerCase();
const stranger = privateKeyToAccount(state.strangerPk).address.toLowerCase();
const agentId = state.agentId;
const USDC_BASE = "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
const BTC = "nep141:btc.omft.near";

const log = (...a) => console.log(...a);
const short = (o) => JSON.stringify(o).slice(0, 700);

async function api(method, path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { "X-API-Key": API_KEY, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}

const grantHeaders = () => ({ "X-Grant-Token": state.grantToken, "Idempotency-Key": randomUUID() });
const result = (label, r) => {
  const err = r.json?.errors?.[0];
  log(`\n== ${label}\n   HTTP ${r.status} ${err ? `${err.code}: ${err.detail ?? err.title}` : short(r.json)}`);
  return r;
};

async function signIntent(intent) {
  if (intent.standard !== "eip712") throw new Error(`Unexpected signing standard: ${intent.standard}`);
  const { domain, types, primaryType, message } = intent.payload;
  const { EIP712Domain, ...rest } = types;
  const signature = await owner.signTypedData({ domain, types: rest, primaryType, message });
  return { standard: "eip712", payload: intent.payload, signature };
}

async function waitFinal(correlationId) {
  for (let i = 0; i < 12; i++) {
    const st = await api("GET", `/v1/status?correlation_id=${correlationId}&wait_ms=20000`);
    const s = st.json?.status;
    if (s && !/PENDING|PROCESSING|SUBMITTED|QUEUED|RUNNING/.test(s)) return st.json;
    log(`   ...status ${s ?? st.status}`);
  }
  throw new Error("Timed out waiting for final status");
}

// ---------- C0: confidential is off -> shield must be refused ----------
let pol = await api("GET", `/v1/agents/${agentId}/policy`);
log(`Policy now: revision=${pol.json?.revision} confidential=${pol.json?.policy?.confidential ?? pol.json?.applied?.confidential}`);
const current = pol.json?.policy ?? pol.json?.applied ?? pol.json?.desired;
if (!current) throw new Error(`Could not read policy: ${short(pol.json)}`);

if (!current.confidential) {
  result("C0 LIVE shield 1 USDC while confidential=false (should be BLOCKED by policy)",
    await api("POST", `/v1/agents/${agentId}/shield`, { asset: USDC_BASE, amount: "1000000" }, grantHeaders()));

  // ---------- owner switches confidential on ----------
  log("\n== policy_update: confidential=true (owner signs with the throwaway key)");
  const gen = await api("POST", "/v1/generate-intent",
    { type: "policy_update", agent_id: agentId, policy: { ...current, confidential: true }, expected_revision: pol.json.revision },
    { "Idempotency-Key": randomUUID() });
  if (gen.status >= 300) throw new Error(`generate-intent ${gen.status}: ${short(gen.json)}`);
  log(`   owner sees: ${gen.json.preview?.summary ?? "(no summary)"}`);
  const sub = await api("POST", "/v1/submit-intent", { type: "policy_update", correlation_id: gen.json.correlation_id, signed_data: await signIntent(gen.json.intent) });
  if (sub.status >= 300) throw new Error(`submit-intent ${sub.status}: ${short(sub.json)}`);
  const final = await waitFinal(gen.json.correlation_id);
  log(`   final: ${final.status}${final.failure_code ? " (" + final.failure_code + ")" : ""}`);
  pol = await api("GET", `/v1/agents/${agentId}/policy`);
}
log(`\nPolicy: revision=${pol.json?.revision} status=${pol.json?.status} synced=${pol.json?.provider_policy_synced} confidential=${(pol.json?.policy ?? pol.json?.applied)?.confidential}`);

// ---------- C1..C5 ----------
result("C1 LIVE shield 1 USDC (should pass policy, fail only on balance)",
  await api("POST", `/v1/agents/${agentId}/shield`, { asset: USDC_BASE, amount: "1000000" }, grantHeaders()));
result("C2 dry confidential withdraw 1 USDC -> allowed address",
  await api("POST", `/v1/agents/${agentId}/withdraw`, { asset: USDC_BASE, amount: "1000000", chain: "base", recipient: allowed, confidential: true, dry: true }, grantHeaders()));
result("C3 LIVE confidential withdraw 1 USDC -> stranger (should be BLOCKED by destination policy)",
  await api("POST", `/v1/agents/${agentId}/withdraw`, { asset: USDC_BASE, amount: "1000000", chain: "base", recipient: stranger, confidential: true }, grantHeaders()));
result("C4 dry confidential swap 10 USDC -> BTC",
  await api("POST", `/v1/agents/${agentId}/swap`, { origin_asset: USDC_BASE, destination_asset: BTC, amount: "10000000", confidential: true, dry: true }));
result("C5 confidential balances", await api("GET", `/v1/agents/${agentId}/balances?source=confidential`));
