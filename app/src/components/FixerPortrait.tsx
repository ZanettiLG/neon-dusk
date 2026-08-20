/**
 * Deterministic placeholder portrait for Despachante Cupim ("O Porteiro"):
 * hexagon/terminal frame + "CU" glyph, gold accent (Babilônia). Same
 * placeholder system as CharacterAvatar — illustrated portraits are a later
 * phase (docs/definicoes-de-produto/04-sistemas-e-progressao.md §0.5).
 */

/** Pixel size per variant (square viewBox 64×64). */
const PORTRAIT_SIZES = { sm: 32, md: 48, lg: 64 } as const;

interface FixerPortraitProps {
  size?: keyof typeof PORTRAIT_SIZES;
}

/**
 * Pure portrait of Cupim. Fixed subject — no props beyond size; the aria-label
 * carries the identity for screen readers.
 */
export default function FixerPortrait({ size = "md" }: FixerPortraitProps) {
  const px = PORTRAIT_SIZES[size];

  return (
    <svg
      viewBox="0 0 64 64"
      width={px}
      height={px}
      role="img"
      aria-label="Cupim, o porteiro da Babilônia"
      className="shrink-0"
    >
      <polygon
        points="32,2 58,17 58,47 32,62 6,47 6,17"
        fill="none"
        strokeWidth="2"
        className="stroke-nd-gold/60"
      />
      {/* Terminal corner ticks. */}
      <path
        d="M14 20 V14 H20 M44 14 H50 V20 M50 44 V50 H44 M20 50 H14 V44"
        fill="none"
        strokeWidth="1.5"
        className="stroke-nd-gold/60"
      />
      <text
        x="32"
        y="32"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="'Fira Code', monospace"
        fontSize="15"
        letterSpacing="1"
        className="fill-nd-gold"
      >
        CU
      </text>
    </svg>
  );
}
