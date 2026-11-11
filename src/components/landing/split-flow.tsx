"use client";

import { useEffect, useState } from "react";

// Hero visual: one payment (any token, any chain) flows in and splits into three pots.
const PAYERS = [
  { token: "ETH", chain: "Arbitrum", color: "#4cc2ff" },
  { token: "USDT", chain: "Tron", color: "#3bf0b0" },
  { token: "SOL", chain: "Solana", color: "#8b7cff" },
  { token: "USDC", chain: "Base", color: "#4cc2ff" },
  { token: "BTC", chain: "Bitcoin", color: "#ffb547" },
];

const POTS = [
  { x: 100, amount: "$700", label: "Spending", asset: "USDC · Base", color: "#3bf0b0", path: "M280 206 C280 252 100 248 100 300" },
  { x: 280, amount: "$200", label: "Tax reserve", asset: "USDT · Tron", color: "#ffb547", path: "M280 206 L280 300" },
  { x: 460, amount: "$100", label: "Savings", asset: "BTC · Bitcoin", color: "#4cc2ff", path: "M280 206 C280 252 460 248 460 300" },
];

export function SplitFlow() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % PAYERS.length), 2600);
    return () => clearInterval(t);
  }, []);
  const payer = PAYERS[i];

  return (
    <svg
      viewBox="0 0 560 440"
      className="h-auto w-full"
      role="img"
      aria-label="A $1,000 payment in any token is split by Allot into $700 spending in USDC on Base, $200 tax reserve in USDT on Tron and $100 savings in BTC"
    >
      <defs>
        <filter id="sf-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <linearGradient id="sf-card" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.09" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0.025" />
        </linearGradient>
        <radialGradient id="sf-node" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#3bf0b0" stopOpacity="0.45" />
          <stop offset="1" stopColor="#3bf0b0" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Incoming payment card */}
      <rect x="150" y="18" width="260" height="96" rx="18" fill="url(#sf-card)" stroke="#ffffff" strokeOpacity="0.12" />
      <text x="174" y="46" fill="#ffffff" fillOpacity="0.45" fontSize="10" letterSpacing="1.6" fontWeight="600">INCOMING PAYMENT</text>
      <text x="174" y="80" fill="#ffffff" fontSize="28" fontWeight="700" letterSpacing="-0.5">$1,000.00</text>
      <g key={i} className="animate-fade-up">
        <circle cx="179" cy="97" r="4" fill={payer.color} />
        <text x="189" y="101" fill="#ffffff" fillOpacity="0.65" fontSize="11.5">
          paid with <tspan fill="#ffffff" fontWeight="600">{payer.token}</tspan> on {payer.chain}
        </text>
      </g>

      {/* Into the router */}
      <line x1="280" y1="114" x2="280" y2="160" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" />
      <line x1="280" y1="114" x2="280" y2="160" stroke="#3bf0b0" strokeWidth="2" strokeDasharray="4 12" className="animate-flow" />

      {/* Router node */}
      <circle cx="280" cy="183" r="44" fill="url(#sf-node)" className="animate-glow" />
      <circle cx="280" cy="183" r="23" fill="#0b0d12" stroke="#3bf0b0" strokeOpacity="0.7" strokeWidth="1.5" />
      <path d="M280 173V179M280 179C280 182 274 182.5 274 188M280 179V188M280 179C280 182 286 182.5 286 188" stroke="#3bf0b0" strokeWidth="2" strokeLinecap="round" fill="none" />
      <text x="316" y="179" fill="#ffffff" fillOpacity="0.8" fontSize="11" fontWeight="600">split by your rules</text>
      <text x="316" y="194" fill="#ffffff" fillOpacity="0.45" fontSize="10">locked to your addresses</text>

      {/* Streams to pots */}
      {POTS.map((p, n) => (
        <g key={p.label}>
          <path d={p.path} fill="none" stroke="#ffffff" strokeOpacity="0.1" strokeWidth="2" />
          <path d={p.path} fill="none" stroke={p.color} strokeWidth="2" strokeDasharray="4 12" className="animate-flow" />
          {/* Moving dot with a soft halo (no SVG filter: filters on moving shapes re-render every frame) */}
          <g>
            <circle r="9" fill={p.color} fillOpacity="0.18" />
            <circle r="3.5" fill={p.color} />
            <animateMotion dur="2.2s" repeatCount="indefinite" begin={`${n * 0.35}s`} path={p.path} />
          </g>
        </g>
      ))}

      {/* Pots */}
      {POTS.map((p) => (
        <g key={`pot-${p.label}`}>
          <rect x={p.x - 82} y="300" width="164" height="118" rx="18" fill="url(#sf-card)" stroke={p.color} strokeOpacity="0.35" />
          <rect x={p.x - 30} y="300" width="60" height="3" rx="1.5" fill={p.color} />
          <text x={p.x} y="345" textAnchor="middle" fill="#ffffff" fontSize="26" fontWeight="700" letterSpacing="-0.5">{p.amount}</text>
          <text x={p.x} y="370" textAnchor="middle" fill="#ffffff" fillOpacity="0.9" fontSize="13" fontWeight="600">{p.label}</text>
          <text x={p.x} y="392" textAnchor="middle" fill={p.color} fillOpacity="0.9" fontSize="11">{p.asset}</text>
        </g>
      ))}
    </svg>
  );
}
