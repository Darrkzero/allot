import "server-only";
import { getLegs, getPayment, updatePaymentStatus, type PaymentRow } from "../db";
import { getStatus } from "../near/oneclick";
import { processPayment } from "./split";

const FINAL = new Set(["SUCCESS", "REFUNDED", "FAILED"]);

// Several open status pages, plus the sweeper, would otherwise each ask 1Click on every poll.
// One status check per payment every few seconds is plenty. Shared via globalThis because route
// handlers can each get their own copy of this module.
const CHECK_EVERY_MS = 4_000;
const lastChecked = ((globalThis as { __allotStatusChecks?: Map<string, number> }).__allotStatusChecks ??= new Map());

/**
 * Brings a payment up to date: asks 1Click for the deposit status if it isn't final,
 * and once the money has landed, nudges the split engine forward (idempotent).
 */
export async function refreshPayment(p: PaymentRow) {
  let row = p;
  const now = Date.now();
  if (!FINAL.has(p.status) && now - (lastChecked.get(p.id) ?? 0) >= CHECK_EVERY_MS) {
    lastChecked.set(p.id, now);
    if (lastChecked.size > 5_000) for (const [id, at] of lastChecked) if (now - at > 60_000) lastChecked.delete(id);
    try {
      const s = await getStatus(p.deposit_address, p.deposit_memo ?? undefined);
      if (s.status !== p.status || JSON.stringify(s) !== p.detail) updatePaymentStatus(p.id, s.status, s);
      row = getPayment(p.id) ?? p;
    } catch {
      // keep last known status; the next poll retries
    }
  }
  const legs = row.status === "SUCCESS" ? await processPayment(row.id).catch(() => getLegs(row.id)) : [];
  return { payment: row, legs };
}
