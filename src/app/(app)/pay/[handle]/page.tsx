import { Suspense } from "react";
import { notFound } from "next/navigation";
import { publicRule } from "@/lib/rules";
import { getRouter } from "@/lib/server/db";
import PayForm from "./_components/pay-form";

export default function PayPage(props: PageProps<"/pay/[handle]">) {
  return (
    <Suspense fallback={<p className="text-white/50">Loading payment link…</p>}>
      <PayLoader params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function PayLoader({ params, searchParams }: Pick<PageProps<"/pay/[handle]">, "params" | "searchParams">) {
  const { handle } = await params;
  const sp = await searchParams;
  const router = getRouter(handle);
  if (!router || router.status !== "active") notFound();
  const amount = Number(Array.isArray(sp.amount) ? sp.amount[0] : sp.amount);
  const memo = Array.isArray(sp.memo) ? sp.memo[0] : sp.memo;
  return (
    <PayForm
      handle={router.handle}
      name={router.name}
      rules={router.rules.map(publicRule)}
      initialAmount={Number.isFinite(amount) && amount > 0 ? amount : undefined}
      initialMemo={memo?.slice(0, 140)}
    />
  );
}
