"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

// Lightweight motion primitives (no animation library): everything animates transform/opacity
// via CSS, and JS only flips a class when an element scrolls into view.

/** Fades/rises/un-blurs its children when scrolled into view. `delay` staggers siblings. */
export function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "li" | "p" | "span" }) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={`reveal ${shown ? "is-in" : ""} ${className}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

const LANDED = "allot:coins-landed";
const LANDED_FALLBACK_MS = 5000; // if WebGL is slow/unavailable, don't hold the hero hostage

/** Calls `fn` once when the 3D coins lock into orbit (or after a fallback timeout). */
function useCoinsLanded(fn: () => void) {
  useEffect(() => {
    let done = false;
    const go = () => {
      if (done) return;
      done = true;
      fn();
    };
    window.addEventListener(LANDED, go);
    const t = setTimeout(go, LANDED_FALLBACK_MS);
    return () => {
      window.removeEventListener(LANDED, go);
      clearTimeout(t);
    };
  }, [fn]);
}

/** Wraps hero elements that should enter only once the coins have landed (CSS: .after-coins). */
export function AfterCoins({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [landed, setLanded] = useState(false);
  const onLanded = useCallback(() => setLanded(true), []);
  useCoinsLanded(onLanded);
  return <div className={`${className} ${landed ? "coins-landed" : "coins-waiting"}`}>{children}</div>;
}

/** Counts a number up once the coins land (used in the hero cards). */
export function CountUp({ to, decimals = 0, prefix = "", delay = 0, duration = 1400 }: { to: number; decimals?: number; prefix?: string; delay?: number; duration?: number }) {
  const [v, setV] = useState(0);
  const [go, setGo] = useState(false);
  const onLanded = useCallback(() => setGo(true), []);
  useCoinsLanded(onLanded);
  useEffect(() => {
    if (!go) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / duration));
      setV(to * (1 - Math.pow(1 - p, 4))); // ease-out quart
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [go, to, delay, duration]);
  return (
    <span className="tabular-nums">
      {prefix}
      {v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

/** Types lines out one after another once visible (the security "terminal"). */
export function TypedLines({ lines, speed = 22, gap = 350 }: { lines: { text: string; className?: string }[]; speed?: number; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [chars, setChars] = useState(0);
  const total = lines.reduce((s, l) => s + l.text.length, 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setStarted(true);
        io.disconnect();
      }
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started || chars >= total) return;
    // Pause a beat at the end of each line.
    let acc = 0;
    let atLineEnd = false;
    for (const l of lines) {
      acc += l.text.length;
      if (chars === acc) atLineEnd = true;
    }
    const t = setTimeout(() => setChars((c) => c + 1), atLineEnd ? gap : speed);
    return () => clearTimeout(t);
  }, [started, chars, total, lines, speed, gap]);

  // Start offset of each line in the overall character count.
  const starts = lines.map((_, i) => lines.slice(0, i).reduce((s, l) => s + l.text.length, 0));
  // Cursor sits on the first line not fully typed yet (or the last line when done).
  const firstUnfinished = lines.findIndex((l, i) => chars < starts[i] + l.text.length);
  const active = firstUnfinished === -1 ? lines.length - 1 : firstUnfinished;

  return (
    <div ref={ref} className="space-y-3">
      {lines.map((l, i) => {
        const shown = Math.max(0, Math.min(l.text.length, chars - starts[i]));
        return (
          <p key={i} className={`${l.className ?? ""} min-h-[1.4em] ${started && i === active ? "caret" : ""}`} aria-label={l.text}>
            <span aria-hidden>{l.text.slice(0, shown)}</span>
          </p>
        );
      })}
    </div>
  );
}
