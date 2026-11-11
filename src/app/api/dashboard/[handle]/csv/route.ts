import { explorerTx, SETTLE_ASSET } from "@/lib/assets";
import { getLegs, listPayments } from "@/lib/server/db";
import { isOwner } from "@/lib/server/auth/session";

/**
 * One CSV cell. Payers write the memo, so a cell must never run as a spreadsheet formula:
 * values starting with = + - @ or a tab/CR get a leading apostrophe (OWASP CSV-injection advice).
 * Quotes, commas and line breaks are quoted per RFC 4180.
 */
function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// Accountant-friendly export: one row per slice of every payment.
export async function GET(_request: Request, ctx: RouteContext<"/api/dashboard/[handle]/csv">) {
  const { handle } = await ctx.params;
  if (!(await isOwner(handle))) return new Response("Sign in with your passkey first.", { status: 401 });

  const header = [
    "payment_date_utc", "payment_id", "memo", "invoice_usd", "paid_with_amount", "paid_with_token", "paid_with_chain",
    "payment_status", "slice", "slice_percent", "slice_usd", "payout_token", "payout_chain", "payout_address", "payout_route", "slice_status", "payout_tx",
  ];
  const lines = [header];
  for (const p of listPayments(handle, 10_000)) {
    const legs = getLegs(p.id);
    const base = [p.created_at, p.id, p.memo ?? "", p.amount_usd.toFixed(2), p.amount_in_formatted, p.origin_symbol, p.origin_chain, p.status];
    if (legs.length === 0) lines.push([...base, "", "", "", "", "", "", "", "", ""]);
    for (const l of legs) {
      lines.push([
        ...base, l.label, String(l.percent), (Number(l.amount_settle) / 10 ** SETTLE_ASSET.decimals).toFixed(2),
        l.symbol, l.chain, l.address, l.private ? "private (NEAR Confidential Intents)" : "public", l.phase, explorerTx(l.chain, l.dest_tx_hash) ?? "",
      ]);
    }
  }
  const csv = lines.map((r) => r.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="allot-${handle}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
