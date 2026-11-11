import { rateLimit } from "@/lib/server/rate-limit";
import { paymentsNeedingSplit } from "@/lib/server/db";
import { errorResponse } from "@/lib/server/http";
import { processPayment } from "@/lib/server/payments/split";

// Advances every paid payment whose split isn't finished. Idempotent: safe to call from a
// cron job or the dashboard, in case nobody is watching a payment's status page.
export async function POST(request: Request) {
  const limited = rateLimit(request, "sweep", 6, 60_000); // a cron job needs one call a minute
  if (limited) return limited;
  try {
    const pending = paymentsNeedingSplit();
    const results = [];
    for (const p of pending) {
      const legs = await processPayment(p.id);
      results.push({ id: p.id, phases: legs.map((l) => l.phase) });
    }
    return Response.json({ processed: results.length, results });
  } catch (e) {
    return errorResponse(e);
  }
}
