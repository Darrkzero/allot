import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "../env";

// NEAR Intents Agent API: policy-bound wallets. Spec: <AGENT_API_URL>/openapi.json

export class AgentApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function call<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(env.agentApiUrl + path, {
    method,
    headers: { "X-API-Key": env.agentApiKey, "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
    // Long-polls use wait_ms=15000; anything slower is a hung connection. A timeout surfaces as a
    // non-API error, which the split engine treats as "outcome unknown" and retries with the same key.
    signal: AbortSignal.timeout(45_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = json?.errors?.[0];
    throw new AgentApiError(e ? `${e.code}: ${e.detail ?? e.title}` : `HTTP ${res.status}`, res.status, e?.code);
  }
  return json as T;
}

export type PasskeyOwner = { type: "passkey"; credential_id: string; public_key: string; rp_id: string; origin: string };

export type Policy = {
  frozen: boolean;
  actions: ("swap" | "transfer" | "withdraw")[];
  confidential: boolean;
  owner_approval: boolean;
  assets: "any" | string[];
  limits: Record<string, never> | Record<string, Record<string, string>>;
  max_actions_per_hour: number | null;
  destinations: {
    mode: "only";
    list: { action: "withdraw"; chain: string; address: string; memo: null }[];
  };
  budget: { daily_usd: string | null; weekly_usd: string | null; monthly_usd: string | null };
  timelock_ms: number;
};

export type OwnerIntent = {
  correlation_id: string;
  agent_id: string;
  status: string;
  expires_at: string;
  intent: { standard: string; payload: Record<string, unknown> };
  preview: { summary: string };
};

export function generateIntent(body: Record<string, unknown>) {
  return call<OwnerIntent>("POST", "/v1/generate-intent", body, { "Idempotency-Key": randomUUID() });
}

export function submitIntent(type: string, correlation_id: string, signed_data: unknown) {
  return call<{ status: string }>("POST", "/v1/submit-intent", { type, correlation_id, signed_data });
}

export type IntentStatus = { status: string; failure_code?: string; [k: string]: unknown };

const NON_FINAL = /PENDING|PROCESSING|SUBMITTED|QUEUED|RUNNING/;
export const isFinalStatus = (s: string) => !NON_FINAL.test(s);

/**
 * Submits an owner signature only if this intent is still waiting for one. A retry (after a
 * timeout, or a failure later in the same step) re-signs with a new passkey assertion, and the
 * API is only idempotent for the *same* signature, so we must not submit a second one.
 */
export async function submitIntentOnce(type: string, correlation_id: string, signed_data: unknown) {
  const current = await call<IntentStatus>("GET", `/v1/status?correlation_id=${encodeURIComponent(correlation_id)}`).catch(() => null);
  if (current && current.status !== "PENDING_SIGNATURE") return;
  await submitIntent(type, correlation_id, signed_data);
}

export async function waitForStatus(correlationId: string, maxRounds = 8): Promise<IntentStatus> {
  let last: IntentStatus = { status: "UNKNOWN" };
  for (let i = 0; i < maxRounds; i++) {
    last = await call<IntentStatus>("GET", `/v1/status?correlation_id=${encodeURIComponent(correlationId)}&wait_ms=15000`);
    if (!NON_FINAL.test(last.status)) return last;
  }
  return last;
}

export type Execution = {
  correlation_id: string;
  status: string; // QUEUED | PENDING_APPROVAL | PROCESSING | SUCCESS | REFUNDED | FAILED | UNCERTAIN | NEEDS_REVIEW ...
  failure_code: string | null;
  details?: {
    amount_out?: string | null;
    delivered?: string | null;
    expected_amount_out?: string;
    min_amount_out?: string | null; // the guaranteed minimum output of a quoted route
    tx_hash?: string | null;
    destination_tx_hash?: string | null;
    failure_reason?: string | null;
  };
};

/** Statuses where NEAR Intents has paused an execution for review; it resumes on its own. */
export const REVIEW_STATUSES: ReadonlySet<string> = new Set(["UNCERTAIN", "NEEDS_REVIEW"]);

/**
 * Current state of a shield/swap/withdraw execution (no long-polling). `refresh` asks the API to
 * re-observe the original request: NEEDS_REVIEW stops its routine polling until someone does.
 */
export function getExecution(correlationId: string, refresh = false) {
  return call<Execution>("GET", `/v1/status?correlation_id=${encodeURIComponent(correlationId)}${refresh ? "&refresh=true" : ""}`);
}

export function getAgent(agentId: string) {
  return call<{ id: string; status: string; wallet?: { near_account_id?: string } }>("GET", `/v1/agents/${agentId}`);
}

export function getBalances(agentId: string, source: "public" | "confidential" = "public") {
  return call<unknown>("GET", `/v1/agents/${agentId}/balances?source=${source}`);
}

/** A grant token our backend keeps; the owner signs only its SHA-256 commitment. */
export function newGrantCredential() {
  const token = `ngt_${randomBytes(32).toString("base64url")}`;
  const credential = createHash("sha256").update(token, "utf8").digest("hex");
  return { token, credential };
}

export function agentAction<T>(agentId: string, action: "swap" | "withdraw" | "shield", body: Record<string, unknown>, grantToken: string, idempotencyKey: string) {
  return call<T>("POST", `/v1/agents/${agentId}/${action}`, body, { "X-Grant-Token": grantToken, "Idempotency-Key": idempotencyKey });
}

export function dryAction<T>(agentId: string, action: "swap" | "withdraw", body: Record<string, unknown>, grantToken?: string) {
  const h: Record<string, string> = { "Idempotency-Key": randomUUID() };
  if (grantToken) h["X-Grant-Token"] = grantToken;
  return call<T>("POST", `/v1/agents/${agentId}/${action}`, { ...body, dry: true }, h);
}
