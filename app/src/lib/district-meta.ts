import type { Origin } from "@neon-dusk/shared";
import { ORIGINS } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";

// Deterministic client-side origin identity (04-sistemas-e-progressao.md §0.5):
// two-letter district glyphs and hexagon frame/text themes. Consumed by the
// character avatar, the metro map and the district banner — one source so the
// seven districts never drift between surfaces.

/**
 * Visual theme of one origin district: the two-letter glyph and the Tailwind
 * classes for the hexagon stroke (frame) and the glyph text.
 */
export interface DistrictTheme {
  /** Two-letter glyph derived from the district code. */
  glyph: string;
  /** Tailwind classes for the hexagon stroke (frame). */
  frame: string;
  /** Tailwind classes for the glyph text. */
  text: string;
}

// Tailwind JIT scans literal strings only — classes must be written verbatim.
// Desaturated accents use opacity modifiers (same pattern as the rest of the app).
export const DISTRICT_GLYPHS: Record<Origin, string> = {
  a_paraiso: "PA",
  o_fervo: "FE",
  o_fluxo: "FL",
  a_quebrada: "QB",
  babilonia: "BA",
  as_mortas: "AM",
  o_ponto: "PT",
};

export const DISTRICT_THEMES: Record<Origin, DistrictTheme> = {
  a_paraiso: { glyph: "PA", frame: "stroke-nd-cyan/60", text: "fill-nd-cyan" },
  o_fervo: { glyph: "FE", frame: "stroke-nd-magenta/60", text: "fill-nd-magenta" },
  o_fluxo: { glyph: "FL", frame: "stroke-nd-purple/60", text: "fill-nd-purple" },
  a_quebrada: { glyph: "QB", frame: "stroke-nd-gold/40", text: "fill-nd-gold/50" },
  babilonia: { glyph: "BA", frame: "stroke-nd-gold/60", text: "fill-nd-gold" },
  as_mortas: {
    glyph: "AM",
    frame: "stroke-nd-text-secondary/40",
    text: "fill-nd-text-secondary/70",
  },
  o_ponto: { glyph: "PT", frame: "stroke-nd-magenta/40", text: "fill-nd-magenta/50" },
};

/**
 * Normalize a district string from an API payload to an Origin key. Payloads
 * are inconsistent across systems: vendor seeds store the Origin key
 * ("o_fervo") while trampo templates store the display label ("O Fervo").
 * Returns null for unrecognized values (callers render nothing for those).
 */
export function originFromDistrictString(district: string): Origin | null {
  if ((ORIGINS as readonly string[]).includes(district)) return district as Origin;
  const byLabel = (Object.entries(ORIGIN_LABELS) as [Origin, string][]).find(
    ([, label]) => label === district,
  );
  return byLabel ? byLabel[0] : null;
}
