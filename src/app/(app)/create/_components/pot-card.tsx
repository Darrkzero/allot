"use client";

import { useId } from "react";
import { AssetSelect, type AssetOption } from "@/components/ui/asset-select";
import { LockIcon } from "@/components/ui/lock-icon";
import { CHAIN_NAMES, checkAddress, privateSupported, type ChainId } from "@/lib/assets";
import type { Rule } from "@/lib/rules";
import { POT_COLORS } from "./split-bar";

/** One pot: its name, share, payout currency, wallet address and Private switch. */
export function PotCard({
  index: i,
  rule: r,
  options,
  disabled,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  rule: Rule;
  options: AssetOption[];
  disabled: boolean;
  canRemove: boolean;
  onChange: (patch: Partial<Rule>) => void;
  onRemove: () => void;
}) {
  const addr = r.address ? checkAddress(r.chain, r.address) : null;
  const chainName = CHAIN_NAMES[r.chain] ?? r.chain;
  return (
    <div className="space-y-3 rounded-xl border border-white/10 p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold text-white/80">
          <span className={`h-2.5 w-2.5 rounded-full ${POT_COLORS[i % POT_COLORS.length]}`} />
          Pot {i + 1}
          {r.private && <LockIcon className="h-3 w-3 text-violet" />}
        </span>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-xs text-white/45 transition hover:bg-white/5 hover:text-white/80 disabled:invisible"
          disabled={disabled || !canRemove}
          onClick={onRemove}
        >
          Remove pot
        </button>
      </div>
      <div className="grid grid-cols-[1fr_96px] gap-3 sm:grid-cols-[1.1fr_96px_1.4fr]">
        <div>
          <label className="label" htmlFor={`pot-${i}-name`}>Pot name</label>
          <input id={`pot-${i}-name`} className="input" value={r.label} disabled={disabled} maxLength={40} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Taxes" />
        </div>
        <div>
          <label className="label" htmlFor={`pot-${i}-share`}>Share</label>
          <div className="flex items-center gap-1">
            <input id={`pot-${i}-share`} className="input" type="number" min={1} max={100} value={r.percent} disabled={disabled} onChange={(e) => onChange({ percent: Number(e.target.value) })} />
            <span className="text-sm text-white/60">%</span>
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <span className="label">Paid out as</span>
          <AssetSelect
            label="Paid out as"
            value={{ symbol: r.symbol, chain: r.chain }}
            options={options.length ? options : [{ symbol: r.symbol, chain: r.chain }]}
            disabled={disabled}
            onChange={(o) => onChange({ symbol: o.symbol, chain: o.chain, private: !!r.private && privateSupported(o.chain) })}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor={`pot-${i}-address`}>Wallet address</label>
        <input
          id={`pot-${i}-address`}
          className="input font-mono"
          value={r.address}
          disabled={disabled}
          onChange={(e) => onChange({ address: e.target.value.trim() })}
          placeholder={`Your ${chainName} address`}
          aria-invalid={addr ? !addr.ok : undefined}
        />
        {addr && !addr.ok && <p className="mt-1.5 text-xs text-red-400">{addr.error}</p>}
      </div>
      <PrivateToggle checked={!!r.private} chain={r.chain} disabled={disabled} onChange={(v) => onChange({ private: v })} />
    </div>
  );
}

/** Per-pot switch: route this pot's payouts through NEAR Confidential Intents. */
function PrivateToggle({ checked, chain, disabled, onChange }: { checked: boolean; chain: ChainId; disabled: boolean; onChange: (v: boolean) => void }) {
  const id = useId();
  const available = privateSupported(chain);
  const chainName = CHAIN_NAMES[chain] ?? chain;
  return (
    <div
      className="flex items-center gap-3 border-t border-white/[0.06] pt-3"
      title={`Payers and public blockchain explorers can't see where this pot's money goes (NEAR Confidential Intents). Not encrypted: NEAR's operators can, and the final payment shows on ${chainName}.`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-hint`}
        disabled={disabled || !available}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-40 ${
          checked ? "border-violet/60 bg-violet/30" : "border-white/15 bg-white/[0.06]"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 grid h-[18px] w-[18px] place-items-center rounded-full shadow transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            checked ? "translate-x-5 bg-violet text-[#0b0d12]" : "bg-white/70 text-transparent"
          }`}
        >
          <LockIcon className="h-2.5 w-2.5" />
        </span>
      </button>
      <p className="text-xs">
        <span id={`${id}-label`} className={`font-semibold ${checked ? "text-violet" : "text-white/75"}`}>
          Private pot
        </span>{" "}
        <span id={`${id}-hint`} className="text-white/45">
          {!available ? `· Not available on ${chainName}` : checked ? "· Hidden from public view" : ""}
        </span>
      </p>
    </div>
  );
}
