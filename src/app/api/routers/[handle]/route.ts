import { rateLimit } from "@/lib/server/rate-limit";
import { publicRule } from "@/lib/rules";
import { getRouter } from "@/lib/server/db";

// Public view of a payment link: who gets paid and how it splits (addresses shortened).
export async function GET(_request: Request, ctx: RouteContext<"/api/routers/[handle]">) {
  const limited = rateLimit(_request, "link-info", 120, 60_000);
  if (limited) return limited;
  const { handle } = await ctx.params;
  const r = getRouter(handle);
  if (!r || r.status !== "active") return Response.json({ error: "No active payment link with that handle." }, { status: 404 });
  return Response.json({
    handle: r.handle,
    name: r.name,
    // Labels and percentages only: payers never see payout addresses, and a private slice shows only its share.
    rules: r.rules.map(publicRule),
  });
}
