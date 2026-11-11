"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { AssetOption } from "@/components/ui/asset-select";
import { StepTitle } from "@/components/ui/step-title";
import { checkAddress } from "@/lib/assets";
import { createPasskey, passkeyErrorMessage, passkeysSupported, signIntent, type PasskeyOwner } from "@/lib/client/passkey";
import { HANDLE_RE, MAX_RULES, type Rule } from "@/lib/rules";
import { Done } from "./done";
import { PayoutPreview } from "./payout-preview";
import { PotCard } from "./pot-card";
import { TotalBadge } from "./split-bar";

type Intent = { standard: string; payload: Record<string, unknown> };
type Phase =
  | { kind: "edit" }
  | { kind: "busy"; message: string; step: 0 | 1 | 2 }
  | { kind: "sign"; step: "create" | "grant"; correlation_id: string; intent: Intent; summary?: string }
  | { kind: "done"; handle: string };

const noopSubscribe = () => () => {};

const DEFAULT_RULES: Rule[] = [
  { label: "Spending", percent: 70, symbol: "USDC", chain: "base", address: "" },
  { label: "Tax reserve", percent: 20, symbol: "USDT", chain: "tron", address: "" },
  { label: "Savings", percent: 10, symbol: "BTC", chain: "btc", address: "" },
];

const OFFLINE = "Couldn't reach Allot. Check your internet connection and try again.";

export default function CreateForm() {
  const [options, setOptions] = useState<AssetOption[]>([]);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [rules, setRules] = useState<Rule[]>(DEFAULT_RULES);
  const [phase, setPhase] = useState<Phase>({ kind: "edit" });
  const [error, setError] = useState<string | null>(null);
  const supported = useSyncExternalStore(noopSubscribe, passkeysSupported, () => true);
  const host = useSyncExternalStore(noopSubscribe, () => location.host, () => "");

  useEffect(() => {
    fetch("/api/options").then((r) => r.json()).then((j) => setOptions(j.payout ?? [])).catch(() => {});
  }, []);

  const total = rules.reduce((s, r) => s + (Number(r.percent) || 0), 0);
  const problems = useMemo(() => {
    const p: string[] = [];
    if (!name.trim()) p.push("Add your name");
    if (!HANDLE_RE.test(handle)) p.push(handle ? "Link name: 3 to 30 letters, numbers or dashes" : "Choose a link name");
    rules.forEach((r, i) => {
      const pot = r.label.trim() ? `"${r.label.trim()}"` : `Pot ${i + 1}`;
      if (!r.label.trim()) p.push(`Pot ${i + 1}: add a name`);
      if (!r.address) p.push(`${pot}: add a wallet address`);
      else if (!checkAddress(r.chain, r.address).ok) p.push(`${pot}: check the wallet address`);
    });
    if (total !== 100) p.push(`Shares add up to ${total}%, not 100%`);
    return p;
  }, [name, handle, rules, total]);

  const update = (i: number, patch: Partial<Rule>) => setRules((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function start() {
    setError(null);
    let owner: PasskeyOwner;
    try {
      setPhase({ kind: "busy", step: 0, message: "Creating your passkey. Follow the prompt on your device…" });
      owner = await createPasskey(handle, name);
    } catch (e) {
      setPhase({ kind: "edit" });
      setError(passkeyErrorMessage(e, "Creating your passkey didn't work. Please try again."));
      return;
    }
    setPhase({ kind: "busy", step: 1, message: "Preparing your wallet…" });
    try {
      const res = await fetch("/api/routers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, handle, rules, owner }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase({ kind: "edit" });
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      setPhase({ kind: "sign", step: "create", correlation_id: json.correlation_id, intent: json.intent, summary: json.summary });
    } catch {
      setPhase({ kind: "edit" });
      setError(OFFLINE);
    }
  }

  async function approve(p: Extract<Phase, { kind: "sign" }>) {
    setError(null);
    let signed_data;
    try {
      signed_data = await signIntent(p.intent);
    } catch (e) {
      setError(passkeyErrorMessage(e, "Confirming with your passkey didn't work. Please try again."));
      return;
    }
    setPhase({
      kind: "busy",
      step: p.step === "create" ? 1 : 2,
      message: p.step === "create" ? "Creating your wallet on NEAR. This can take up to a minute…" : "Turning on automatic splitting…",
    });
    try {
      const res = await fetch(`/api/routers/${handle}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: p.step, correlation_id: p.correlation_id, signed_data }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase(p);
        setError(json.error ?? "Something went wrong. Please try again.");
        return;
      }
      if (json.step === "grant") setPhase({ kind: "sign", step: "grant", correlation_id: json.correlation_id, intent: json.intent, summary: json.summary });
      else setPhase({ kind: "done", handle });
    } catch {
      setPhase(p);
      setError(OFFLINE);
    }
  }

  if (phase.kind === "done") return <Done handle={phase.handle} />;

  const locked = phase.kind !== "edit";
  // Progress through the three confirmations: passkey, wallet + pots, auto-split.
  const progress = phase.kind === "edit" ? -1 : phase.kind === "busy" ? phase.step : phase.step === "create" ? 1 : 2;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <section className="card space-y-4">
          <StepTitle n={1} title="About you" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Your name</label>
              <input id="name" className="input" value={name} disabled={locked} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ada Lovelace or Ada Design Studio" />
            </div>
            <div>
              <label className="label" htmlFor="handle">Your link name</label>
              <div className="flex items-center gap-1 text-sm text-white/50">
                <span>/pay/</span>
                <input id="handle" className="input" value={handle} disabled={locked} maxLength={30} onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} placeholder="ada" aria-describedby="handle-hint" />
              </div>
              {handle && (
                <p id="handle-hint" className="mt-1.5 truncate text-xs text-white/45">
                  {host}/pay/{handle}
                </p>
              )}
            </div>
          </div>
        </section>

        <section className="card space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <StepTitle n={2} title="Your pots" hint="Every payment is split between these." />
            <TotalBadge total={total} />
          </div>
          {rules.map((r, i) => (
            <PotCard
              key={i}
              index={i}
              rule={r}
              options={options}
              disabled={locked}
              canRemove={rules.length > 1}
              onChange={(patch) => update(i, patch)}
              onRemove={() => setRules((rs) => rs.filter((_, j) => j !== i))}
            />
          ))}
          {rules.length < MAX_RULES && !locked && (
            <button type="button" className="btn-ghost" onClick={() => setRules((rs) => [...rs, { label: "", percent: Math.max(0, 100 - total), symbol: "USDC", chain: "base", address: "" }])}>
              + Add a pot
            </button>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <PayoutPreview rules={rules} />

        <section className="card space-y-4">
          <StepTitle n={3} title="Lock it in" hint="Confirm with your fingerprint, Face ID or PIN." />
          <ol className="space-y-2 text-sm">
            {["Create passkey", "Confirm pots", "Turn on auto-split"].map((label, i) => {
              const state = progress > i ? "done" : progress === i ? "now" : "todo";
              return (
                <li key={label} className="flex items-center gap-2.5">
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                      state === "done" ? "bg-mint text-[#04120c]" : state === "now" ? "animate-pulse bg-mint/25 text-mint" : "bg-white/10 text-white/40"
                    }`}
                  >
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={state === "todo" ? "text-white/45" : "text-white/85"}>{label}</span>
                </li>
              );
            })}
          </ol>

          {phase.kind === "edit" && (
            <>
              {!supported && <p className="text-sm text-red-400">This browser doesn&apos;t support passkeys. Try a recent version of Chrome, Edge or Safari.</p>}
              {problems.length > 0 && (
                <div className="rounded-lg bg-white/[0.04] p-3">
                  <p className="mb-1 text-xs font-semibold text-white/70">Before you continue:</p>
                  <ul className="list-disc space-y-1 pl-5 text-xs text-white/60">
                    {problems.slice(0, 3).map((p) => <li key={p}>{p}</li>)}
                    {problems.length > 3 && <li>and {problems.length - 3} more</li>}
                  </ul>
                </div>
              )}
              <button className="btn w-full" disabled={problems.length > 0 || !supported} onClick={start}>
                Create my payment link
              </button>
            </>
          )}
          {phase.kind === "busy" && <p className="animate-pulse rounded-lg bg-white/[0.04] p-3 text-sm font-medium">{phase.message}</p>}
          {phase.kind === "sign" && (
            <>
              <p className="text-sm font-semibold">
                {phase.step === "create" ? "Step 2 of 3: confirm your pots" : "Step 3 of 3: turn on automatic splitting"}
              </p>
              {phase.summary && (
                <details className="rounded-lg bg-white/[0.04] p-3 text-xs text-white/60">
                  <summary className="cursor-pointer font-medium text-white/75">What you&apos;re approving</summary>
                  <p className="mt-2">{phase.summary}</p>
                </details>
              )}
              <button className="btn w-full" onClick={() => approve(phase)}>
                Confirm with passkey
              </button>
            </>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </p>
          )}
        </section>
      </aside>
    </div>
  );
}
