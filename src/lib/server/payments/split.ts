import "server-only";
import { SETTLE_ASSET } from "../../assets";
import { splitAmount, type Rule } from "../../rules";
import { AgentApiError, agentAction, getBalances, getExecution, REVIEW_STATUSES, type Execution } from "../near/agent-api";
import { getLegs, getPayment, getRouter, insertLegs, updateLeg, type LegRow, type PaymentRow } from "../db";
import { payoutAsset } from "../near/payout-asset";
import { unseal } from "../seal";

/**
 * The split engine. Once a payment has landed in the recipient's policy-locked
 * NEAR Intents account (1Click status SUCCESS), each rule becomes a "leg":
 *   same asset as settlement -> withdraw directly to the rule's chain + address
 *   different asset          -> swap inside the account, then withdraw what the swap delivered
 * A private leg first shields its USDC into the account's confidential balance (NEAR
 * Confidential Intents, on intents.far), then swaps and withdraws from there with
 * `confidential: true`, so its route to the payout address stays off the public NEAR chain.
 * Every call carries a deterministic Idempotency-Key, so a duplicate trigger replays the
 * original result instead of moving funds twice. Our grant can't send anywhere outside the
 * owner's policy destinations, so a bug or breach here can't redirect funds.
 */

const FINAL_OK = "SUCCESS";
const FINAL_BAD = new Set(["FAILED", "REFUNDED"]);
// Errors that usually clear on their own (e.g. the deposit not yet spendable).
const RETRYABLE = new Set(["insufficient_balance", "policy_usage_unavailable", "rate_limited", "provider_unavailable"]);
// Retries are paced per slice, not per caller: however many pages poll (payer, dashboard, sweeper),
// a slice that just errored waits MIN_RETRY_GAP_MS before its next attempt. So MAX_ATTEMPTS is a
// real time window (60 x 5 s = at least 5 minutes) that extra viewers or a spammed endpoint can't burn.
const MIN_RETRY_GAP_MS = 5_000;
const MAX_ATTEMPTS = 60;
// An execution NEAR Intents paused for review resumes on its own; check on it gently, never fail it.
const REVIEW_POLL_MS = 60_000;
const REVIEW_NOTE = "Paused for review by NEAR Intents. Your funds are safe in your wallet; this resumes on its own.";

const running = new Map<string, Promise<LegRow[]>>();

/** Advances the split for one payment. Safe to call repeatedly and concurrently. */
export function processPayment(paymentId: string): Promise<LegRow[]> {
  const inFlight = running.get(paymentId);
  if (inFlight) return inFlight;
  const p = run(paymentId).finally(() => running.delete(paymentId));
  running.set(paymentId, p);
  return p;
}

async function run(paymentId: string): Promise<LegRow[]> {
  const payment = getPayment(paymentId);
  if (!payment || payment.status !== "SUCCESS") return payment ? getLegs(paymentId) : [];
  const router = getRouter(payment.handle);
  if (!router?.agent_id || !router.grant_sealed) return getLegs(paymentId);

  if (getLegs(paymentId).length === 0) await createLegs(payment, router.rules);

  const grant = unseal(router.grant_sealed);
  for (const leg of getLegs(paymentId)) {
    if (leg.phase === "done" || leg.phase === "failed") continue;
    const gap = REVIEW_STATUSES.has(leg.agent_status ?? "") ? REVIEW_POLL_MS : MIN_RETRY_GAP_MS;
    if (leg.error && Date.now() - Date.parse(leg.updated_at) < gap) continue; // paced retry / review check
    try {
      await advance(router.agent_id, grant, leg);
    } catch (e) {
      const api = e instanceof AgentApiError ? e : null;
      const attempts = leg.attempts + 1;
      // Network errors, timeouts, 429 and 5xx: outcome unknown → retry with the SAME key (can't double-send).
      const unknownOutcome = !api || api.status === 429 || api.status >= 500;
      // A 4xx rejection means "nothing was submitted or charged" → a FRESH key is safe, and needed,
      // so a replay of the cached rejection doesn't block the retry once funds are spendable.
      const definitiveReject = !!api && !unknownOutcome;
      const retry = unknownOutcome || (api?.code !== undefined && RETRYABLE.has(api.code));
      updateLeg(leg.id, {
        attempts,
        error: e instanceof Error ? e.message : String(e),
        ...(definitiveReject && retry ? { key_n: leg.key_n + 1 } : {}),
        ...(retry && attempts < MAX_ATTEMPTS ? {} : { phase: "failed" as const }),
      });
    }
  }
  return getLegs(paymentId);
}

async function createLegs(payment: PaymentRow, rules: Rule[]) {
  const detail = payment.detail ? JSON.parse(payment.detail) : null;
  // What actually landed (1Click reports atomic amountOut); fall back to the quoted exact output.
  const delivered = BigInt(detail?.swapDetails?.amountOut || payment.amount_out);
  const parts = splitAmount(delivered, rules);
  const assets = await Promise.all(rules.map((r) => payoutAsset(r.symbol, r.chain)));
  insertLegs(
    rules.map((r, idx) => {
      const assetId = assets[idx] ?? SETTLE_ASSET.assetId;
      const direct = assetId === SETTLE_ASSET.assetId;
      return {
        id: `${payment.id}:${idx}`,
        payment_id: payment.id,
        idx,
        label: r.label,
        percent: r.percent,
        symbol: r.symbol,
        chain: r.chain,
        address: r.address,
        target_asset: assetId,
        amount_settle: parts[idx].toString(),
        private: r.private ? 1 : 0,
        phase: r.private ? "shield" : direct ? "withdraw" : "swap",
        withdraw_amount: direct && !r.private ? parts[idx].toString() : null,
      };
    })
  );
}

/**
 * What an execution delivered. Without an exact figure, its guaranteed minimum, never the amount
 * requested: the wallet's balance is shared by all payments, so spending more than actually
 * arrived would take another payment's money. (Any difference stays in the wallet as dust.)
 */
const deliveredAmount = (ex: Execution) => ex.details?.amount_out || ex.details?.delivered || ex.details?.min_amount_out || null;

/**
 * Last resort for a shield that reports no output: what is actually spendable as USDC in the
 * confidential balance, capped at this slice. Throws (so the engine retries) while it's still 0.
 */
async function confidentialAvailable(agentId: string, cap: string): Promise<string> {
  const b = (await getBalances(agentId, "confidential")) as { balances?: { asset_id?: string; available_raw?: string }[] };
  const row = b.balances?.find((x) => x.asset_id === SETTLE_ASSET.assetId || x.asset_id?.endsWith(`:${SETTLE_ASSET.assetId}`));
  const have = BigInt(row?.available_raw ?? "0");
  if (have === 0n) throw new Error("Shield finished but nothing is spendable in the confidential balance yet");
  const want = BigInt(cap);
  return (have < want ? have : want).toString();
}

/**
 * Reads an execution's status and records it on the slice. Returns null while NEAR Intents has it
 * paused for review: the slice is noted (and then checked every REVIEW_POLL_MS, with `refresh`
 * for NEEDS_REVIEW, which stops the API's own polling) and stays in its phase, never failed.
 */
async function observe(leg: LegRow, corr: string): Promise<Execution | null> {
  const ex = await getExecution(corr, leg.agent_status === "NEEDS_REVIEW");
  if (REVIEW_STATUSES.has(ex.status)) {
    updateLeg(leg.id, { agent_status: ex.status, error: REVIEW_NOTE });
    return null;
  }
  updateLeg(leg.id, { agent_status: ex.status, error: null });
  return ex;
}

async function advance(agentId: string, grant: string, leg: LegRow) {
  const confidential = leg.private === 1;

  if (leg.phase === "shield") {
    if (!leg.shield_corr) {
      const ex = await agentAction<Execution>(
        agentId,
        "shield",
        { asset: SETTLE_ASSET.assetId, amount: leg.amount_settle },
        grant,
        `allot:${leg.id}:shield:${leg.key_n}`
      );
      updateLeg(leg.id, { shield_corr: ex.correlation_id, agent_status: ex.status, error: null });
      leg = { ...leg, shield_corr: ex.correlation_id };
    }
    const ex = await observe(leg, leg.shield_corr!);
    if (!ex) return; // paused for review
    if (ex.status === FINAL_OK) {
      // What reached the confidential balance: as reported, else what is actually spendable there.
      const shielded = deliveredAmount(ex) ?? (await confidentialAvailable(agentId, leg.amount_settle));
      const direct = leg.target_asset === SETTLE_ASSET.assetId;
      const next = direct ? "withdraw" : "swap";
      updateLeg(leg.id, { phase: next, shield_out: shielded, withdraw_amount: direct ? shielded : null, error: null });
      leg = { ...leg, phase: next, shield_out: shielded, withdraw_amount: direct ? shielded : null };
    } else if (FINAL_BAD.has(ex.status)) {
      updateLeg(leg.id, { phase: "failed", error: `Shield ${ex.status.toLowerCase()}: ${ex.details?.failure_reason ?? ex.failure_code ?? "unknown"}` });
      return;
    } else return; // still running; next poll continues
  }

  if (leg.phase === "swap") {
    if (!leg.swap_corr) {
      const ex = await agentAction<Execution>(
        agentId,
        "swap",
        {
          origin_asset: SETTLE_ASSET.assetId,
          destination_asset: leg.target_asset,
          amount: leg.shield_out ?? leg.amount_settle,
          ...(confidential ? { confidential: true } : {}),
        },
        grant,
        `allot:${leg.id}:swap:${leg.key_n}`
      );
      updateLeg(leg.id, { swap_corr: ex.correlation_id, agent_status: ex.status, error: null });
      leg = { ...leg, swap_corr: ex.correlation_id };
    }
    const ex = await observe(leg, leg.swap_corr!);
    if (!ex) return; // paused for review
    if (ex.status === FINAL_OK) {
      const out = deliveredAmount(ex);
      if (!out) throw new Error("Swap finished but reported no output amount");
      updateLeg(leg.id, { phase: "withdraw", swap_out: out, withdraw_amount: out, error: null });
      leg = { ...leg, phase: "withdraw", withdraw_amount: out };
    } else if (FINAL_BAD.has(ex.status)) {
      updateLeg(leg.id, { phase: "failed", error: `Swap ${ex.status.toLowerCase()}: ${ex.details?.failure_reason ?? ex.failure_code ?? "unknown"}` });
      return;
    } else return; // still running; next poll continues
  }

  if (leg.phase === "withdraw") {
    if (!leg.withdraw_corr) {
      const ex = await agentAction<Execution>(
        agentId,
        "withdraw",
        {
          asset: leg.target_asset,
          amount: leg.withdraw_amount,
          chain: leg.chain,
          recipient: leg.address,
          ...(confidential ? { confidential: true } : {}),
        },
        grant,
        `allot:${leg.id}:withdraw:${leg.key_n}`
      );
      updateLeg(leg.id, { withdraw_corr: ex.correlation_id, agent_status: ex.status, error: null });
      leg = { ...leg, withdraw_corr: ex.correlation_id };
    }
    const ex = await observe(leg, leg.withdraw_corr!);
    if (!ex) return; // paused for review
    updateLeg(leg.id, { tx_hash: ex.details?.tx_hash ?? null, dest_tx_hash: ex.details?.destination_tx_hash ?? null });
    if (ex.status === FINAL_OK) updateLeg(leg.id, { phase: "done", error: null });
    else if (FINAL_BAD.has(ex.status)) {
      updateLeg(leg.id, { phase: "failed", error: `Withdrawal ${ex.status.toLowerCase()}: ${ex.details?.failure_reason ?? ex.failure_code ?? "unknown"}` });
    }
  }
}

/**
 * Display view of legs. Payers see labels, shares and progress only, and for a private
 * slice not even its label, token or chain; the owner also sees where each slice went
 * and the transaction hashes.
 */
export function legView(legs: LegRow[], forOwner = false) {
  return legs.map((l) => ({
    ...(l.private && !forOwner
      ? { label: "Private", symbol: "", chain: "" }
      : { label: l.label, symbol: l.symbol, chain: l.chain }),
    private: l.private === 1,
    review: REVIEW_STATUSES.has(l.agent_status ?? ""), // paused by NEAR Intents for review
    percent: l.percent,
    amountUsdc: Number(l.amount_settle) / 10 ** SETTLE_ASSET.decimals,
    phase: l.phase,
    ...(forOwner
      ? {
          to: l.address,
          status: l.agent_status,
          txHash: l.tx_hash,
          destTx: l.dest_tx_hash,
          error: l.error,
        }
      : {}),
  }));
}
