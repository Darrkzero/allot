"use client";

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { LockIcon } from "@/components/ui/lock-icon";
import { chainLabel } from "@/lib/assets";

type Tx = { hash: string; explorerUrl?: string };
type Payment = {
  id: string;
  handle: string;
  name: string;
  amountUsd: number;
  memo: string | null;
  pay: { amount: string; symbol: string; chain: string; depositAddress: string; depositMemo: string | null; deadline: string | null };
  status: string;
  txs: { origin: Tx[]; destination: Tx[] };
  refunded: string | null;
  split: {
    label: string;
    percent: number;
    symbol: string;
    chain: string;
    private: boolean;
    review: boolean;
    amountUsdc: number;
    phase: "shield" | "swap" | "withdraw" | "done" | "failed";
  }[];
};

const splitFinished = (p: Payment) => p.split.length > 0 && p.split.every((l) => l.phase === "done" || l.phase === "failed");
const PHASE_TEXT = { shield: "Making private", swap: "Converting", withdraw: "Sending", done: "Delivered", failed: "Delayed, held safely" } as const;

const steps = (name: string) => [
  { key: "PENDING_DEPOSIT", label: "Waiting for your payment" },
  { key: "KNOWN_DEPOSIT_TX", label: "We've spotted your payment" },
  { key: "PROCESSING", label: "Converting it to US dollars" },
  { key: "SUCCESS", label: `Delivered to ${name}` },
];
const FINAL = new Set(["SUCCESS", "REFUNDED", "FAILED"]);

function formatLeft(ms: number) {
  const m = Math.floor(ms / 60000);
  if (m >= 48 * 60) return `${Math.floor(m / 1440)} days`;
  if (m >= 120) return `${Math.floor(m / 60)} hours`;
  if (m >= 1) return `${m} min`;
  return `${Math.floor(ms / 1000)} s`;
}

/** A "Copy" button that confirms it worked. */
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost shrink-0 px-3 text-sm"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export default function StatusView({ id }: { id: string }) {
  const [p, setP] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<string>("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const res = await fetch(`/api/pay/${id}`, { cache: "no-store" });
        const json = await res.json();
        if (stop) return;
        if (!res.ok) {
          setError(res.status === 404 ? "We couldn't find this payment. Check the link, or start a new payment." : (json.error ?? "Couldn't load this payment. Retrying…"));
          if (res.status === 404) return; // no such payment: polling won't change that
        } else {
          setError(null);
          setP(json);
          // Stop when refunded/failed, or when paid AND every pot has finished.
          if (FINAL.has(json.status) && (json.status !== "SUCCESS" || splitFinished(json))) return;
        }
      } catch {
        if (!stop) setError("Connection problem. Retrying…");
      }
      timer = setTimeout(load, 5000);
    };
    load();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [id]);

  useEffect(() => {
    if (p?.pay.depositAddress) QRCode.toDataURL(p.pay.depositAddress, { margin: 1, width: 220 }).then(setQr).catch(() => {});
  }, [p?.pay.depositAddress]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (error && !p) return <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">{error}</p>;
  if (!p) return <p className="animate-pulse text-white/50">Loading your payment…</p>;

  const STEPS = steps(p.name);
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === p.status));
  const failed = p.status === "REFUNDED" || p.status === "FAILED" || p.status === "INCOMPLETE_DEPOSIT";
  const waiting = p.status === "PENDING_DEPOSIT";
  const msLeft = p.pay.deadline ? new Date(p.pay.deadline).getTime() - now : null;
  const expired = msLeft !== null && msLeft <= 0;
  const network = chainLabel(p.pay.chain);
  const done = p.status === "SUCCESS" && splitFinished(p);

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-[1fr_300px]">
      <section className="card space-y-5">
        <div>
          <p className="text-sm text-white/50">Payment to {p.name}</p>
          <h1 className="text-3xl font-bold tracking-tight">${p.amountUsd.toFixed(2)}</h1>
          {p.memo && <p className="mt-1 text-sm text-white/60">For: {p.memo}</p>}
        </div>

        {waiting && !expired && (
          <div className="space-y-3 rounded-xl border border-mint/30 bg-mint/[0.06] p-4">
            <p className="text-sm font-semibold">Send exactly this amount:</p>
            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
              <p className="min-w-0 flex-1 break-all text-lg font-bold">
                {p.pay.amount} {p.pay.symbol} <span className="text-sm font-medium text-white/60">on {network}</span>
              </p>
              <CopyButton text={p.pay.amount} label="Copy amount" />
            </div>
            <p className="text-sm font-semibold">To this address:</p>
            <div className="flex gap-2">
              <input readOnly className="input font-mono text-xs" value={p.pay.depositAddress} aria-label="Payment address" />
              <CopyButton text={p.pay.depositAddress} />
            </div>
            {p.pay.depositMemo && (
              <div className="flex items-center gap-2 text-sm">
                <span>
                  Memo (required): <code className="rounded bg-white/10 px-1">{p.pay.depositMemo}</code>
                </span>
                <CopyButton text={p.pay.depositMemo} label="Copy memo" />
              </div>
            )}
            <p className="rounded-lg bg-amber/10 p-2.5 text-xs text-amber">
              Only send {p.pay.symbol} on {network}. Anything else may be lost.
            </p>
            {msLeft !== null && <p className="text-xs text-white/60">Valid for {formatLeft(msLeft)}.</p>}
          </div>
        )}

        {waiting && expired && (
          <div className="rounded-xl bg-white/[0.04] p-4 text-sm">
            This payment address has expired, so don&apos;t send anything to it.{" "}
            <Link className="text-mint underline" href={`/pay/${p.handle}`}>
              Start a new payment
            </Link>
            .
          </div>
        )}

        {failed ? (
          <div role="alert" className="rounded-xl bg-red-500/10 p-4 text-sm text-red-300">
            {p.status === "REFUNDED" && (
              <>This payment couldn&apos;t be completed, so your money was sent back{p.refunded ? ` (${p.refunded} ${p.pay.symbol})` : ""} to your refund address.</>
            )}
            {p.status === "FAILED" && <>This payment didn&apos;t go through. If you already sent money, it will be returned to your refund address automatically.</>}
            {p.status === "INCOMPLETE_DEPOSIT" && (
              <>We received less than the amount needed. Send the rest to the same address, or wait: after the deadline, what you sent is refunded automatically.</>
            )}
          </div>
        ) : (
          <ol className="space-y-3" aria-label="Payment progress">
            {STEPS.map((s, i) => {
              const complete = i < stepIndex || p.status === "SUCCESS";
              return (
                <li key={s.key} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                      complete ? "bg-mint text-[#04120c]" : i === stepIndex ? "animate-pulse bg-mint/25 text-mint" : "bg-white/10 text-white/40"
                    }`}
                  >
                    {complete ? "✓" : i + 1}
                  </span>
                  <span className={i <= stepIndex ? "font-medium" : "text-white/40"}>{s.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {p.status === "SUCCESS" && (
          <div className="space-y-2 rounded-xl border border-white/10 p-4">
            <p className="text-sm font-semibold">
              Split into {p.name}&apos;s pots {done ? <span className="text-mint">· done</span> : <span className="animate-pulse text-white/60">· in progress…</span>}
            </p>
            {p.split.length === 0 ? (
              <p className="text-sm text-white/50">Getting ready to split…</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {p.split.map((l, i) => (
                  <li key={i} className="flex items-center justify-between gap-2">
                    {l.private ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1.5 text-violet" title="Where this part goes is kept private">
                          <LockIcon /> Private pot
                        </span>
                        <span className="text-white/50">· {l.percent}%</span>
                      </span>
                    ) : (
                      <span>
                        {l.label} <span className="text-white/50">· {l.percent}% · {l.symbol} on {chainLabel(l.chain)}</span>
                      </span>
                    )}
                    <span className={`whitespace-nowrap text-xs font-semibold ${l.phase === "done" ? "text-mint" : l.phase === "failed" ? "text-amber" : "text-white/60"}`}>
                      ${l.amountUsdc.toFixed(2)} · {l.review && l.phase !== "done" && l.phase !== "failed" ? "Being reviewed by NEAR" : PHASE_TEXT[l.phase]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(p.txs.origin.length > 0 || p.txs.destination.length > 0) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {p.txs.origin.map((t) => (
              <a key={t.hash} href={t.explorerUrl} target="_blank" rel="noreferrer" className="text-mint underline" title={t.hash}>
                Your payment on the blockchain ↗
              </a>
            ))}
            {p.txs.destination.map((t) => (
              <a key={t.hash} href={t.explorerUrl} target="_blank" rel="noreferrer" className="text-mint underline" title={t.hash}>
                Delivery to {p.name} ↗
              </a>
            ))}
          </div>
        )}
      </section>

      <aside className="card h-fit space-y-3 text-center">
        {waiting && !expired && qr ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qr} alt={`QR code of the payment address on ${network}`} className="mx-auto rounded-lg" width={220} height={220} />
            <p className="text-xs text-white/55">Scan with your wallet ({network} network).</p>
          </>
        ) : (
          <div className="space-y-1.5 text-sm" aria-live="polite">
            {done && <p className="text-lg font-semibold text-mint">✓ All done</p>}
            <p className="text-white/65">
              {done
                ? `${p.name} has been paid. You can close this page.`
                : p.status === "SUCCESS"
                  ? `Payment received. Now splitting it into ${p.name}'s pots. You can close this page.`
                  : failed
                    ? "This payment didn't complete. See the details on the left."
                    : waiting
                      ? "This payment link has expired."
                      : "Your payment is on its way. This page updates by itself."}
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
