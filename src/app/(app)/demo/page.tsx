import Demo from "./_components/demo";

export const metadata = { title: "Try a payment · Allot" };

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <div>
        <span className="pill">Demo · no wallet, no money</span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Try a payment</h1>
        <p className="mt-1 text-white/60">Prices and fees are live from NEAR. The payment itself is simulated.</p>
      </div>
      <Demo />
    </div>
  );
}
