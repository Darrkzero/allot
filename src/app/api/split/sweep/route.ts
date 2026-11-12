import { errorResponse } from "@/lib/server/http";
import { sweepOnce } from "@/lib/server/payments/sweeper";
import { rateLimit } from "@/lib/server/rate-limit";

// Runs one pass of the background sweeper on demand: refreshes payments still waiting on 1Click and
// advances unfinished splits. The server already does this every minute in production
// (src/instrumentation.ts); this endpoint is for cron jobs or a manual nudge. Idempotent.
export async function POST(request: Request) {
  const limited = rateLimit(request, "sweep", 6, 60_000);
  if (limited) return limited;
  try {
    const result = await sweepOnce();
    return Response.json(result ?? { busy: true });
  } catch (e) {
    return errorResponse(e);
  }
}
