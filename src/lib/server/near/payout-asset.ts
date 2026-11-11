import "server-only";
import { getTokens } from "./oneclick";

/**
 * The asset a slice is held as inside NEAR Intents before it is withdrawn to its chain.
 * Usually the payout token itself. Exception, BTC: on 11 Nov 2026 1Click quoted no liquidity
 * for USDC -> BTC (btc.omft.near) held inside Intents, while USDC -> nBTC (nbtc.bridge.near)
 * filled in about 10 s, and withdrawing nBTC to the Bitcoin chain delivers native BTC.
 * Verified with dry-run quotes, public and confidential (spike/confidential-payouts.mjs).
 */
const HOLD_AS: Record<string, string> = {
  "BTC:btc": "nep141:nbtc.bridge.near",
};

export async function payoutAsset(symbol: string, chain: string): Promise<string | null> {
  const override = HOLD_AS[`${symbol}:${chain}`];
  if (override) return override;
  const t = (await getTokens()).find((x) => x.symbol === symbol && x.blockchain === chain);
  return t?.assetId ?? null;
}
