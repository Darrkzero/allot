// Allot mark: one stream that splits into three.
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="allot-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3bf0b0" />
          <stop offset="0.55" stopColor="#4cc2ff" />
          <stop offset="1" stopColor="#8b7cff" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="url(#allot-g)" fillOpacity="0.14" stroke="url(#allot-g)" strokeOpacity="0.55" />
      <path d="M16 5.5V13M16 13C16 17 9 17.5 9 23M16 13V23M16 13C16 17 23 17.5 23 23" stroke="url(#allot-g)" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="9" cy="25.2" r="2" fill="#3bf0b0" />
      <circle cx="16" cy="25.2" r="2" fill="#4cc2ff" />
      <circle cx="23" cy="25.2" r="2" fill="#8b7cff" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-white">allot</span>
    </span>
  );
}
