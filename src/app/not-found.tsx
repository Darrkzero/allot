import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Page not found · Allot" };

// Shown for any URL that doesn't exist. Replaces Next's default 404, which follows the OS colour
// scheme and rendered as a white page under the dark header.
export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-5 py-24 text-center">
      <p className="label">404</p>
      <h1 className="text-3xl font-bold tracking-tight">This page doesn&apos;t exist</h1>
      <p className="text-white/55">Check the address, or start from the home page.</p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href="/" className="btn">Go to the home page</Link>
        <Link href="/demo" className="btn-ghost">Try the demo</Link>
      </div>
    </div>
  );
}
