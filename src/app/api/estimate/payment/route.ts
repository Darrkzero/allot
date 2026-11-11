import { errorResponse } from "@/lib/server/http";
import { paymentEstimate } from "@/lib/server/near/quotes";
import { rateLimit } from "@/lib/server/rate-limit";

// Live estimate of what a payer would send (dry quote: nothing is created). Used by demo mode,
// where there's no real payment link to quote against.
export async function POST(request: Request) {
  const limited = rateLimit(request, "estimate-payment", 60, 60_000);
  if (limited) return limited;
  try {
    const body = await request.json().catch(() => ({}));
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 10_000) {
      return Response.json({ error: "Enter an amount between $1 and $10,000." }, { status: 400 });
    }
    if (typeof body.originAsset !== "string" || !body.originAsset) return Response.json({ error: "Choose what you'll pay with." }, { status: 400 });
    return Response.json(await paymentEstimate(amountUsd, body.originAsset));
  } catch (e) {
    return errorResponse(e);
  }
}
