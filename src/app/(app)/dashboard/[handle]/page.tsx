import { Suspense } from "react";
import Dashboard from "./_components/dashboard";

export const metadata = { title: "Dashboard · Allot" };

export default function DashboardPage(props: PageProps<"/dashboard/[handle]">) {
  return (
    <Suspense fallback={<p className="text-white/50">Loading…</p>}>
      <Loader params={props.params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/dashboard/[handle]">, "params">) {
  const { handle } = await params;
  return <Dashboard handle={handle} />;
}
