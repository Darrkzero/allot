import "server-only";
import { getLegs, getPayment, updatePaymentStatus, type PaymentRow } from "../db";
import { getStatus } from "../near/oneclick";
import { processPayment } from "./split";

const FINAL = new Set(["SUCCESS", "REFUNDED", "FAILED"]);

/**
 * Brings a payment up to date: asks 1Click for the deposit status if it isn't final,
 * and once the money has landed, nudges the split engine forward (idempotent).
 */
export async function refreshPayment(p: PaymentRow) {
  let row = p;
  if (!FINAL.has(p.status)) {
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
