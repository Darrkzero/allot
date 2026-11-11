import { Suspense } from "react";
import StatusView from "./_components/status-view";

export const metadata = { title: "Payment status · Allot" };

export default function StatusPage(props: PageProps<"/pay/status/[id]">) {
  return (
    <Suspense fallback={<p className="text-white/50">Loading payment…</p>}>
      <StatusLoader params={props.params} />
    </Suspense>
  );
}

async function StatusLoader({ params }: Pick<PageProps<"/pay/status/[id]">, "params">) {
  const { id } = await params;
  return <StatusView id={id} />;
}
