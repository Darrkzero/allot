import { explorerTx, SETTLE_ASSET } from "@/lib/assets";
import { getBalances, REVIEW_STATUSES } from "@/lib/server/near/agent-api";
import { getLegs, getRouter, listPayments, OPEN_PHASES } from "@/lib/server/db";
import { grantExpiry, GRANT_RENEW_WINDOW_DAYS } from "@/lib/server/near/grant";
import { errorResponse } from "@/lib/server/http";
import { refreshPayment } from "@/lib/server/payments/refresh";
import { isOwner } from "@/lib/server/auth/session";

const REFRESH_LIMIT = 10; // keep the dashboard fast: only the newest unfinished payments are refreshed per load
const OPEN = new Set(["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"]);

// Owner-only overview: payments, every slice with explorer links, totals per pot, wallet balance.
export async function GET(_request: Request, ctx: RouteContext<"/api/dashboard/[handle]">) {
  try {
    const { handle } = await ctx.params;
    if (!(await isOwner(handle))) return Response.json({ error: "Sign in with your passkey." }, { status: 401 });
    const router = getRouter(handle);
    if (!router) return Response.json({ error: "Not found." }, { status: 404 });

    let payments = listPayments(handle, 100);
    let refreshed = 0;
    for (const p of payments) {
      const legs = p.status === "SUCCESS" ? getLegs(p.id) : [];
      const unfinished = OPEN.has(p.status) || (p.status === "SUCCESS" && (legs.length === 0 || legs.some((l) => OPEN_PHASES.has(l.phase))));
      if (!unfinished || refreshed >= REFRESH_LIMIT) continue;
      await refreshPayment(p);
      refreshed++;
    }
    if (refreshed) payments = listPayments(handle, 100);

    const totals = router.rules.map((r) => ({ label: r.label, delivered: 0, inFlight: 0 }));
    const rows = payments.map((p) => {
      const legs = getLegs(p.id);
      for (const l of legs) {
        const t = totals[l.idx];
        if (!t) continue;
        const usd = Number(l.amount_settle) / 10 ** SETTLE_ASSET.decimals;
        if (l.phase === "done") t.delivered += usd;
        else if (l.phase !== "failed") t.inFlight += usd;
      }
      return {
        id: p.id,
        createdAt: p.created_at,
        amountUsd: p.amount_usd,
        memo: p.memo,
        paidWith: { amount: p.amount_in_formatted, symbol: p.origin_symbol, chain: p.origin_chain },
        status: p.status,
        legs: legs.map((l) => ({
          label: l.label,
          percent: l.percent,
          symbol: l.symbol,
          chain: l.chain,
          private: l.private === 1,
          review: REVIEW_STATUSES.has(l.agent_status ?? ""),
          to: l.address,
          amountUsdc: Number(l.amount_settle) / 10 ** SETTLE_ASSET.decimals,
          phase: l.phase,
          agentStatus: l.agent_status,
          error: l.error,
          txUrl: explorerTx(l.chain, l.dest_tx_hash),
          nearTxUrl: explorerTx("near", l.tx_hash),
        })),
      };
    });

    // Balances still held in the wallet: public, plus the confidential balance when a slice is private.
    type Bal = { symbol: string; blockchain: string | null; balance: string | number | null; private: boolean };
    type RawBalances = { balances?: { symbol?: string; blockchain?: string; balance?: string | number; balance_raw?: string }[] };
    const readBalances = async (source: "public" | "confidential"): Promise<Bal[]> => {
      try {
        const b = (await getBalances(router.agent_id!, source)) as RawBalances;
        return (b.balances ?? [])
          .filter((x) => x.balance_raw && x.balance_raw !== "0")
          .map((x) => ({ symbol: x.symbol ?? "?", blockchain: x.blockchain ?? null, balance: x.balance ?? x.balance_raw ?? null, private: source === "confidential" }));
      } catch {
        return []; // balance is informational only
      }
    };
    const hasPrivate = router.rules.some((r) => r.private);
    const balances = router.agent_id
      ? (await Promise.all([readBalances("public"), hasPrivate ? readBalances("confidential") : Promise.resolve([])])).flat()
      : [];

    return Response.json({
      handle: router.handle,
      name: router.name,
      createdAt: router.created_at,
      rules: router.rules,
      wallet: { intentsAccount: router.intents_account, agentId: router.agent_id },
      // The split engine's permission: when it lapses, and whether to nudge the owner to renew.
      grant: { expiresAt: grantExpiry(router), renewWithinDays: GRANT_RENEW_WINDOW_DAYS },
      balances,
      totals,
      payments: rows,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
