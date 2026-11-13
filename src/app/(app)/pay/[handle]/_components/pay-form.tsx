"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { AssetIcon } from "@/components/ui/asset-icon";
import { LockIcon } from "@/components/ui/lock-icon";
import { StepTitle } from "@/components/ui/step-title";
import { chainLabel } from "@/lib/assets";
import { CURRENCIES, fmtMoney, guessCurrency } from "@/lib/currencies";
import type { PublicRule } from "@/lib/rules";

type PayToken = { assetId: string; symbol: string; chain: string; price: number };
type DryQuote = { key: string; amountIn: string; amountInUsd?: string; symbol: string; chain: string; timeEstimate?: number };

const noopSubscribe = () => () => {};

const POPULAR = ["USDC", "USDT", "ETH", "BTC", "SOL", "NEAR", "BNB", "TRX", "ZEC", "TON"];
// One-tap choices: what most people hold. Everything else is one search away.
const QUICK: [symbol: string, chain: string][] = [["USDT", "tron"], ["USDC", "base"], ["USDC", "eth"], ["ETH", "eth"], ["BTC", "btc"], ["SOL", "sol"]];
const OFFLINE = "Couldn't reach Allot. Check your internet connection and try again.";

export default function PayForm(props: {
  handle: string;
  name: string;
  rules: PublicRule[];
  initialAmount?: number;
  initialMemo?: string;
}) {
  const router = useRouter();
  const [tokens, setTokens] = useState<PayToken[]>([]);
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1 });
  const autoCurrency = useSyncExternalStore(noopSubscribe, guessCurrency, () => "USD");
  const [pickedCurrency, setCurrency] = useState<string | null>(null);
  const currency = pickedCurrency ?? autoCurrency;
  const [amount, setAmount] = useState<string>(props.initialAmount ? String(props.initialAmount) : "");
  const [memo, setMemo] = useState(props.initialMemo ?? "");
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [assetId, setAssetId] = useState("");
  const [refundTo, setRefundTo] = useState("");
  const [quote, setQuote] = useState<DryQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fixedAmount = props.initialAmount !== undefined;

  useEffect(() => {
    fetch("/api/options")
      .then((r) => r.json())
      .then((j) => {
        setTokens(j.payWith ?? []);
        setRates(j.rates ?? { USD: 1 });
        const usdcBase = (j.payWith as PayToken[]).find((t) => t.symbol === "USDC" && t.chain === "base");
        if (usdcBase) setAssetId(usdcBase.assetId);
      })
      .catch(() => setError("Couldn't load the list of currencies. Refresh the page to try again."));
  }, []);

  const quick = useMemo(
    () => QUICK.map(([s, c]) => tokens.find((t) => t.symbol === s && t.chain === c)).filter((t): t is PayToken => !!t),
    [tokens]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = tokens.filter((t) => !q || t.symbol.toLowerCase().includes(q) || chainLabel(t.chain).toLowerCase().includes(q));
    const rank = (s: string) => (POPULAR.indexOf(s) === -1 ? 99 : POPULAR.indexOf(s));
    return list.sort((a, b) => rank(a.symbol) - rank(b.symbol) || a.symbol.localeCompare(b.symbol) || chainLabel(a.chain).localeCompare(chainLabel(b.chain)));
  }, [tokens, search]);

  const selected = tokens.find((t) => t.assetId === assetId);
  const selectedIsQuick = quick.some((t) => t.assetId === assetId);
  const usd = Number(amount);
  const validAmount = Number.isFinite(usd) && usd >= 1 && usd <= 10_000;

  // Live indicative quote (dry run: nothing is created). Keyed by inputs so a stale quote is never shown.
  const quoteKey = validAmount && assetId ? `${assetId}:${usd}` : "";
  useEffect(() => {
    if (!quoteKey) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/pay/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: props.handle, amountUsd: usd, originAsset: assetId, dry: true }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(json.error ?? "Couldn't get a price for this currency. Try another one.");
        else {
          setError(null);
          setQuote({ ...json, key: quoteKey });
        }
      } catch {
        if (!cancelled) setError(OFFLINE);
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [quoteKey, usd, assetId, props.handle]);
  const liveQuote = quote && quote.key === quoteKey ? quote : null;

  async function getDepositAddress() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/pay/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle: props.handle, amountUsd: usd, originAsset: assetId, refundTo, memo, dry: false }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) {
        setSubmitting(false);
        setError(json.error ?? "Couldn't create the payment. Please try again.");
        return;
      }
      router.push(`/pay/status/${json.id}`);
    } catch {
      setSubmitting(false);
      setError(OFFLINE);
    }
  }

  const local = validAmount && currency !== "USD" ? fmtMoney(usd, currency, rates) : null;
  const sendText = liveQuote ? `${Number(liveQuote.amountIn).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${liveQuote.symbol}` : null;
  const missing = !validAmount ? "Enter an amount first." : !selected ? "Choose what you'll pay with." : !refundTo ? "Add your wallet address for refunds." : null;

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_300px]">
      <section className="card space-y-6">
        <div>
          <p className="text-sm text-white/50">You&apos;re paying</p>
          <h1 className="text-3xl font-bold tracking-tight wrap-anywhere">{props.name}</h1>
          <p className="mt-1 text-sm text-white/55">Pay with almost any crypto.</p>
        </div>

        <div className="space-y-3">
          <StepTitle n={1} title="How much?" />
          <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
            <div>
              <label className="label" htmlFor="amount">Amount in US dollars</label>
              <input id="amount" className="input text-lg font-semibold" inputMode="decimal" value={amount} readOnly={fixedAmount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="100.00" />
              {fixedAmount ? (
                <p className="mt-1.5 text-xs text-white/50">Amount set by {props.name}.{local ? ` About ${local}.` : ""}</p>
              ) : (
                local && <p className="mt-1.5 text-sm text-white/50">≈ {local}</p>
              )}
            </div>
            <div>
              <label className="label" htmlFor="ccy">Also show in</label>
              <select id="ccy" className="input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="memo">What&apos;s it for? (optional)</label>
            <input id="memo" className="input" value={memo} maxLength={140} onChange={(e) => setMemo(e.target.value)} placeholder="e.g. Invoice #12, logo design" />
          </div>
        </div>

        <div className="space-y-3">
          <StepTitle n={2} title="Pay with" />
          <div role="group" aria-label="Popular currencies" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {quick.map((t) => {
              const on = t.assetId === assetId;
              return (
                <button
                  key={t.assetId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAssetId(t.assetId)}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
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
          {selected && !selectedIsQuick && (
            <p className="text-sm">
              Selected: <strong>{selected.symbol}</strong> on {chainLabel(selected.chain)}
            </p>
          )}
          <button type="button" className="text-sm text-mint underline-offset-4 hover:underline" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
            {showAll ? "Hide the full list" : `Something else? Search all ${tokens.length || ""} currencies`}
          </button>
          {showAll && (
            <div className="space-y-2">
              <input className="input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or network, e.g. USDT, Solana, DOGE" aria-label="Search currencies" />
              <select className="input" size={6} value={assetId} onChange={(e) => setAssetId(e.target.value)} aria-label="Currency to pay with">
                {filtered.map((t) => (
                  <option key={t.assetId} value={t.assetId}>
                    {t.symbol} on {chainLabel(t.chain)}
                  </option>
                ))}
              </select>
              {filtered.length === 0 && <p className="text-xs text-white/50">Nothing matches &ldquo;{search}&rdquo;. Try the currency&apos;s short name, like USDT or ETH.</p>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <StepTitle n={3} title="Refund address" hint="Only used if the payment fails." />
          <div>
            <label className="label" htmlFor="refund">Your {selected ? chainLabel(selected.chain) : ""} address</label>
            <input id="refund" className="input font-mono" value={refundTo} onChange={(e) => setRefundTo(e.target.value.trim())} placeholder="Paste the address you're paying from" />
          </div>
        </div>

        <div className="rounded-xl bg-white/[0.04] p-4" aria-live="polite">
          {!validAmount ? (
            <p className="text-sm text-white/50">{amount ? "Enter an amount between $1 and $10,000." : "Enter an amount to see the exact price."}</p>
          ) : !selected ? (
            <p className="text-sm text-white/50">Choose what you&apos;ll pay with to see the exact price.</p>
          ) : !liveQuote ? (
            <p className="animate-pulse text-sm">Getting the live price…</p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm text-white/50">You&apos;ll send</p>
              <p className="text-2xl font-bold">
                {sendText}
                <span className="text-base font-medium text-white/50"> on {chainLabel(liveQuote.chain)}</span>
              </p>
              <p className="text-sm text-white/55">
                {props.name} receives exactly ${usd.toFixed(2)}
                {liveQuote.timeEstimate ? `. Usually arrives in about ${Math.max(1, Math.round(liveQuote.timeEstimate / 60))} min.` : "."}
              </p>
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <button className="btn w-full" disabled={!validAmount || !liveQuote || !refundTo || submitting} onClick={getDepositAddress}>
            {submitting ? "Preparing your payment…" : "Continue to payment"}
          </button>
          <p className="text-center text-xs text-white/45">
            {missing ?? "Nothing leaves your wallet until you send it."}
          </p>
        </div>
      </section>

      <aside className="card h-fit space-y-3">
        <h2 className="text-sm font-semibold text-white/80">Where your payment goes</h2>
        <ul className="space-y-2 text-sm">
          {props.rules.map((r, i) => (
            <li key={i} className="flex justify-between gap-2">
              {r.private ? (
                <span className="inline-flex items-center gap-1.5 text-violet" title="Where this part goes is kept private">
                  <LockIcon /> Private pot
                </span>
              ) : (
                <span>
                  {r.label} <span className="text-white/50">· {r.symbol} on {chainLabel(r.chain)}</span>
                </span>
              )}
              <span className="font-semibold">{r.percent}%</span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
