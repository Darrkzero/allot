"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { AssetIcon } from "@/components/ui/asset-icon";
import { CHAIN_NAMES, type ChainId } from "@/lib/assets";

export type AssetOption = { symbol: string; chain: ChainId };

type Place = { left: number; width: number; top?: number; bottom?: number; maxHeight: number; up: boolean };

const GAP = 6;
const MAX_H = 340;
const keyOf = (o: AssetOption) => `${o.symbol}:${o.chain}`;
const textOf = (o: AssetOption) => `${o.symbol} on ${CHAIN_NAMES[o.chain] ?? o.chain}`;

/** Where to put the menu: below the trigger, or above it when there's more room there. */
function measure(b: HTMLElement | null): Place | null {
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const below = window.innerHeight - r.bottom - GAP - 12;
  const above = r.top - GAP - 12;
  const up = below < Math.min(MAX_H, 260) && above > below;
  return {
    left: r.left,
    width: r.width,
    top: up ? undefined : r.bottom + GAP,
    bottom: up ? window.innerHeight - r.top + GAP : undefined,
    maxHeight: Math.max(160, Math.min(MAX_H, up ? above : below)),
    up,
  };
}

/**
 * Dropdown for "receive as" choices that shows each token's logo with its network badge.
 * A native <select> can't render images in its options, so this is an ARIA listbox:
 * arrows / Home / End move, Enter or Space picks, Esc closes, letters jump (type-ahead).
 */
export function AssetSelect({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: AssetOption;
  options: AssetOption[];
  onChange: (o: AssetOption) => void;
  disabled?: boolean;
  label: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [place, setPlace] = useState<Place | null>(null);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const open = place !== null;
  const selected = options.findIndex((o) => keyOf(o) === keyOf(value)); // -1: current value not offered

  function show(at = Math.max(0, selected)) {
    if (disabled) return;
    setActive(at);
    setPlace(measure(buttonRef.current));
  }

  function close(refocus = true) {
    setPlace(null);
    if (refocus) buttonRef.current?.focus();
  }

  function pick(i: number) {
    const o = options[i];
    if (o) onChange(o);
    close();
  }

  // While open: follow the trigger when the page scrolls or resizes, and focus the list.
  useEffect(() => {
    if (!open) return;
    listRef.current?.focus({ preventScroll: true });
    const follow = () => setPlace(measure(buttonRef.current));
    window.addEventListener("scroll", follow, true);
    window.addEventListener("resize", follow);
    return () => {
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("resize", follow);
    };
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    const move = (i: number) => {
      e.preventDefault();
      setActive(Math.max(0, Math.min(last, i)));
    };
    switch (e.key) {
      case "ArrowDown":
        return move(active + 1);
      case "ArrowUp":
        return move(active - 1);
      case "Home":
        return move(0);
      case "End":
        return move(last);
      case "PageDown":
        return move(active + 6);
      case "PageUp":
        return move(active - 6);
      case "Enter":
      case " ":
        e.preventDefault();
        return pick(active);
      case "Escape":
        e.preventDefault();
        return close();
      case "Tab":
        return close(false);
    }
    if (e.key.length === 1 && /\S/.test(e.key)) {
      // Type-ahead: "us" jumps to the first USDC/USDT option, "sol" to SOL, etc.
      const now = e.timeStamp;
      const t = typed.current;
      t.text = (now - t.at > 600 ? "" : t.text) + e.key.toLowerCase();
      t.at = now;
      const hit = options.findIndex((o) => textOf(o).toLowerCase().startsWith(t.text));
      if (hit >= 0) setActive(hit);
    }
  }

  function onButtonKey(e: KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      show();
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="input group flex items-center gap-3 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label}: ${textOf(value)}`}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onButtonKey}
      >
        <AssetIcon key={keyOf(value)} symbol={value.symbol} chain={value.chain} size={24} className="asset-pop -my-1" />
        <span className="min-w-0 flex-1 truncate">
          <span className="font-semibold">{value.symbol}</span>
          <span className="text-white/60"> on {CHAIN_NAMES[value.chain] ?? value.chain}</span>
        </span>
        <svg viewBox="0 0 16 16" aria-hidden className={`h-4 w-4 shrink-0 text-white/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
          <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open &&
        createPortal(
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={`${id}-${active}`}
            onKeyDown={onListKey}
            onBlur={(e) => {
              const to = e.relatedTarget as Node | null;
              if (to && (to === buttonRef.current || listRef.current?.contains(to))) return;
              close(false);
            }}
            className={`menu-pop fixed z-50 overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-[#101218] p-1.5 shadow-[0_24px_60px_-12px_rgb(0_0_0/0.85),0_0_0_1px_rgb(255_255_255/0.03)_inset] outline-none ${
              place.up ? "origin-bottom" : "origin-top"
            }`}
            style={{ left: place.left, width: place.width, top: place.top, bottom: place.bottom, maxHeight: place.maxHeight }}
          >
            {options.map((o, i) => {
              const isSel = i === selected;
              const isActive = i === active;
              const newGroup = i > 0 && options[i - 1].symbol !== o.symbol;
              return (
                <li key={keyOf(o)} role="presentation">
                  {newGroup && <div aria-hidden className="mx-2 my-1 h-px bg-white/[0.07]" />}
                  <div
                    id={`${id}-${i}`}
                    role="option"
                    aria-selected={isSel}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => !isActive && setActive(i)}
                    onClick={() => pick(i)}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-sm transition-colors ${
                      isActive ? "bg-white/[0.07]" : ""
                    }`}
                  >
                    <AssetIcon symbol={o.symbol} chain={o.chain} size={24} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{o.symbol}</span>
                      <span className="text-white/55"> on {CHAIN_NAMES[o.chain] ?? o.chain}</span>
                    </span>
                    {isSel && (
                      <svg viewBox="0 0 16 16" aria-hidden className="h-4 w-4 shrink-0 text-mint">
                        <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>,
          document.body,
        )}
    </>
  );
}
