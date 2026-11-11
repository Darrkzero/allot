"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LockIcon } from "@/components/ui/lock-icon";
import { chainLabel } from "@/lib/assets";
import { passkeyErrorMessage, signInWithPasskey } from "@/lib/client/passkey";
import { GrantRenewal, type GrantInfo } from "./grant-renewal";
import { RequestPayment } from "./request-payment";

type Leg = {
  label: string;
  percent: number;
  symbol: string;
  chain: string;
  private: boolean;
  review: boolean;
  to: string;
  amountUsdc: number;
  phase: "shield" | "swap" | "withdraw" | "done" | "failed";
  agentStatus: string | null;
  error: string | null;
  txUrl: string | null;
  nearTxUrl: string | null;
};
type PaymentRow = {
  id: string;
  createdAt: string;
  amountUsd: number;
  memo: string | null;
  paidWith: { amount: string; symbol: string; chain: string };
  status: string;
  legs: Leg[];
};
type Data = {
  handle: string;
  name: string;
  rules: { label: string; percent: number; symbol: string; chain: string; address: string; private?: boolean }[];
  wallet: { intentsAccount: string | null; agentId: string | null };
  grant: GrantInfo;
  balances: { symbol: string; blockchain: string | null; balance: string | number | null; private?: boolean }[];
  totals: { label: string; delivered: number; inFlight: number }[];
  payments: PaymentRow[];
};

const chainName = chainLabel;
const short = (a: string) => (a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const usd = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const COLORS = ["bg-mint", "bg-amber", "bg-sky", "bg-violet", "bg-pink"];
const PHASE = { shield: "Making private", swap: "Converting", withdraw: "Sending", done: "Delivered", failed: "Delayed" } as const;
const MOVING = new Set<Leg["phase"]>(["shield", "swap", "withdraw"]);
const PrivateTag = () => (
  <span className="inline-flex items-center gap-1 rounded-full bg-violet/15 px-2 py-0.5 text-[11px] font-semibold text-violet" title="Where this pot's money goes is hidden from the public">
    <LockIcon className="h-3 w-3" /> Private
  </span>
);
const OPEN = new Set(["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"]);
// Payment states in plain words (1Click's status codes underneath).
const PAYMENT_STATUS: Record<string, string> = {
  SUCCESS: "Paid",
  PENDING_DEPOSIT: "Waiting for payment",
  KNOWN_DEPOSIT_TX: "Payment spotted",
  PROCESSING: "Converting",
  INCOMPLETE_DEPOSIT: "Underpaid",
  REFUNDED: "Refunded to payer",
  FAILED: "Didn't go through",
};

export default function Dashboard({ handle }: { handle: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped after sign-in and after a retry, to (re)start live refreshing: the loop below stops
  // once nothing is moving, and a 401 before sign-in stops it too.
  const [pollKey, setPollKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch(`/api/dashboard/${handle}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      setNeedsSignIn(true);
      return null;
    }
    if (!res.ok) {
      setError(json.error ?? "Couldn't load your dashboard.");
      return null;
    }
    setNeedsSignIn(false);
    setError(null);
    setData(json);
    return json as Data;
  }, [handle]);

  // Initial load, then keep refreshing while anything is still moving.
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const d = await load().catch(() => null);
      if (stop) return;
      const moving = d?.payments.some((p) => OPEN.has(p.status) || p.legs.some((l) => MOVING.has(l.phase)));
      if (moving) timer = setTimeout(tick, 8000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [load, pollKey]);

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      const c = await fetch("/api/auth/challenge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handle }) }).then((r) => r.json());
      if (c.error) throw new Error(c.error);
      const credential = await signInWithPasskey(c);
      const v = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, challengeId: c.challengeId, credential }),
      }).then((r) => r.json());
      if (!v.ok) throw new Error(v.error ?? "Sign-in didn't work. Please try again.");
      setPollKey((k) => k + 1); // loads now and keeps refreshing while payments move
    } catch (e) {
      setError(passkeyErrorMessage(e, "Sign-in didn't work. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function retry(paymentId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/${handle}/retry`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId }) });
      if (!res.ok) setError((await res.json().catch(() => ({}))).error ?? "The retry didn't start. Please try again.");
      setPollKey((k) => k + 1); // the pots are moving again: resume live refreshing
    } catch {
      setError("Couldn't reach Allot. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setData(null);
    setNeedsSignIn(true);
  }

  if (needsSignIn) {
    return (
      <section className="card mx-auto max-w-md space-y-4 text-center">
        <div>
          <h1 className="text-2xl font-bold">Sign in to your dashboard</h1>
          <p className="mt-1 text-sm text-white/50">for /pay/{handle}</p>
        </div>
        <p className="text-white/60">Use the passkey you created this link with.</p>
        <button className="btn w-full" disabled={busy} onClick={signIn}>{busy ? "Waiting for your passkey…" : "Sign in with passkey"}</button>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <p className="text-xs text-white/45">
          Not your link? <Link className="underline" href="/dashboard">Open a different dashboard</Link>
        </p>
      </section>
    );
  }
  if (!data) return error ? <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : <p className="animate-pulse text-white/50">Loading your dashboard…</p>;

  const received = data.payments.filter((p) => p.status === "SUCCESS").reduce((s, p) => s + p.amountUsd, 0);
  const paidCount = data.payments.filter((p) => p.status === "SUCCESS").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-white/50">Dashboard</p>
          <h1 className="text-3xl font-bold tracking-tight">{data.name}</h1>
          <p className="text-sm text-white/60">
            {usd(received)} received from {paidCount} {paidCount === 1 ? "payment" : "payments"}
          </p>
        </div>
        <div className="flex gap-2">
          <a className="btn-ghost" href={`/api/dashboard/${handle}/csv`} title="A spreadsheet of every payment and where each pot's money went">
            Download for accountant (CSV)
          </a>
          <button className="btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>

      <RequestPayment handle={handle} />

      <h2 className="-mb-2 font-semibold">Your pots</h2>
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.rules.map((r, i) => (
          <div key={i} className="card space-y-1">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${COLORS[i % COLORS.length]}`} />
              <span className="font-semibold">{r.label}</span>
              <span className="text-sm text-white/50">{r.percent}%</span>
              {r.private && <PrivateTag />}
            </div>
            <div className="text-2xl font-bold">{usd(data.totals[i]?.delivered ?? 0)}</div>
            <div className="text-xs text-white/50">
              delivered{(data.totals[i]?.inFlight ?? 0) > 0 ? ` · ${usd(data.totals[i].inFlight)} on the way` : ""}
            </div>
            <div className="text-xs text-white/50">
              Paid out as {r.symbol} on {chainName(r.chain)} to <span className="font-mono">{short(r.address)}</span>
            </div>
          </div>
        ))}
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">Payments</h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-white/50">
            No payments yet. Share your link{" "}
            <Link className="underline" href={`/pay/${handle}`}>
              /pay/{handle}
            </Link>
            , or create a payment request above. Payments show up here as they arrive.
          </p>
        ) : (
          <ul className="divide-y divide-white/10">
            {data.payments.map((p) => (
              <li key={p.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="text-lg font-semibold">{usd(p.amountUsd)}</span>
                    {p.memo && <span className="text-white/60"> · {p.memo}</span>}
                    <div className="text-xs text-white/50">
                      {new Date(p.createdAt).toLocaleString()} · paid with {p.paidWith.amount} {p.paidWith.symbol} on {chainName(p.paidWith.chain)}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.status === "SUCCESS" ? "bg-mint/15 text-mint" : OPEN.has(p.status) ? "bg-white/5 text-white/60" : "bg-red-500/15 text-red-300"}`}>
                    {PAYMENT_STATUS[p.status] ?? p.status.replace(/_/g, " ").toLowerCase()}
                  </span>
                </div>
                {p.legs.length > 0 && (
                  <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {p.legs.map((l, i) => (
                      <li key={i} className="rounded-lg bg-white/[0.04] p-2.5 text-xs">
                        <div className="flex justify-between gap-2 font-semibold">
                          <span className="inline-flex items-center gap-1.5">
                            {l.private && <LockIcon className="h-3 w-3 text-violet" />}
                            {l.label} · {usd(l.amountUsdc)}
                          </span>
                          <span className={l.phase === "done" ? "text-mint" : l.phase === "failed" || l.review ? "text-amber" : "text-white/50"}>{l.review && MOVING.has(l.phase) ? "Being reviewed" : PHASE[l.phase]}</span>
                        </div>
                        <div className="text-white/50">{l.symbol} on {chainName(l.chain)} to <span className="font-mono">{short(l.to)}</span></div>
                        {l.txUrl && <a className="text-mint underline" href={l.txUrl} target="_blank" rel="noreferrer">View on the blockchain ↗</a>}
                        {(l.phase === "failed" || l.review) && l.error && <div className="mt-1 text-amber">{l.error.slice(0, 140)}</div>}
                      </li>
                    ))}
                  </ul>
                )}
                {p.legs.some((l) => l.phase === "failed") && (
                  <div className="flex flex-wrap items-center gap-3">
                    <button className="btn-ghost text-xs" disabled={busy} onClick={() => retry(p.id)}>Retry delayed pots</button>
                    <span className="text-xs text-white/45">Money is safe in your wallet.</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Your wallet</h2>
        <p className="text-sm text-white/60">
          Only you control this wallet. It can only send money to your addresses below.
        </p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="label">Money can only go to</span>
            <ul className="space-y-1 font-mono text-xs">
              {data.rules.map((r, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  {r.private && <LockIcon className="h-3 w-3 text-violet" />}
                  {chainName(r.chain)}: {r.address}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <span className="label">In your wallet right now</span>
            {data.balances.length === 0 ? (
              <p className="text-xs text-white/50">Nothing. Every payment has been paid out to your pots.</p>
            ) : (
              <ul className="space-y-1 text-xs">
                {data.balances.map((b, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    {b.private && <LockIcon className="h-3 w-3 text-violet" />}
                    {String(b.balance)} {b.symbol}
                    {b.blockchain ? ` (${chainName(b.blockchain)})` : ""}
                    {b.private && <span className="text-white/40">· private</span>}
                  </li>
                ))}
              </ul>
            )}
            {data.wallet.intentsAccount && (
              <a className="mt-2 block break-all text-xs text-mint underline" href={`https://nearblocks.io/address/${data.wallet.intentsAccount}`} target="_blank" rel="noreferrer">
                View your wallet on the NEAR explorer ↗
              </a>
            )}
          </div>
        </div>
        <GrantRenewal handle={handle} grant={data.grant} onRenewed={() => setPollKey((k) => k + 1)} />
      </section>
      {error && <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
