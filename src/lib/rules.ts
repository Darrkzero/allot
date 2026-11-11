// Split rules: the recipient's instructions for every incoming payment.
// Shared by client and server.

import { CHAIN_NAMES, checkAddress, PAYOUT_OPTIONS, privateSupported, type ChainId } from "./assets";

export type Rule = {
  label: string; // e.g. "Spending"
  percent: number; // whole percent, all rules sum to 100
  symbol: string; // payout token, e.g. "USDC"
  chain: ChainId; // payout chain, e.g. "base"
  address: string; // recipient's own address on that chain
  private?: boolean; // route this slice through NEAR Confidential Intents
};

/** What a payer may see of a rule. A private slice shows only its share. */
export type PublicRule = { label: string; percent: number; symbol: string; chain: ChainId | ""; private: boolean };
export const publicRule = (r: Rule): PublicRule =>
  r.private
    ? { label: "Private", percent: r.percent, symbol: "", chain: "", private: true }
    : { label: r.label, percent: r.percent, symbol: r.symbol, chain: r.chain, private: false };

export const MAX_RULES = 5;

export type RulesCheck = { ok: true; rules: Rule[] } | { ok: false; errors: string[] };

export function validateRules(input: unknown): RulesCheck {
  const errors: string[] = [];
  if (!Array.isArray(input) || input.length === 0) return { ok: false, errors: ["Add at least one pot."] };
  if (input.length > MAX_RULES) return { ok: false, errors: [`You can have up to ${MAX_RULES} pots.`] };

  const rules: Rule[] = [];
  input.forEach((r: Partial<Rule>, i) => {
    const label = String(r?.label ?? "").trim();
    const n = label ? `"${label.slice(0, 40)}" pot` : `Pot ${i + 1}`;
    const percent = Number(r?.percent);
    if (!label || label.length > 40) errors.push(`${n}: give it a name of up to 40 characters.`);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100) errors.push(`${n}: its share must be a whole number from 1 to 100%.`);
    const option = PAYOUT_OPTIONS.find((o) => o.symbol === r?.symbol && o.chain === r?.chain);
    if (!option) {
      errors.push(`${n}: choose how you want it paid out.`);
      return;
    }
    const addr = checkAddress(option.chain, String(r?.address ?? ""));
    if (!addr.ok) errors.push(`${n}: ${addr.error}`);
    const isPrivate = r?.private === true;
    if (isPrivate && !privateSupported(option.chain)) errors.push(`${n}: private pots can't pay out to ${CHAIN_NAMES[option.chain]} yet. Switch "Private" off or pick another network.`);
    rules.push({ label, percent, symbol: option.symbol, chain: option.chain, address: addr.ok ? addr.address : "", private: isPrivate });
  });

  const total = rules.reduce((s, r) => s + (Number.isFinite(r.percent) ? r.percent : 0), 0);
  if (total !== 100) errors.push(`Your pots add up to ${total}%. Adjust the shares so they total exactly 100%.`);
  return errors.length ? { ok: false, errors } : { ok: true, rules };
}

export const HANDLE_RE = /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/;

/** Splits an atomic amount by rule percentages; rounding dust goes to the largest rule. */
export function splitAmount(totalAtomic: bigint, rules: Rule[]): bigint[] {
  const parts = rules.map((r) => (totalAtomic * BigInt(r.percent)) / 100n);
  const dust = totalAtomic - parts.reduce((a, b) => a + b, 0n);
  const largest = rules.reduce((best, r, i) => (r.percent > rules[best].percent ? i : best), 0);
  parts[largest] += dust;
  return parts;
}
