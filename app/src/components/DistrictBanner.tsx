import type { Origin } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";
import { DISTRICT_GLYPHS, DISTRICT_THEMES } from "@/lib/district-meta";

interface DistrictBannerProps {
  /**
   * District to render. Defaults to Babilônia — the hub — keeping callers
   * that render the canonical banner (e.g. GigBoardView) untouched.
   */
  district?: Origin;
}

/**
 * Diegetic district banner — "tudo tem preço. Inclusive você"
 * (docs/definicoes-de-produto/02-mundo-e-universo.md). Static band with a
 * minimalist feira-stall glyph for Babilônia (the pastel is real; the cana is
 * vat 65); other districts render their two-letter glyph + name. No imagery —
 * glyph + terminal type only.
 */
export default function DistrictBanner({ district = "babilonia" }: DistrictBannerProps) {
  const theme = DISTRICT_THEMES[district];
  const isBabilonia = district === "babilonia";

  return (
    <div className="flex items-center gap-3 border-y border-nd-gold/20 bg-gradient-to-r from-nd-bg via-nd-surface to-nd-bg px-4 py-3">
      {isBabilonia ? (
        <svg
          viewBox="0 0 32 32"
          width="26"
          height="26"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="shrink-0 text-nd-gold/60"
        >
          {/* Feira stall: scalloped awning, counter, two pasteis. */}
          <path d="M4 9 H28" />
          <path d="M4 9 Q7 14 10 9 Q13 14 16 9 Q19 14 22 9 Q25 14 28 9" />
          <path d="M8 14 V25 M24 14 V25" />
          <path d="M6 25 H26" />
          <circle cx="12" cy="20" r="2" />
          <circle cx="20" cy="20" r="2" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 32 32"
          width="26"
          height="26"
          aria-hidden="true"
          fill="none"
          className="shrink-0"
        >
          {/* Hexagon frame + two-letter district glyph. */}
          <polygon
            points="16,2 28,9 28,23 16,30 4,23 4,9"
            strokeWidth="1.5"
            className={theme.frame}
          />
          <text
            x="16"
            y="16"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="'Fira Code', monospace"
            fontSize="9"
            letterSpacing="0.5"
            className={theme.text}
          >
            {theme.glyph}
          </text>
        </svg>
      )}
      <p className="font-heading text-xs sm:text-sm tracking-widest text-nd-gold">
        {ORIGIN_LABELS[district].toUpperCase()}{" "}
        <span className="text-nd-text-secondary">
          {isBabilonia ? "// MERCADO DO SUBMUNDO" : `// ${DISTRICT_GLYPHS[district]}`}
        </span>
      </p>
    </div>
  );
}
