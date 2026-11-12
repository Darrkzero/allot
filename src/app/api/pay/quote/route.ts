import { randomUUID } from "node:crypto";
import { rateLimit } from "@/lib/server/rate-limit";
import { SETTLE_ASSET, toAtomic } from "@/lib/assets";
import { getRouter, insertPayment } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { getTokens, OneClickError, quotesDown, requestQuote } from "@/lib/server/near/oneclick";

const MIN_USD = 1;
const MAX_USD = 10_000;

// Payer asks: "how much of my token do I send?"
//  dry=true  -> indicative price only (no refund address needed, nothing created)
//  dry=false -> a real deposit address; we record the payment and start tracking it.
// The quote is EXACT_OUTPUT: the recipient receives exactly the invoiced USDC amount
// in their router's NEAR Intents balance, whatever the payer pays with.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Live price previews refresh as the payer types; real deposit addresses each create a payment record.
    const limited = body.dry === false ? rateLimit(request, "quote-live", 10, 10 * 60_000) : rateLimit(request, "quote-preview", 120, 60_000);
    if (limited) return limited;
    const router = getRouter(String(body.handle ?? ""));
    if (!router || router.status !== "active" || !router.intents_account) {
      return Response.json({ error: "This payment link isn't active. Check the link with the person you're paying." }, { status: 404 });
    }
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < MIN_USD || amountUsd > MAX_USD) {
      return Response.json({ error: `Amount must be between $${MIN_USD} and $${MAX_USD.toLocaleString()}.` }, { status: 400 });
    }
    const tokens = await getTokens();
    const origin = tokens.find((t) => t.assetId === body.originAsset);
    if (!origin) return Response.json({ error: "Choose what you'll pay with." }, { status: 400 });

    const dry = body.dry !== false;
    const refundTo = String(body.refundTo ?? "").trim();
    if (!dry && !refundTo) return Response.json({ error: "Add your wallet address for refunds (on the network you're paying from)." }, { status: 400 });

    // While 1Click is stalling, a preview would just hang ~25 s and fail; say so at once instead.
    // (A real payment quote always tries: the payer asked for it explicitly.)
    if (dry && quotesDown()) return Response.json({ error: QUOTES_DOWN }, { status: 503 });

    const amountOut = toAtomic(amountUsd, SETTLE_ASSET.decimals);
    const { quote } = await requestQuote({
      dry,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: origin.assetId,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: SETTLE_ASSET.assetId,
      amount: amountOut,
      recipient: router.intents_account,
      recipientType: "INTENTS",
      // For a dry preview there's no payer address yet; refund target is irrelevant because nothing is sent.
      refundTo: dry ? router.intents_account : refundTo,
      refundType: dry ? "INTENTS" : "ORIGIN_CHAIN",
      deadline: new Date(Date.now() + 30 * 60_000).toISOString(),
      referral: "allot",
    });

    const result = {
      amountIn: quote.amountInFormatted,
      amountInUsd: quote.amountInUsd,
      symbol: origin.symbol,
      chain: origin.blockchain,
      amountOut: quote.amountOutFormatted,
      timeEstimate: quote.timeEstimate,
    };
    if (dry) return Response.json({ dry: true, ...result });

    if (!quote.depositAddress) return Response.json({ error: "Couldn't create a payment address. Please try again." }, { status: 502 });
    const id = randomUUID();
    insertPayment({
      id,
      handle: router.handle,
      amount_usd: amountUsd,
      memo: body.memo ? String(body.memo).slice(0, 140) : null,
      origin_asset: origin.assetId,
      origin_symbol: origin.symbol,
      origin_chain: origin.blockchain,
      deposit_address: quote.depositAddress,
      deposit_memo: quote.depositMemo ?? null,
      amount_in_formatted: quote.amountInFormatted,
      amount_out: amountOut,
      deadline: quote.deadline ?? null,
      status: "PENDING_DEPOSIT",
    });
    return Response.json({ dry: false, id, depositAddress: quote.depositAddress, depositMemo: quote.depositMemo ?? null, deadline: quote.deadline, ...result });
  } catch (e) {
    if (e instanceof OneClickError) {
      console.error("1Click quote error:", e.message); // keep the original for debugging
      const rejected = e.status >= 400 && e.status < 500;
      return Response.json({ error: rejected ? friendlyQuoteError(e.message) : QUOTES_DOWN }, { status: rejected ? 400 : 502 });
    }
    return errorResponse(e);
  }
}

const QUOTES_DOWN = "NEAR Intents isn't returning prices right now. Please try again in a few minutes.";

/** 1Click's quote errors, as something a payer can act on. */
function friendlyQuoteError(message: string): string {
  if (/refund/i.test(message)) return "That refund address doesn't look right. It must be your address on the network you're paying from.";
  if (/liquidity|no route|not supported/i.test(message)) return "This currency can't be converted for this amount right now. Try another currency or amount.";
  if (/amount.*(low|small|min)|too (low|small)/i.test(message)) return "That amount is too small to send with this currency. Try a larger amount or another currency.";
  return "Couldn't get a price right now. Please try again in a moment.";
}
