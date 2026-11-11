"use client";

import { useState, useSyncExternalStore } from "react";
import { signIntent } from "@/lib/client/passkey";

export type GrantInfo = { expiresAt: string; renewWithinDays: number };

const noopSubscribe = () => () => {};

/**
 * The split engine's permission (grant) lapses after 90 days; then payments still arrive but stay
 * in the wallet unsplit. One passkey approval renews it. Highlighted once renewal is due.
 */
export function GrantRenewal({ handle, grant, onRenewed }: { handle: string; grant: GrantInfo; onRenewed: () => void }) {
  const now = useSyncExternalStore(noopSubscribe, () => Math.floor(Date.now() / 60_000) * 60_000, () => 0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const expires = Date.parse(grant.expiresAt);
  const daysLeft = Math.floor((expires - now) / 86_400_000);
  const expired = now > 0 && expires <= now;
  const due = now > 0 && daysLeft <= grant.renewWithinDays;
  const when = new Date(expires).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

  async function renew() {
    setBusy(true);
    setNote(null);
    try {
      const post = async (body: unknown) => {
        const res = await fetch(`/api/dashboard/${handle}/grant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Renewal failed.");
        return json;
      };
      const start = await post({ step: "start" });
      const signed_data = await signIntent(start.intent);
      const done = await post({ step: "sign", correlation_id: start.correlation_id, signed_data });
      setNote({ ok: true, text: `Renewed until ${new Date(done.expiresAt).toLocaleDateString()}.` });
      onRenewed();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : "Renewal failed." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm ${due ? "border-amber/40 bg-amber/[0.06]" : "border-white/10"}`}>
      <div>
        <span className="label mb-0.5">Auto-split permission</span>
        <p className={due ? "text-amber" : "text-white/70"}>
          {expired
            ? `Expired on ${when}. Renew to resume auto-split.`
            : due
              ? `Expires on ${when}. Renew to keep it running.`
              : `Valid until ${when}.`}
        </p>
        {note && <p className={`mt-1 text-xs ${note.ok ? "text-mint" : "text-red-300"}`}>{note.text}</p>}
      </div>
      <button className={due ? "btn" : "btn-ghost"} disabled={busy} onClick={renew}>
        {busy ? "Waiting for your passkey…" : "Renew for 90 days"}
      </button>
    </div>
  );
}
