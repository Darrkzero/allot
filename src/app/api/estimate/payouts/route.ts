import { PAYOUT_OPTIONS } from "@/lib/assets";
import { errorResponse } from "@/lib/server/http";
import { payoutEstimates } from "@/lib/server/near/quotes";
import { rateLimit } from "@/lib/server/rate-limit";
import { MAX_RULES } from "@/lib/rules";

// Live estimate of what each pot would receive from a payment, after conversion and network fees
// (dry quotes: nothing is created). Used by the fee preview on /create and by demo mode.
export async function POST(request: Request) {
  const limited = rateLimit(request, "estimate-payouts", 60, 60_000);
  if (limited) return limited;
  try {
    const body = await request.json().catch(() => ({}));
    const amountUsd = Number(body.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 10_000) {
      return Response.json({ error: "Enter an amount between $1 and $10,000." }, { status: 400 });
    }
    const raw: unknown[] = Array.isArray(body.pots) ? body.pots.slice(0, MAX_RULES) : [];
    const pots = raw.flatMap((p) => {
      const q = p as { symbol?: unknown; chain?: unknown; percent?: unknown };
      const option = PAYOUT_OPTIONS.find((o) => o.symbol === q.symbol && o.chain === q.chain);
      const percent = Number(q.percent);
      return option && Number.isFinite(percent) && percent >= 0 && percent <= 100 ? [{ ...option, percent }] : [];
    });
    if (pots.length !== raw.length || pots.length === 0) return Response.json({ error: "Each pot needs a supported currency and a share." }, { status: 400 });
    return Response.json({ pots: await payoutEstimates(amountUsd, pots) });
  } catch (e) {
    return errorResponse(e);
  }
}
