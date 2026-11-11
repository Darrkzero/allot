import { connection } from "next/server";
import { PAYOUT_OPTIONS } from "@/lib/assets";
import { usdRates } from "@/lib/server/fx";
import { errorResponse } from "@/lib/server/http";
import { getTokens } from "@/lib/server/near/oneclick";

// Token lists and currency rates for the UI.
//  payout: what recipients can receive (curated).
//  payWith: every token a payer can pay with (all chains NEAR Intents supports).
export async function GET() {
  await connection(); // live prices: always run at request time, never at build
  try {
    const [tokens, rates] = await Promise.all([getTokens(), usdRates()]);
    const payout = PAYOUT_OPTIONS.filter((o) => tokens.some((t) => t.symbol === o.symbol && t.blockchain === o.chain));
    const payWith = tokens
      .filter((t) => t.price > 0)
      .map((t) => ({ assetId: t.assetId, symbol: t.symbol, chain: t.blockchain, price: t.price }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol) || a.chain.localeCompare(b.chain));
    return Response.json({ payout, payWith, rates, chains: [...new Set(tokens.map((t) => t.blockchain))].length });
  } catch (e) {
    return errorResponse(e);
  }
}
