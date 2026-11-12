import "server-only";
import { SETTLE_ASSET, toAtomic, type ChainId } from "../../assets";
import { getTokens, OneClickError, quotesDown, requestQuote, type QuoteRequest } from "./oneclick";

/**
 * Live price estimates from 1Click DRY quotes: nothing is created, reserved or sent.
 * Used by demo mode and by the fee preview on /create.
 *
 * A quote needs a recipient. These placeholders only fill that field: the Tron and TON ones are
 * derived from a hash (no one holds their keys), the rest are well-known public addresses.
 * Users' own addresses are never sent here, so estimating a private pot reveals nothing.
 */
const QUOTE_ACCOUNT = "allot-demo.near";
const EVM_SAMPLE = "0x1111111111111111111111111111111111111111";
const SAMPLE_ADDRESS: Record<ChainId, string> = {
  base: EVM_SAMPLE, arb: EVM_SAMPLE, eth: EVM_SAMPLE, op: EVM_SAMPLE, pol: EVM_SAMPLE, avax: EVM_SAMPLE, bsc: EVM_SAMPLE,
  sol: "So11111111111111111111111111111111111111112",
  tron: "TX7dqb6mK7T2yypNDreLZrtT3P9gAQL8Qy",
  ton: "UQBGMEhtD330ZHAYfU2nSlaQrOtbAa4bLCrNiYel4vwA8x66",
  near: "wrap.near",
  btc: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",
  zec: "t1Hsc1LR8yKnbbe3twRp88p6vFfC5t7DLbs",
};

const deadline = () => new Date(Date.now() + 10 * 60_000).toISOString();

// Estimates move slowly; a short cache keeps typing-driven previews cheap.
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  return value;
}

/** A quote for an estimate: skipped while 1Click is down, and given up on sooner than a real payment's. */
function estimateQuote(req: QuoteRequest) {
  if (quotesDown()) return Promise.reject(new OneClickError("Quotes unavailable", 503));
  return requestQuote(req, { timeoutMs: 10_000 });
}

/** True when 1Click itself failed (down, slow, unreachable), not when it rejected this particular route or amount. */
const serviceFailed = (e: unknown) => !(e instanceof OneClickError && e.status >= 400 && e.status < 500);

/** Amount at the market price from 1Click's token list: the fallback while quotes are down. No fees included. */
const atMarket = (usd: number, price: number) => (usd / price).toPrecision(4);

// `approximate`: live quotes were unavailable, so the amount is the market price without fees.
export type PaymentEstimate = { amountIn: string; symbol: string; chain: string; seconds: number | null; approximate?: boolean };

/** What a payer would send, in `originAsset`, for the recipient to receive exactly `amountUsd` USDC. */
export function paymentEstimate(amountUsd: number, originAsset: string): Promise<PaymentEstimate> {
  return cached(`pay:${originAsset}:${amountUsd}`, 20_000, async () => {
    const token = (await getTokens()).find((t) => t.assetId === originAsset);
    if (!token) throw new Error("Unknown currency.");
    try {
      const { quote } = await estimateQuote({
        dry: true,
        swapType: "EXACT_OUTPUT",
        slippageTolerance: 100,
        originAsset,
        depositType: "ORIGIN_CHAIN",
        destinationAsset: SETTLE_ASSET.assetId,
        amount: toAtomic(amountUsd, SETTLE_ASSET.decimals),
        recipient: QUOTE_ACCOUNT,
        recipientType: "INTENTS",
        refundTo: QUOTE_ACCOUNT,
        refundType: "INTENTS",
        deadline: deadline(),
      });
      return { amountIn: quote.amountInFormatted, symbol: token.symbol, chain: token.blockchain, seconds: quote.timeEstimate ?? null };
    } catch (e) {
      if (!serviceFailed(e) || !(token.price > 0)) throw e;
      return { amountIn: atMarket(amountUsd, token.price), symbol: token.symbol, chain: token.blockchain, seconds: null, approximate: true };
    }
  });
}

export type PayoutEstimate = {
  symbol: string;
  chain: string;
  shareUsd: number;
  amountOut: string | null; // what arrives at the pot's wallet, in its token
  amountOutUsd: number | null;
  feePct: number | null;
  seconds: number | null;
  approximate?: boolean; // market price without fees: live quotes were unavailable
};

/** What each pot would actually receive from a payment of `totalUsd`, after conversion and network fees. */
export async function payoutEstimates(totalUsd: number, pots: { symbol: string; chain: ChainId; percent: number }[]): Promise<PayoutEstimate[]> {
  const tokens = await getTokens();
  return Promise.all(
    pots.map(async (p) => {
      const shareUsd = Math.round(totalUsd * p.percent) / 100;
      const empty = { symbol: p.symbol, chain: p.chain, shareUsd, amountOut: null, amountOutUsd: null, feePct: null, seconds: null };
      const target = tokens.find((t) => t.symbol === p.symbol && t.blockchain === p.chain);
      if (!target || shareUsd < 0.5) return empty;
      try {
        return await cached(`payout:${target.assetId}:${shareUsd}`, 30_000, async () => {
          const { quote } = await estimateQuote({
            dry: true,
            swapType: "EXACT_INPUT",
            slippageTolerance: 100,
            originAsset: SETTLE_ASSET.assetId,
            depositType: "INTENTS",
            destinationAsset: target.assetId,
            amount: toAtomic(shareUsd, SETTLE_ASSET.decimals),
            recipient: SAMPLE_ADDRESS[p.chain],
            recipientType: "DESTINATION_CHAIN",
            refundTo: QUOTE_ACCOUNT,
            refundType: "INTENTS",
            deadline: deadline(),
          });
          const inUsd = Number(quote.amountInUsd ?? shareUsd);
          const outUsd = quote.amountOutUsd !== undefined ? Number(quote.amountOutUsd) : null;
          return {
            ...empty,
            amountOut: quote.amountOutFormatted,
            amountOutUsd: outUsd,
            feePct: outUsd !== null && inUsd > 0 ? Math.max(0, ((inUsd - outUsd) / inUsd) * 100) : null,
            seconds: quote.timeEstimate ?? null,
          };
        });
      } catch (e) {
        // 1Click down: the market price, marked approximate. A rejected route (e.g. amount too small for
        // this chain): the plain share. An estimate is a nice-to-have either way.
        return serviceFailed(e) && target.price > 0 ? { ...empty, amountOut: atMarket(shareUsd, target.price), approximate: true } : empty;
      }
    })
  );
}
