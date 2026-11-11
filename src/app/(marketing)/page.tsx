import Link from "next/link";
import type { CSSProperties } from "react";
import { CoinVortex } from "@/components/landing/coin-vortex";
import { AfterCoins, CountUp, Reveal, TypedLines } from "@/components/landing/motion";
import { SplitFlow } from "@/components/landing/split-flow";
import { logoDataUri, type LogoToken } from "@/lib/logos/tokens";

const PAY_WITH: LogoToken[] = ["USDC", "USDT", "ETH", "BTC", "SOL", "BNB", "TRX", "TON", "ZEC", "NEAR"];

// Animation delay helper for the intro choreography (CSS reads --d).
const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;

// Deterministic "stars" for the hero backdrop (same on server and client).
const STARS = Array.from({ length: 40 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  return { left: r(1) * 100, top: r(2) * 100, size: r(3) > 0.8 ? 2 : 1, delay: r(4) * 4 };
});

const STEPS = [
  {
    n: "01",
    title: "Set your rules",
    body: "Choose your pots, like spending, taxes and savings, and the currency each one is paid out in. Approve with your fingerprint or Face ID. No seed phrase.",
  },
  {
    n: "02",
    title: "Share one link",
    body: "Send your /pay/you link or an invoice link with the amount filled in. Your client pays with any of 200+ tokens on 39 chains, at a live, exact price.",
  },
  {
    n: "03",
    title: "Every payment splits itself",
    body: "The moment money lands, each pot's share is converted and sent to its own wallet. You see where every dollar went, plus a spreadsheet for your accountant.",
  },
];

const FIXES = [
  ["Payer and payee on different chains", "Pay from any chain; you receive on yours"],
  ["Bridges, swaps and gas tokens", "One transfer. NEAR Intents handles the rest"],
  ["Wrong-network sends lose money", "The link fixes token, chain and address"],
  ["Exchanges as middlemen", "Straight to your own wallets"],
  ["Nobody sets money aside", "Taxes and savings come off the top automatically"],
];

export default function Home() {
  return (
    <div className="space-y-28 pb-16">
      {/* ── Hero: full-bleed, fills the first screen; copy rises in, coins spiral into orbit ── */}
      <section className="relative flex min-h-[calc(100svh-72px)] flex-col overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(70%_55%_at_50%_100%,rgb(59_240_176/0.12),transparent_70%),radial-gradient(50%_45%_at_12%_0%,rgb(139_124_255/0.16),transparent_70%),radial-gradient(40%_40%_at_90%_10%,rgb(76_194_255/0.08),transparent_70%),linear-gradient(#0a0b10,#06070a)]">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {STARS.map((s, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white animate-twinkle"
              style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
            />
          ))}
        </div>

        <div className="relative z-10 mx-auto max-w-3xl space-y-6 px-6 pt-14 text-center sm:pt-20">
          <h1 className="text-[2.75rem] font-medium leading-[1.04] tracking-[-0.045em] text-white sm:text-6xl lg:text-[4.5rem]">
            <span className="mask-line"><span style={d(120)}>Get paid in anything.</span></span>
            <span className="mask-line text-white/55"><span style={d(280)}>Sorted by your rules.</span></span>
          </h1>
          <p className="intro mx-auto max-w-lg text-[15px] leading-relaxed text-white/50" style={d(520)}>
            One link. Your client pays with whatever they hold, and every payment is split the moment it lands: taxes, savings, spending, each to its own
            chain and token.
          </p>
          <div className="intro flex flex-wrap justify-center gap-3" style={d(680)}>
            <Link href="/create" className="btn px-6 py-3">Create your payment link</Link>
            <Link href="/demo" className="btn-ghost px-6 py-3">Try the demo</Link>
          </div>
        </div>

        <div className="relative mt-4 min-h-[340px] flex-1 sm:min-h-[420px]">
          <CoinVortex className="absolute inset-0" />
          {/* Floating glass cards: drift in the moment the coins lock into orbit, then keep floating */}
          <AfterCoins className="pointer-events-none absolute inset-0 mx-auto max-w-6xl">
            <div className="after-coins absolute left-[4%] top-[34%] hidden w-56 sm:block lg:left-[8%]" style={d(0)}>
              <div className="glass animate-float">
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span>Incoming payment</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] text-black">↗</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  <CountUp to={1000} decimals={2} prefix="$" delay={150} />
                </p>
                <p className="mt-0.5 text-xs text-white/50">paid with ETH on Arbitrum</p>
              </div>
            </div>
            <div className="after-coins absolute right-[4%] top-[18%] hidden w-56 sm:block lg:right-[8%]" style={d(160)}>
              <div className="glass animate-float" style={{ animationDelay: "-3s" }}>
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span>Auto-split</span>
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-[11px] text-black">↗</span>
                </div>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-white">70 · 20 · 10</p>
                <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/10">
                  <span className="bg-mint" style={{ width: "70%" }} />
                  <span className="bg-amber" style={{ width: "20%" }} />
                  <span className="bg-sky" style={{ width: "10%" }} />
                </div>
              </div>
            </div>
            <div className="after-coins absolute bottom-[10%] right-[14%] hidden w-48 lg:block" style={d(320)}>
              <div className="glass animate-float" style={{ animationDelay: "-1.5s" }}>
                <p className="text-[11px] text-white/50">Quoted arrival time</p>
                <p className="mt-1 text-xl font-semibold tracking-tight text-white">~34 s</p>
                <p className="text-[11px] text-white/40">100 USDC Base → Arbitrum*</p>
              </div>
            </div>
          </AfterCoins>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#06070a] to-transparent" />
        </div>
      </section>

      {/* ── Pay with: endless marquee of real token logos ── */}
      <section className="space-y-5 text-center">
        <Reveal>
          <p className="label">Your clients can pay with 200+ tokens on 39 chains</p>
        </Reveal>
        <div className="marquee">
          <div className="marquee-track">
            {[...PAY_WITH, ...PAY_WITH, ...PAY_WITH, ...PAY_WITH].map((t, i) => (
              <span key={`${t}-${i}`} className="pill mr-3 gap-2.5 py-1.5 pl-1.5 pr-4 text-sm text-white/85" aria-hidden={i >= PAY_WITH.length}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoDataUri(t)} alt="" width={22} height={22} className="h-[22px] w-[22px]" />
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-6xl space-y-28 px-5">
        {/* ── How it works ── */}
        <section id="how" className="scroll-mt-24 space-y-10">
          <Reveal className="max-w-2xl space-y-3">
            <p className="label text-mint/80">How it works</p>
            <h2 className="text-4xl font-medium tracking-[-0.04em] text-white">Set it once. Every payment sorts itself.</h2>
          </Reveal>
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
            <Reveal delay={80} className="card p-4 sm:p-6">
              <SplitFlow />
            </Reveal>
            <Reveal delay={220} className="space-y-4">
              <p className="text-lg text-white/70">
                A client pays you $1,000 in whatever they hold. Allot converts it through NEAR Intents and sends each slice to its own address, on its own
                chain, in its own token.
              </p>
              <p className="text-white/50">Your pots are locked into your wallet, so every payment is split the same way, automatically.</p>
            </Reveal>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 120} className="card group space-y-3 transition hover:border-white/20">
                <span className="font-mono text-sm text-mint">{s.n}</span>
                <h3 className="text-xl font-semibold text-white">{s.title}</h3>
                <p className="text-sm leading-relaxed text-white/55">{s.body}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Problems it fixes ── */}
        <section id="why" className="grid scroll-mt-24 gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="space-y-3">
            <p className="label text-sky/80">Why it matters</p>
            <h2 className="text-4xl font-medium tracking-[-0.04em] text-white">Crypto payments are scattered across 39 chains. Your income shouldn&apos;t be.</h2>
            <p className="text-white/55">
              USDT lives on 13 chains, USDC on 17. Payer and payee rarely match. Allot uses NEAR Intents so nobody has to bridge, swap or hunt for gas.
            </p>
          </Reveal>
          <div className="card divide-y divide-white/[0.07] p-0">
            {FIXES.map(([problem, fix], i) => (
              <Reveal key={problem} delay={i * 90} className="grid grid-cols-2 gap-4 px-6 py-4 text-sm">
                <span className="text-white/45 line-through decoration-white/20">{problem}</span>
                <span className="flex items-start gap-2 text-white/90">
                  <span className="mt-0.5 text-mint">✓</span>
                  {fix}
                </span>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Security ── */}
        <section id="security" className="scroll-mt-24">
          <Reveal className="card relative overflow-hidden p-8 sm:p-12">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-2">
              <div className="space-y-4">
                <p className="label text-violet">Security</p>
                <h2 className="text-4xl font-medium tracking-[-0.04em] text-white">Even if Allot were hacked, your money couldn&apos;t move.</h2>
                <p className="text-white/60">
                  Payments land in a wallet only you control, with your passkey. You sign a policy that allows sending <em>only</em> to the addresses in your
                  rules. Allot&apos;s servers can run your split, but nothing else.
                </p>
                <ul className="space-y-2 text-sm text-white/70">
                  {["You own it with your fingerprint or Face ID. No seed phrase.", "Money can only go to your own addresses. NEAR enforces that, not us.", "A retry can never pay out twice."].map((x) => (
                    <li key={x} className="flex gap-2">
                      <span className="text-mint">✓</span>
                      {x}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="self-center rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-[13px]">
                <TypedLines
                  lines={[
                    { text: "// tested on mainnet, 8 Nov 2026", className: "text-white/40" },
                    { text: "allot-server → withdraw 1 USDC to your-wallet", className: "text-sky" },
                    { text: "✓ allowed by your policy", className: "text-mint" },
                    { text: "allot-server → withdraw 1 USDC to unknown-address", className: "text-sky" },
                    { text: "✗ 403 policy_destination_denied", className: "text-pink" },
                  ]}
                />
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── CTA ── */}
        <Reveal as="div" className="space-y-6 text-center">
          <h2 className="text-4xl font-medium tracking-[-0.04em] text-white sm:text-5xl">
            Your next payment could <span className="gradient-text">sort itself.</span>
          </h2>
          <div className="flex justify-center gap-3">
            <Link href="/create" className="btn px-6 py-3 text-[15px]">Create your payment link →</Link>
          </div>
          <p className="text-xs text-white/35">*From a live NEAR Intents quote on 8 Nov 2026: 100 USDC on Base → 99.98 USDC on Arbitrum, estimated ~34 s.</p>
        </Reveal>
      </div>
    </div>
  );
}
