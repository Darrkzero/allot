"use client";

import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/** Builds a pay link with the amount and memo filled in, for the owner to send a client. */
export function RequestPayment({ handle }: { handle: string }) {
  const origin = useSyncExternalStore(noopSubscribe, () => location.origin, () => "");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [copied, setCopied] = useState(false);
  const qs = new URLSearchParams();
  if (Number(amount) > 0) qs.set("amount", amount);
  if (memo.trim()) qs.set("memo", memo.trim());
  const link = `${origin}/pay/${handle}${qs.size ? `?${qs}` : ""}`;
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="font-semibold">Request a payment</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
        <div>
          <label className="label" htmlFor="req-amount">Amount (USD)</label>
          <input id="req-amount" className="input" inputMode="decimal" placeholder="250.00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} />
        </div>
        <div>
          <label className="label" htmlFor="req-memo">What it&apos;s for (optional)</label>
          <input id="req-memo" className="input" placeholder="e.g. Invoice #12, logo design" maxLength={140} value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <input readOnly className="input font-mono text-xs" value={link} aria-label="Link to send your client" />
        <button
          className="btn-ghost"
          onClick={() => {
            navigator.clipboard.writeText(link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </section>
  );
}
