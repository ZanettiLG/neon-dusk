import type { Origin } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";

// Deterministic client-side origin avatar (04-sistemas-e-progressao.md §0.5):
// hexagon/terminal frame + 2-letter district glyph. Illustrated portraits are
// a later phase — this is the placeholder system shipped with creation.

interface AvatarTheme {
  /** Two-letter glyph derived from the district code. */
  glyph: string;
  /** Tailwind classes for the hexagon stroke (frame). */
  frame: string;
  /** Tailwind classes for the glyph text. */
  text: string;
}

// Tailwind JIT scans literal strings only — classes must be written verbatim.
// Desaturated accents use opacity modifiers (same pattern as the rest of the app).
const AVATAR_THEMES: Record<Origin, AvatarTheme> = {
  a_paraiso: { glyph: "PA", frame: "stroke-nd-cyan/60", text: "fill-nd-cyan" },
  o_fervo: { glyph: "FE", frame: "stroke-nd-magenta/60", text: "fill-nd-magenta" },
  o_fluxo: { glyph: "FL", frame: "stroke-nd-purple/60", text: "fill-nd-purple" },
  a_quebrada: { glyph: "QB", frame: "stroke-nd-gold/40", text: "fill-nd-gold/50" },
  babilonia: { glyph: "BA", frame: "stroke-nd-gold/60", text: "fill-nd-gold" },
  as_mortas: { glyph: "AM", frame: "stroke-nd-text-secondary/40", text: "fill-nd-text-secondary/70" },
  o_ponto: { glyph: "PT", frame: "stroke-nd-magenta/40", text: "fill-nd-magenta/50" },
};

/** Pixel size per variant (square viewBox 64×64). */
const AVATAR_SIZES = { sm: 32, md: 48, lg: 64 } as const;

interface CharacterAvatarProps {
  origin: Origin | null;
  size?: keyof typeof AVATAR_SIZES;
}

/**
 * Pure avatar for a character's origin district. `null` renders a dashed
 * placeholder (no district selected yet).
 */
export default function CharacterAvatar({ origin, size = "md" }: CharacterAvatarProps) {
  const px = AVATAR_SIZES[size];
  const theme = origin ? AVATAR_THEMES[origin] : null;
  const label = origin ? `Avatar de ${ORIGIN_LABELS[origin]}` : "Sem origem definida";

  return (
    <svg
      viewBox="0 0 64 64"
      width={px}
      height={px}
      role="img"
      aria-label={label}
      className="shrink-0"
    >
      {theme ? (
        <>
          <polygon
            points="32,2 58,17 58,47 32,62 6,47 6,17"
            fill="none"
            strokeWidth="2"
            className={theme.frame}
          />
          {/* Terminal corner ticks. */}
          <path
            d="M14 20 V14 H20 M44 14 H50 V20 M50 44 V50 H44 M20 50 H14 V44"
            fill="none"
            strokeWidth="1.5"
            className={theme.frame}
          />
          <text
            x="32"
            y="32"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Fira Code', monospace"
            fontSize="15"
            letterSpacing="1"
            className={theme.text}
          >
            {theme.glyph}
          </text>
        </>
      ) : (
        <>
          <polygon
            points="32,2 58,17 58,47 32,62 6,47 6,17"
            fill="none"
            strokeWidth="2"
            strokeDasharray="5 4"
            className="stroke-nd-text-secondary/40"
          />
          <text
            x="32"
            y="32"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Fira Code', monospace"
            fontSize="15"
            className="fill-nd-text-secondary/40"
          >
            ?
          </text>
        </>
      )}
    </svg>
  );
}
