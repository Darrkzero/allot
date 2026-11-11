import type { Metadata } from "next";
import Link from "next/link";
import { Geist_Mono, Manrope } from "next/font/google";
import { Logo } from "@/components/ui/logo";
import "./globals.css";

const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Allot: get paid in anything, split by your rules",
  description:
    "Payment links that accept any token on any chain and split every payment by your rules the moment it arrives. Built on NEAR Intents.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. Grammarly) add attributes to <html>/<body> before React
    // loads. It covers only these two tags' own attributes; mismatches anywhere else are still reported.
    <html lang="en" className={`${manrope.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <header className="sticky top-0 z-30 bg-[#06070a]/85 backdrop-blur-md">
          <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center px-5 py-4 md:grid-cols-[1fr_auto_1fr]">
            <Link href="/" aria-label="Allot home" className="justify-self-start">
              <Logo />
            </Link>
            <nav className="hidden items-center gap-8 text-sm text-white/65 md:flex">
              <Link href="/#how" className="transition hover:text-white">How it works</Link>
              <Link href="/#why" className="transition hover:text-white">Why Allot</Link>
              <Link href="/#security" className="transition hover:text-white">Security</Link>
              <Link href="/demo" className="transition hover:text-white">Demo</Link>
            </nav>
            <div className="flex items-center gap-2 justify-self-end">
              <Link href="/dashboard" className="btn-ghost px-4 py-1.5 text-[13px]">Dashboard</Link>
              <Link href="/create" className="btn px-4 py-1.5 text-[13px]">Create link</Link>
            </div>
          </div>
        </header>
        <main className="flex w-full flex-1 flex-col">{children}</main>
        <footer className="border-t border-white/[0.07]">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-white/45 sm:flex-row">
            <span className="flex items-center gap-3">
              <Logo />
              <span>Built on NEAR Intents · NEAR HACKATHON 2026</span>
            </span>
            <span>Experimental beta on mainnet: keep amounts small.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
