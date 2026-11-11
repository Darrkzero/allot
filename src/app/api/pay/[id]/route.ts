import { rateLimit } from "@/lib/server/rate-limit";
import { getPayment, getRouter } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { refreshPayment } from "@/lib/server/payments/refresh";
import { legView } from "@/lib/server/payments/split";

// Payment status for the payer's page. Each poll also advances the split once paid.
export async function GET(_request: Request, ctx: RouteContext<"/api/pay/[id]">) {
  const limited = rateLimit(_request, "pay-status", 120, 60_000); // a status page polls ~12/min
  if (limited) return limited;
  try {
    const { id } = await ctx.params;
    const p0 = getPayment(id);
    if (!p0) return Response.json({ error: "Payment not found." }, { status: 404 });
    const { payment: p, legs } = await refreshPayment(p0);
    const detail = p.detail ? JSON.parse(p.detail) : null;
    return Response.json({
      id: p.id,
      handle: p.handle,
      name: getRouter(p.handle)?.name ?? p.handle, // the recipient, as shown on their public pay page
      amountUsd: p.amount_usd,
      memo: p.memo,
      pay: { amount: p.amount_in_formatted, symbol: p.origin_symbol, chain: p.origin_chain, depositAddress: p.deposit_address, depositMemo: p.deposit_memo, deadline: p.deadline },
      status: p.status,
      split: legView(legs),
      txs: {
        origin: detail?.swapDetails?.originChainTxHashes ?? [],
        destination: detail?.swapDetails?.destinationChainTxHashes ?? [],
      },
      refunded: detail?.swapDetails?.refundedAmountFormatted ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
