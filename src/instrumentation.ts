// Runs once when a Next.js server starts. Allot uses it to start the background sweeper that keeps
// payments and splits moving without anyone watching a page. Production Node.js server only: not in
// dev (set ALLOT_SWEEPER=on to try it), not during `next build`, not on the Edge runtime.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const enabled = process.env.ALLOT_SWEEPER ? process.env.ALLOT_SWEEPER === "on" : process.env.NODE_ENV === "production";
  if (!enabled) return;
  const { startSweeper } = await import("./lib/server/payments/sweeper");
  startSweeper();
}
