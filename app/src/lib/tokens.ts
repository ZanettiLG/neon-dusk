/**
 * Canonical design tokens for Neon Dusk (issue #133).
 *
 * Single source of truth consumed by:
 * - app/tailwind.config.js (theme values, imported via jiti)
 * - views/components (RESOURCE_BAR_BANDS + bandFor)
 *
 * Full spec: docs/design/05-design-tokens.md
 */

// ponytail: legacy names such as nd-cyan, nd-magenta, nd-purple and nd-green
// are now functional channels, not literal color descriptions. A future refactor
// may rename them to semantic tokens (nd-action, nd-danger, nd-hack, nd-success).
/** Color primitives (kebab-case, `nd-` prefix = Neon Dusk). */
const colors = {
  "nd-bg": "#0a0a0a",
  "nd-surface": "#161616",
  "nd-cyan": "#f2f2f2",
  "nd-magenta": "#ff2020",
  "nd-gold": "#d4a017",
  "nd-purple": "#8aa4b8",
  "nd-text": "#e8e8e8",
  "nd-text-secondary": "#9a9a9a",
  "nd-green": "#c8c8c8",
  "nd-dead-gray": "#3a3a3a",
} as const;

/** Corner radii. */
const borderRadius = {
  terminal: "2px",
} as const;

/** Hairline + drop shadows (no neon glow). */
const boxShadow = {
  "neon-cyan": "0 0 0 1px rgba(255, 255, 255, 0.06), 0 2px 8px rgba(0, 0, 0, 0.5)",
  "neon-magenta": "0 0 0 1px rgba(255, 32, 32, 0.25)",
  "neon-gold": "0 0 0 1px rgba(212, 160, 23, 0.25)",
  "neon-purple": "0 0 0 1px rgba(138, 164, 184, 0.25)",
  "neon-green": "0 0 0 1px rgba(200, 200, 200, 0.25)",
} as const;

/** Responsive breakpoints (mobile-first). */
const screens = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
} as const;

/** Motion durations. */
const transitionDuration = {
  "nd-fast": "150ms",
  "nd-base": "250ms",
  "nd-slow": "500ms",
  "nd-slower": "2000ms",
} as const;

/** Semantic type scale in Tailwind array form: [font-size, { lineHeight }]. */
const fontSize = {
  "nd-micro": ["10px", { lineHeight: "1.2" }],
  "nd-label": ["11px", { lineHeight: "1.4" }],
  "nd-body-xs": ["12px", { lineHeight: "1.5" }],
  "nd-body": ["14px", { lineHeight: "1.5" }],
  "nd-body-lg": ["16px", { lineHeight: "1.6" }],
  "nd-title-xs": ["18px", { lineHeight: "1.3" }],
  "nd-title": ["24px", { lineHeight: "1.25" }],
  "nd-title-lg": ["30px", { lineHeight: "1.2" }],
} as const;

/** All design tokens, grouped by Tailwind theme key. */
export const tokens = {
  colors,
  borderRadius,
  boxShadow,
  screens,
  transitionDuration,
  fontSize,
} as const;

/**
 * One contiguous segment of a resource bar.
 * Bands are inclusive on both bounds (percent >= min && percent <= max).
 */
export interface Band {
  min: number;
  max: number;
  /** Tailwind background class (literal string so the JIT scanner picks it up). */
  color: string;
  /** Portuguese UI label for the band state (color is never the only channel). */
  label: string;
  /** Optional pulse flag — consumer animates the bar while inside this band. */
  pulse?: boolean;
}

const nilBands: Band[] = [
  { min: 0, max: 33, color: "bg-nd-magenta", label: "crítico" },
  { min: 34, max: 66, color: "bg-nd-gold", label: "atenção" },
  { min: 67, max: 100, color: "bg-nd-cyan", label: "estável" },
];

/**
 * Humanity bands (docs/definicoes-de-produto/04-sistemas-e-progressao.md §4,
 * thresholds of Cyberpsychosis), descending by value. The 20–1 Cyberpsycho
 * band carries `pulse: true`; 0 is FLATLINE (dead gray, textual state).
 */
const humanityBands: Band[] = [
  { min: 71, max: 100, color: "bg-nd-green", label: "Íntegro" },
  { min: 41, max: 70, color: "bg-nd-gold", label: "Instável" },
  { min: 21, max: 40, color: "bg-nd-magenta", label: "Borderline" },
  { min: 1, max: 20, color: "bg-nd-magenta", pulse: true, label: "Cyberpsycho" },
  { min: 0, max: 0, color: "bg-nd-dead-gray", label: "FLATLINE" },
];

const hpBands: Band[] = [
  { min: 0, max: 33, color: "bg-nd-magenta", label: "crítico" },
  { min: 34, max: 66, color: "bg-nd-gold", label: "ferido" },
  { min: 67, max: 100, color: "bg-nd-green", label: "estável" },
];

const gigDifficultyBands: Band[] = [
  { min: 0, max: 39, color: "bg-nd-green", label: "fácil" },
  { min: 40, max: 59, color: "bg-nd-gold", label: "médio" },
  { min: 60, max: 100, color: "bg-nd-magenta", label: "difícil" },
];

/**
 * Street Cred: "lenda" (gold) is exclusive to score 100 — matches the
 * Legend logic in StreetCredDisplay (nextThreshold === null only at 100).
 */
const streetCredBands: Band[] = [
  { min: 0, max: 99, color: "bg-nd-cyan", label: "na rua" },
  { min: 100, max: 100, color: "bg-nd-gold", label: "lenda" },
];

/**
 * Color bands per resource bar (docs/design/05-design-tokens.md §Thresholds).
 * Invariant: each array covers every integer 0–100 with exactly one band, in
 * monotonic order (ascending for nil/hp/gigDifficulty/streetCred; descending
 * for humanity), so `bandFor` always resolves after clamping/rounding.
 */
export const RESOURCE_BAR_BANDS = {
  nil: nilBands,
  humanity: humanityBands,
  hp: hpBands,
  gigDifficulty: gigDifficultyBands,
  streetCred: streetCredBands,
};

/** Keys of {@link RESOURCE_BAR_BANDS}. */
export type ResourceBarKey = keyof typeof RESOURCE_BAR_BANDS;

/**
 * Returns the band that contains `percent` for the given resource.
 *
 * Expected input: an integer percent 0–100. Fractions are rounded to the
 * nearest integer before lookup; values outside 0–100 are clamped first
 * (150 → 100, -5 → 0). NaN (or any non-finite value) is a caller bug — it
 * deterministically resolves to the FIRST band of the array, which is the
 * most critical state for the ascending arrays (nil, hp, gigDifficulty,
 * streetCred). `humanity` is ordered descending, so its first band is
 * "Íntegro" (100–71) — see docs/design/05-design-tokens.md §15.
 *
 * Bands are checked in order; bounds are inclusive (≥ min, ≤ max).
 */
export function bandFor(resource: ResourceBarKey, percent: number): Band {
  const bands = RESOURCE_BAR_BANDS[resource];
  if (!Number.isFinite(percent)) return bands[0];
  const p = Math.round(percent);
  const clamped = Math.min(100, Math.max(0, p));
  const band = bands.find((b) => clamped >= b.min && clamped <= b.max);
  return band ?? bands[bands.length - 1];
}
