import type { Rule } from "@/lib/rules";

/** One colour per pot, in order; shared by the bar, the pot cards and the preview. */
export const POT_COLORS = ["bg-mint", "bg-amber", "bg-sky", "bg-violet", "bg-pink"];

/** Shows whether the pots add up to 100%, and what's left to fix. */
export function TotalBadge({ total }: { total: number }) {
  const [text, tone] =
    total === 100
      ? ["100% assigned ✓", "bg-mint/15 text-mint"]
      : total < 100
        ? [`${100 - total}% left to assign`, "bg-amber/15 text-amber"]
        : [`${total - 100}% too much`, "bg-red-500/15 text-red-300"];
  return (
    <span aria-live="polite" className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      {text}
    </span>
  );
}

/** The pots as one coloured bar, each segment sized by its share. */
export function SplitBar({ rules }: { rules: Rule[] }) {
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
      {rules.map((r, i) => (
        <div key={i} className={POT_COLORS[i % POT_COLORS.length]} style={{ width: `${Math.max(0, Math.min(100, r.percent || 0))}%` }} />
      ))}
    </div>
  );
}
