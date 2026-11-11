"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

export function Done({ handle }: { handle: string }) {
  const origin = useSyncExternalStore(noopSubscribe, () => location.origin, () => "");
  const [copied, setCopied] = useState(false);
  const link = `${origin}/pay/${handle}`;
  return (
    <section className="card max-w-xl space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Your payment link is live 🎉</h2>
        <p className="mt-1 text-white/60">Share it with anyone who pays you.</p>
      </div>
      <div className="flex gap-2">
        <input readOnly className="input font-mono" value={link} aria-label="Your payment link" />
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
      <div className="flex flex-wrap gap-2">
        <Link href={`/pay/${handle}`} className="btn">Open my payment page</Link>
        <Link href={`/dashboard/${handle}`} className="btn-ghost">Go to my dashboard</Link>
      </div>
    </section>
  );
}
