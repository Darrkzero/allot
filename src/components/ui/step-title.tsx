/** A numbered section heading with an optional one-line explanation (used in multi-step forms). */
export function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-bold text-white/80">{n}</span>
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="mt-0.5 max-w-xl text-sm text-white/55">{hint}</p>}
      </div>
    </div>
  );
}
