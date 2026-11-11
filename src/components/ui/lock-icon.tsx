/** Padlock used to mark private (Confidential Intents) slices. Decorative: pair it with text. */
export function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={`shrink-0 ${className}`}>
      <path d="M5.25 7V5.25a2.75 2.75 0 0 1 5.5 0V7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="3" y="7" width="10" height="7.25" rx="2" fill="currentColor" />
    </svg>
  );
}
