"use client";

import { useEffect, useState } from "react";
import { LockIcon } from "@/components/ui/lock-icon";
import { CHAIN_NAMES } from "@/lib/assets";
import type { Rule } from "@/lib/rules";
import { POT_COLORS, SplitBar } from "./split-bar";

type Estimate = { amountOut: string | null; feePct: number | null; approximate?: boolean };

const SAMPLE_USD = 1000;
const HIGH_FEE_PCT = 3; // worth flagging: usually a small pot going to Bitcoin

/**
 * "If you're paid $1,000": each pot's share, plus a live estimate of what actually arrives after
 * conversion and network fees (dry quotes from NEAR, refreshed as the pots change).
 */
export function PayoutPreview({ rules }: { rules: Rule[] }) {
  const [estimates, setEstimates] = useState<{ key: string; pots: Estimate[] } | null>(null);
  const pots = rules.map((r) => ({ symbol: r.symbol, chain: r.chain, percent: Math.max(0, Math.min(100, Number(r.percent) || 0)) }));
  const key = JSON.stringify(pots);

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetch("/api/estimate/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: SAMPLE_USD, pots: JSON.parse(key) }),
      }).catch(() => null);
      const json = res?.ok ? await res.json() : null;
      if (!cancelled && json) setEstimates({ key, pots: json.pots });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [key]);

  const live = estimates?.key === key ? estimates.pots : null;

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">If you&apos;re paid $1,000</h2>
      <SplitBar rules={rules} />
      <ul className="space-y-2 text-sm">
        {rules.map((r, i) => {
          const est = live?.[i];
          const high = (est?.feePct ?? 0) >= HIGH_FEE_PCT;
          return (
            <li key={i} className="flex justify-between gap-2">
              <span className="flex min-w-0 items-start gap-2">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${POT_COLORS[i % POT_COLORS.length]}`} />
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{r.label || `Pot ${i + 1}`}</span>
                    {r.private && <LockIcon className="h-3 w-3 text-violet" />}
                  </span>
                  <span className="block text-xs text-white/50">
                    {r.symbol} on {CHAIN_NAMES[r.chain] ?? r.chain}
                  </span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="font-semibold">${((SAMPLE_USD * (r.percent || 0)) / 100).toLocaleString()}</span>
                {est?.amountOut && (
                  <span className={`block text-xs ${high ? "text-amber" : "text-white/45"}`}>
                    ≈ {Number(est.amountOut).toLocaleString(undefined, { maximumFractionDigits: 6 })} {r.symbol}
                    {high && est.feePct !== null ? ` · ${est.feePct.toFixed(1)}% fee` : ""}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-white/50">
        {!live
          ? "Before network fees."
          : live.some((e) => e.approximate)
            ? "≈ at market prices, before fees: NEAR's live quotes aren't responding right now."
            : "≈ what arrives after network fees, live from NEAR."}
      </p>
    </section>
  );
}
