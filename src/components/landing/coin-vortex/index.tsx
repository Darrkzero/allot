"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { Motion } from "./scene";

const REDUCED = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCED);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

// 3D scene is browser-only (WebGL) and loaded lazily so the page shell stays fast.
const Scene = dynamic(() => import("./scene"), {
  ssr: false,
  loading: () => <div className="h-full w-full" />,
});

export function CoinVortex({ className = "relative aspect-square w-full" }: { className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => false);

  // Pointer and scroll live in refs: the scene reads them every frame without React re-rendering.
  const pointer = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const motion = useMemo<Motion>(() => ({ pointer, scroll, reduced }), [reduced]);

  useEffect(() => {
    // Pause rendering while the hero is scrolled out of view.
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.02 });
    if (box.current) io.observe(box.current);

    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onScroll = () => {
      scroll.current = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * 0.9)));
    };
    onScroll();
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div ref={box} className={className} aria-label="Animated 3D coins of many tokens orbiting the Allot coin" role="img">
      <Scene active={visible && !reduced} motion={motion} />
    </div>
  );
}
