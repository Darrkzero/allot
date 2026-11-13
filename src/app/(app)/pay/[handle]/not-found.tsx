import Link from "next/link";

// A payment link that doesn't exist, or whose owner hasn't finished setting it up.
export default function PayLinkNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <p className="label">Payment link not found</p>
      <h1 className="text-3xl font-bold tracking-tight">This link can&apos;t take payments</h1>
      <p className="text-white/55">
        It doesn&apos;t exist, or its owner hasn&apos;t finished setting it up. Check the link with the person you&apos;re paying.
        Nothing has been charged.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Link href="/" className="btn-ghost">What is Allot?</Link>
        <Link href="/create" className="btn">Create your own link</Link>
      </div>
    </div>
  );
}
