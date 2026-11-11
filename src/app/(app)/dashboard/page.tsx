import Link from "next/link";
import OpenDashboard from "./_components/open-dashboard";

export const metadata = { title: "Dashboard · Allot" };

export default function DashboardIndex() {
  return (
    <section className="card mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Open your dashboard</h1>
      <p className="text-white/60">Enter your link name to sign in.</p>
      <OpenDashboard />
      <p className="text-sm text-white/50">
        No link yet? <Link href="/create" className="underline">Create one</Link>.
      </p>
    </section>
  );
}
