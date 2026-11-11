import { SETTLE_ASSET } from "@/lib/assets";
import { getPayment, resetFailedLegs } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { isOwner } from "@/lib/server/auth/session";
import { processPayment } from "@/lib/server/payments/split";

// Owner retries a payment's failed slices. Funds never left the policy-locked wallet, so this is safe.
export async function POST(request: Request, ctx: RouteContext<"/api/dashboard/[handle]/retry">) {
  try {
    const { handle } = await ctx.params;
    if (!(await isOwner(handle))) return Response.json({ error: "Sign in with your passkey." }, { status: 401 });
    const { paymentId } = await request.json().catch(() => ({}));
    const p = getPayment(String(paymentId));
    if (!p || p.handle !== handle) return Response.json({ error: "Payment not found." }, { status: 404 });
    const reset = resetFailedLegs(p.id, SETTLE_ASSET.assetId);
    const legs = await processPayment(p.id);
    return Response.json({ reset, phases: legs.map((l) => l.phase) });
  } catch (e) {
    return errorResponse(e);
  }
}
