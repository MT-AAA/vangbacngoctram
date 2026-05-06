/**
 * The "NT" diamond emblem used in the sidebar header.
 * Pure SVG so it renders crisply at any size.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <defs>
        <linearGradient id="ntGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(44 90% 78%)" />
          <stop offset="50%" stopColor="hsl(38 80% 50%)" />
          <stop offset="100%" stopColor="hsl(34 80% 32%)" />
        </linearGradient>
        <linearGradient id="ntInner" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(156 50% 12%)" />
          <stop offset="100%" stopColor="hsl(160 70% 6%)" />
        </linearGradient>
      </defs>
      {/* Diamond outline */}
      <path
        d="M32 4 L60 32 L32 60 L4 32 Z"
        fill="url(#ntGold)"
        stroke="hsl(36 80% 32%)"
        strokeWidth="1.5"
      />
      {/* Inner facet */}
      <path
        d="M32 10 L54 32 L32 54 L10 32 Z"
        fill="url(#ntInner)"
      />
      {/* Subtle facet lines */}
      <path
        d="M32 10 L32 54 M10 32 L54 32"
        stroke="hsla(44 80% 70% / 0.35)"
        strokeWidth="0.6"
      />
      {/* "NT" monogram */}
      <text
        x="32"
        y="38"
        textAnchor="middle"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontWeight="700"
        fontSize="20"
        fill="url(#ntGold)"
        letterSpacing="0.5"
      >
        NT
      </text>
    </svg>
  );
}
