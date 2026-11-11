import CreateForm from "./_components/create-form";

export const metadata = { title: "Create your payment link · Allot" };

export default function CreatePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Create your payment link</h1>
        <p className="mt-1 text-white/60">Set it up once. Every payment is split automatically.</p>
      </div>
      <CreateForm />
    </div>
  );
}
