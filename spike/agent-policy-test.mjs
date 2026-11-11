// Day-0 test: can a policy-locked Agent API wallet do our auto-split safely?
// Uses a THROWAWAY EVM owner key generated here (no real wallet, no funds).
// Run from the project root:
//   node --env-file=.env spike/agent-policy-test.mjs
//
// Steps: create agent (owner signs policy) -> issue grant (owner signs) ->
//   T1 dry withdraw to an allowed address   (expect: preview)
//   T2 live withdraw to a NOT-allowed address (expect: blocked by policy)
//   T3 live withdraw to the allowed address   (expect: passes policy, fails only for lack of funds)

import { randomBytes, createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const BASE = (process.env.NEAR_INTENTS_AGENT_API_URL || "").replace(/\/$/, "");
const API_KEY = (process.env.NEAR_INTENTS_AGENT_API_KEY || "").trim();
if (!BASE || !API_KEY) throw new Error("Set NEAR_INTENTS_AGENT_API_URL and NEAR_INTENTS_AGENT_API_KEY in .env");

// Throwaway keys + progress live here (git-ignored).
const STATE_FILE = new URL("./.spike-state.json", import.meta.url);
const state = fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, "utf8")) : {};
const save = () => fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

state.ownerPk ??= generatePrivateKey();
state.allowedPk ??= generatePrivateKey();
state.strangerPk ??= generatePrivateKey();
save();

const owner = privateKeyToAccount(state.ownerPk);
const allowed = privateKeyToAccount(state.allowedPk).address.toLowerCase(); // the "approved" payout address
const stranger = privateKeyToAccount(state.strangerPk).address.toLowerCase(); // an address the owner never approved

const log = (...a) => console.log(...a);
const short = (o) => JSON.stringify(o).slice(0, 600);

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

async function signIntent(intent) {
  if (intent.standard !== "eip712") throw new Error(`Unexpected signing standard: ${intent.standard}`);
  const { domain, types, primaryType, message } = intent.payload;
  const { EIP712Domain, ...rest } = types; // viem derives the domain type itself
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

async function ownerAction(body, label) {
  log(`\n== ${label}`);
  const gen = await api("POST", "/v1/generate-intent", body, { "Idempotency-Key": randomUUID() });
  if (gen.status >= 300) throw new Error(`generate-intent ${gen.status}: ${short(gen.json)}`);
  const { intent, correlation_id, agent_id, preview } = gen.json;
  log(`   owner sees: ${preview?.summary ?? "(no summary)"}`);
  const signed_data = await signIntent(intent);
  const sub = await api("POST", "/v1/submit-intent", { type: body.type, correlation_id, signed_data });
  if (sub.status >= 300) throw new Error(`submit-intent ${sub.status}: ${short(sub.json)}`);
  const final = await waitFinal(correlation_id);
  log(`   final: ${final.status}${final.failure_code ? " (" + final.failure_code + ")" : ""}`);
  if (final.status !== "SUCCESS") throw new Error(`Owner action failed: ${short(final)}`);
  return { agent_id, final };
}

// ---------- 1. Create the agent with a destination-locked policy ----------
log(`Owner (throwaway): ${owner.address}`);
log(`Allowed payout address: ${allowed}`);
log(`Stranger address:       ${stranger}`);

const policy = {
  frozen: false,
  actions: ["swap", "transfer", "withdraw"],
  confidential: false,
  owner_approval: false,
  assets: "any",
  limits: {},
  max_actions_per_hour: 60,
  destinations: { mode: "only", list: [{ action: "withdraw", chain: "base", address: allowed, memo: null }] },
  budget: { daily_usd: "100", weekly_usd: null, monthly_usd: null },
  timelock_ms: 0,
};

if (!state.agentId) {
  const { agent_id } = await ownerAction(
    {
      type: "agent_create",
      name: "allot-spike",
      owner: { type: "evm", address: owner.address.toLowerCase(), chain_id: 1, public_key: "0x" + owner.publicKey.slice(4) }, // API wants 64-byte key without the 04 prefix
      policy,
    },
    "agent_create (owner signs the policy)"
  );
  state.agentId = agent_id;
  save();
}
const agentId = state.agentId;
const agent = await api("GET", `/v1/agents/${agentId}`);
log(`\nAgent ${agentId.slice(0, 12)}...  status=${agent.json?.status}  intents account=${agent.json?.wallet?.near_account_id}`);
const pol = await api("GET", `/v1/agents/${agentId}/policy`);
log(`Policy: status=${pol.json?.status} synced=${pol.json?.provider_policy_synced} revision=${pol.json?.revision}`);

// ---------- 2. Issue a grant (lets our backend act within the policy) ----------
if (!state.grantToken) {
  const token = `ngt_${randomBytes(32).toString("base64url")}`;
  const credential = createHash("sha256").update(token, "utf8").digest("hex");
  const expires = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().replace(/\.\d+Z$/, "Z");
  await ownerAction(
    { type: "grant_issue", agent_id: agentId, label: "allot-split-engine", credential, expires_at: expires },
    "grant_issue (owner signs the backend's permission)"
  );
  state.grantToken = token;
  save();
}

// ---------- 3. The tests ----------
const tokens = await api("GET", "/v1/tokens");
const list = Array.isArray(tokens.json) ? tokens.json : tokens.json?.data ?? tokens.json?.tokens ?? [];
const usdcBase = list.find((t) => t.symbol === "USDC" && /base/i.test(t.blockchain ?? t.chain ?? ""));
const asset = usdcBase?.asset_id ?? usdcBase?.assetId ?? "nep141:base-0x833589fcd6edb6e08f4c7c32d4f71b54bda02913.omft.near";
log(`\nAsset used: ${asset}`);

async function withdraw(label, recipient, dry) {
  const r = await api(
    "POST",
    `/v1/agents/${agentId}/withdraw`,
    { asset, amount: "1000000", chain: "base", recipient, dry },
    { "X-Grant-Token": state.grantToken, "Idempotency-Key": randomUUID() }
  );
  const err = r.json?.errors?.[0];
  log(`\n== ${label}\n   HTTP ${r.status} ${err ? `${err.code}: ${err.detail ?? err.title}` : short(r.json)}`);
  return r;
}

await withdraw("T1 dry-run withdraw 1 USDC -> allowed address", allowed, true);
await withdraw("T2 LIVE withdraw 1 USDC -> stranger (should be BLOCKED by policy)", stranger, false);
await withdraw("T3 LIVE withdraw 1 USDC -> allowed (should pass policy, fail only on balance)", allowed, false);
