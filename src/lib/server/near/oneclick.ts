import "server-only";
import { env } from "../env";

// NEAR Intents 1Click API: https://docs.near-intents.org/integration/distribution-channels/1click-api
const BASE = "https://1click.chaindefuser.com/v0";

export type OneClickToken = {
  assetId: string;
  decimals: number;
  blockchain: string;
  symbol: string;
  price: number;
};

let tokenCache: { at: number; tokens: OneClickToken[] } | null = null;

export async function getTokens(): Promise<OneClickToken[]> {
  if (tokenCache && Date.now() - tokenCache.at < 5 * 60_000) return tokenCache.tokens;
  const res = await fetch(`${BASE}/tokens`, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`1Click tokens: HTTP ${res.status}`);
  const tokens = (await res.json()) as OneClickToken[];
  tokenCache = { at: Date.now(), tokens };
  return tokens;
}

export type QuoteRequest = {
  dry: boolean;
  swapType: "EXACT_INPUT" | "EXACT_OUTPUT";
  slippageTolerance: number; // basis points
  originAsset: string;
  depositType: "ORIGIN_CHAIN" | "INTENTS";
  destinationAsset: string;
  amount: string; // atomic units
  recipient: string;
  recipientType: "DESTINATION_CHAIN" | "INTENTS";
  refundTo: string;
  refundType: "ORIGIN_CHAIN" | "INTENTS";
  deadline: string;
  referral?: string;
};

export type Quote = {
  depositAddress?: string;
  depositMemo?: string;
  amountIn: string;
  amountInFormatted: string;
  amountInUsd?: string;
  minAmountIn?: string;
  amountOut: string;
  amountOutFormatted: string;
  amountOutUsd?: string;
  deadline?: string;
  timeEstimate?: number;
};

export class OneClickError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

// 1Click's quote service sometimes stalls: every request then hangs ~25 s and fails with a 5xx.
// After one such failure, price previews skip 1Click for a minute (quotesDown) instead of each
// waiting it out. Any successful quote clears it. Real payment quotes always try.
const OUTAGE_MS = 60_000;
// Kept on globalThis: route handlers can each get their own copy of this module (seen in dev), and an
// outage is a fact about 1Click, not about one route.
const outage = ((globalThis as { __allotQuoteOutage?: { until: number } }).__allotQuoteOutage ??= { until: 0 });
export const quotesDown = () => Date.now() < outage.until;

export async function requestQuote(req: QuoteRequest, { timeoutMs = 30_000 } = {}): Promise<{ quote: Quote; raw: unknown }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.oneClickKey) headers.Authorization = `Bearer ${env.oneClickKey}`;
  let res: Response;
  try {
    res = await fetch(`${BASE}/quote`, { method: "POST", headers, body: JSON.stringify(req), cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    outage.until = Date.now() + OUTAGE_MS;
    throw new OneClickError(e instanceof Error && e.name === "TimeoutError" ? "Quote timed out" : "Quote service unreachable", 503);
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.quote) {
    if (res.status >= 500) outage.until = Date.now() + OUTAGE_MS;
    throw new OneClickError(json.message || `Quote failed (HTTP ${res.status})`, res.status);
  }
  outage.until = 0;
  return { quote: json.quote as Quote, raw: json };
}

export type SwapStatus =
  | "PENDING_DEPOSIT" | "KNOWN_DEPOSIT_TX" | "PROCESSING" | "SUCCESS"
  | "INCOMPLETE_DEPOSIT" | "REFUNDED" | "FAILED";

export async function getStatus(depositAddress: string, depositMemo?: string) {
  const qs = new URLSearchParams({ depositAddress });
  if (depositMemo) qs.set("depositMemo", depositMemo);
  const headers: Record<string, string> = {};
  if (env.oneClickKey) headers.Authorization = `Bearer ${env.oneClickKey}`;
  const res = await fetch(`${BASE}/status?${qs}`, { headers, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new OneClickError(json.message || `Status failed (HTTP ${res.status})`, res.status);
  return json as {
    status: SwapStatus;
    updatedAt?: string;
    swapDetails?: {
      amountOut?: string;
      amountOutFormatted?: string;
      originChainTxHashes?: { hash: string; explorerUrl?: string }[];
      destinationChainTxHashes?: { hash: string; explorerUrl?: string }[];
      refundedAmountFormatted?: string;
    };
  };
}
