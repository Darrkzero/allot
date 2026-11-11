"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { LockIcon } from "@/components/ui/lock-icon";
import { chainLabel, type ChainId } from "@/lib/assets";

type PayToken = { assetId: string; symbol: string; chain: string };
type PaymentEstimate = { amountIn: string; symbol: string; chain: string; seconds: number | null };
type PayoutEstimate = { shareUsd: number; amountOut: string | null; amountOutUsd: number | null; feePct: number | null; seconds: number | null };
type Pot = { label: string; percent: number; symbol: string; chain: ChainId; private?: boolean };

// A sample recipient: one private pot and one Bitcoin pot show the interesting routes.
const RECIPIENT = "Ada Design Studio";
const POTS: Pot[] = [
  { label: "Spending", percent: 70, symbol: "USDC", chain: "base" },
  { label: "Taxes", percent: 20, symbol: "USDC", chain: "arb", private: true },
  { label: "Savings", percent: 10, symbol: "BTC", chain: "btc" },
];
const COLORS = ["bg-mint", "bg-amber", "bg-sky"];
const QUICK: [string, string][] = [["ETH", "arb"], ["USDT", "tron"], ["USDC", "base"], ["ETH", "eth"], ["BTC", "btc"], ["SOL", "sol"]];

// The simulated timeline, in seconds after "Simulate payment": the payment, then every pot in parallel.
const PAY_STEPS = [
  { at: 0, label: "Waiting for your payment" },
  { at: 1.2, label: "Payment spotted" },
  { at: 2.6, label: "Converting to US dollars" },
  { at: 4.2, label: `Delivered to ${RECIPIENT}` },
];
const SPLIT_START = 4.8;

/** The steps the real split engine runs for a pot (see lib/server/payments/split.ts). */
const potPhases = (p: Pot) => [
  ...(p.private ? ["Making private"] : []),
  ...(p.symbol === "USDC" && p.chain === "base" ? [] : ["Converting"]), // already in the settlement currency
  "Sending",
];
/** Demo time for a pot: scaled from NEAR's real time estimate, so Bitcoin visibly takes longest. */
const potDuration = (seconds: number | null) => Math.min(6, 1.6 + (seconds ?? 30) / 120);
const fmtTime = (s: number) => (s < 90 ? `~${Math.round(s)} s` : `~${Math.round(s / 60)} min`);

export default function Demo() {
  const [tokens, setTokens] = useState<PayToken[]>([]);
  const [assetId, setAssetId] = useState("");
  const [amount, setAmount] = useState("250");
  const [payment, setPayment] = useState<(PaymentEstimate & { key: string }) | null>(null);
  const [payouts, setPayouts] = useState<{ key: string; pots: PayoutEstimate[] } | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [tried, setTried] = useState(false);

  const usd = Number(amount);
  const validAmount = Number.isFinite(usd) && usd >= 1 && usd <= 10_000;

  useEffect(() => {
    fetch("/api/options")
      .then((r) => r.json())
      .then((j) => {
        const list = (j.payWith ?? []) as PayToken[];
        setTokens(list);
        const def = list.find((t) => t.symbol === "ETH" && t.chain === "arb");
        if (def) setAssetId(def.assetId);
      })
      .catch(() => {});
  }, []);

  const quick = useMemo(() => QUICK.map(([s, c]) => tokens.find((t) => t.symbol === s && t.chain === c)).filter((t): t is PayToken => !!t), [tokens]);

  // Live price for the payer (dry quote).
  const payKey = validAmount && assetId ? `${assetId}:${usd}` : "";
  useEffect(() => {
    if (!payKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetch("/api/estimate/payment", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountUsd: usd, originAsset: assetId }) }).catch(() => null);
      const json = res?.ok ? await res.json() : null;
      if (!cancelled && json) setPayment({ ...json, key: payKey });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payKey, usd, assetId]);

  // Live estimate of what each pot receives (dry quotes).
  const potsKey = validAmount ? String(usd) : "";
  useEffect(() => {
    if (!potsKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await fetch("/api/estimate/payouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountUsd: usd, pots: POTS }) }).catch(() => null);
      const json = res?.ok ? await res.json() : null;
      if (!cancelled && json) setPayouts({ key: potsKey, pots: json.pots });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [potsKey, usd]);

  const livePayment = payment?.key === payKey ? payment : null;
  const livePayouts = payouts?.key === potsKey ? payouts.pots : null;

  // Simulation clock: ticks only while a run is in progress.
  const elapsed = startedAt === null ? -1 : Math.max(0, (now - startedAt) / 1000);
  const potStarts = POTS.map((_, i) => SPLIT_START + i * 0.3);
  const potEnds = POTS.map((p, i) => potStarts[i] + potDuration(livePayouts?.[i]?.seconds ?? null));
  const end = Math.max(...potEnds);
  const running = startedAt !== null && elapsed < end;
  const finished = startedAt !== null && elapsed >= end;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  function simulate() {
    const t = Date.now();
    setNow(t);
    setStartedAt(t);
  }

  const payStage = startedAt === null ? -1 : PAY_STEPS.reduce((k, s, i) => (elapsed >= s.at ? i : k), 0);
  const potStatus = (i: number): { text: string; state: "idle" | "wait" | "work" | "done" } => {
    if (startedAt === null) return { text: "", state: "idle" };
    if (elapsed < potStarts[i]) return { text: "Waiting", state: "wait" };
    const phases = potPhases(POTS[i]);
    const k = Math.floor(((elapsed - potStarts[i]) / (potEnds[i] - potStarts[i])) * phases.length);
    return k >= phases.length ? { text: "Delivered", state: "done" } : { text: phases[k], state: "work" };
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="card space-y-5">
          <div>
            <p className="text-sm text-white/50">You&apos;re paying</p>
            <h2 className="text-2xl font-bold tracking-tight">{RECIPIENT}</h2>
          </div>

          <div>
            <label className="label" htmlFor="demo-amount">Amount in US dollars</label>
            <input id="demo-amount" className="input text-lg font-semibold" inputMode="decimal" value={amount} disabled={running} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>

          <div>
            <span className="label">Pay with</span>
            <div role="group" aria-label="Pay with" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {quick.map((t) => {
                const on = t.assetId === assetId;
                return (
                  <button
                    key={t.assetId}
                    type="button"
                    aria-pressed={on}
                    disabled={running}
                    onClick={() => setAssetId(t.assetId)}
                    className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition disabled:opacity-60 ${
                      on ? "border-mint/60 bg-mint/[0.08] ring-2 ring-mint/15" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    <AssetIcon symbol={t.symbol} chain={t.chain} size={26} />
                    <span className="leading-tight">
                      <span className="block font-semibold">{t.symbol}</span>
                      <span className="block text-xs text-white/50">on {chainLabel(t.chain)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-white/[0.04] p-4" aria-live="polite">
            {!validAmount ? (
              <p className="text-sm text-white/50">Enter an amount between $1 and $10,000.</p>
            ) : !livePayment ? (
              <p className="animate-pulse text-sm">Getting the live price…</p>
            ) : (
              <>
                <p className="text-sm text-white/50">You&apos;d send</p>
                <p className="text-2xl font-bold">
                  {Number(livePayment.amountIn).toLocaleString(undefined, { maximumFractionDigits: 8 })} {livePayment.symbol}
                  <span className="text-base font-medium text-white/50"> on {chainLabel(livePayment.chain)}</span>
                </p>
                <p className="text-sm text-white/55">
                  {RECIPIENT} receives exactly ${usd.toFixed(2)}
                  {livePayment.seconds ? ` · ${fmtTime(livePayment.seconds)}` : ""}
                </p>
              </>
            )}
          </div>

          <button className="btn w-full" disabled={!livePayment || running} onClick={simulate}>
            {running ? "Simulating…" : finished ? "Run it again" : "Simulate payment"}
          </button>

          {startedAt !== null && (
            <ol className="space-y-3" aria-label="Payment progress">
              {PAY_STEPS.map((s, i) => {
                const complete = i < payStage || (i === payStage && i === PAY_STEPS.length - 1);
                return (
                  <li key={s.label} className="flex items-center gap-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        complete ? "bg-mint text-[#04120c]" : i === payStage ? "animate-pulse bg-mint/25 text-mint" : "bg-white/10 text-white/40"
                      }`}
                    >
                      {complete ? "✓" : i + 1}
                    </span>
                    <span className={i <= payStage ? "font-medium" : "text-white/40"}>{s.label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <section className="card space-y-3">
          <h2 className="font-semibold">Try to redirect the money</h2>
          <p className="text-sm text-white/55">Ada&apos;s wallet only pays Ada&apos;s own addresses. Not even Allot&apos;s server can change that.</p>
          <button className="btn-ghost" onClick={() => setTried(true)}>
            Send Ada&apos;s money to a stranger
          </button>
          {tried && (
            <div className="space-y-1 rounded-lg bg-black/40 p-3 font-mono text-xs">
              <p className="text-sky">allot-server → withdraw Ada&apos;s USDC to 0x5tr4…n63r</p>
              <p className="text-pink">✗ 403 policy_destination_denied</p>
              <p className="text-white/40">The real response from NEAR&apos;s wallet service, tested on mainnet.</p>
            </div>
          )}
        </section>
      </div>

      <aside className="card space-y-4 lg:sticky lg:top-24">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">{RECIPIENT.split(" ")[0]}&apos;s pots</h2>
          <span className="text-xs text-white/45">live estimates</span>
        </div>
        <div className="flex h-2.5 overflow-hidden rounded-full bg-white/5">
          {POTS.map((p, i) => (
            <div key={p.label} className={COLORS[i]} style={{ width: `${p.percent}%` }} />
          ))}
        </div>
        <ul className="space-y-3">
          {POTS.map((p, i) => {
            const est = livePayouts?.[i];
            const status = potStatus(i);
            return (
              <li key={p.label} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <span className={`h-2.5 w-2.5 rounded-full ${COLORS[i]}`} />
                    {p.label}
                    {p.private && <LockIcon className="h-3 w-3 text-violet" />}
                    <span className="font-normal text-white/45">{p.percent}%</span>
                  </span>
                  {status.state !== "idle" && (
                    <span
                      className={`text-xs font-semibold ${
                        status.state === "done" ? "text-mint" : status.state === "work" ? "animate-pulse text-white/80" : "text-white/40"
                      }`}
                    >
                      {status.state === "done" ? "✓ Delivered" : status.text}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex items-center gap-2.5">
                  <AssetIcon symbol={p.symbol} chain={p.chain} size={24} />
                  <div className="min-w-0 text-sm leading-tight">
                    <p className="truncate font-medium">
                      {est?.amountOut ? `${Number(est.amountOut).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${p.symbol}` : `$${((usd || 0) * p.percent / 100).toFixed(2)}`}
                    </p>
                    <p className="text-xs text-white/45">
                      on {chainLabel(p.chain)}
                      {est?.feePct != null ? ` · ${est.feePct < 0.05 ? "<0.05" : est.feePct.toFixed(2)}% fee` : ""}
                      {est?.seconds ? ` · ${fmtTime(est.seconds)}` : ""}
                      {p.private ? " · private" : ""}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        {finished ? (
          <div className="space-y-3 border-t border-white/[0.06] pt-4">
            <p className="text-sm text-mint">✓ Paid once, split into 3 pots automatically.</p>
            <Link href="/create" className="btn w-full">
              Create your own link
            </Link>
          </div>
        ) : (
          <p className="text-xs text-white/45">Fees and times are live quotes from NEAR for this amount.</p>
        )}
      </aside>
    </div>
  );
}
