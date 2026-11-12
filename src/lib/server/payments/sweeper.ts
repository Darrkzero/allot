import "server-only";
import { listOpenPayments, paymentsNeedingSplit } from "../db";
import { refreshPayment } from "./refresh";
import { processPayment } from "./split";

/**
 * Background sweeper: keeps every payment moving even when nobody has its status page or the
 * dashboard open (e.g. the payer closed the tab right after sending). Each pass:
 *   1. refreshes payments still waiting on 1Click (which also starts the split once they're paid);
 *   2. advances paid payments whose pots haven't all finished.
 * Everything it calls is idempotent, so overlapping with page polls or POST /api/split/sweep is safe.
 */
const EVERY_MS = 60_000;
let started = false;
let busy = false;

export async function sweepOnce(): Promise<{ refreshed: number; split: number } | null> {
  if (busy) return null; // a pass is already running
  busy = true;
  try {
    const open = listOpenPayments(25);
    for (const p of open) await refreshPayment(p).catch(() => {});
    const paid = paymentsNeedingSplit(20);
    for (const p of paid) await processPayment(p.id).catch(() => {});
    return { refreshed: open.length, split: paid.length };
  } finally {
    busy = false;
  }
}

/** Starts the once-a-minute sweep (call once per server process). */
export function startSweeper() {
  if (started) return;
  started = true;
  setInterval(() => void sweepOnce().catch((e) => console.error("[allot] sweep failed:", e)), EVERY_MS).unref();
  setTimeout(() => void sweepOnce().catch(() => {}), 10_000).unref(); // first pass shortly after boot
  console.log("[allot] background sweeper running every 60 s");
}
