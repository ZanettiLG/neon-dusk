/**
 * Canonical design tokens for Neon Dusk (issue #133, epic #14 — issue #53).
 *
 * Single source of truth consumed by:
 * - app/tailwind.config.js (theme values, imported via jiti)
 * - app/scripts/generate-tokens-css.mjs (via app/src/lib/tokens-css.ts)
 * - views/components (RESOURCE_BAR_BANDS + bandFor)
 *
 * Full spec: docs/design/05-design-tokens.md
 */

// ponytail: legacy names such as nd-cyan, nd-magenta, nd-purple and nd-green
// are now functional channels, not literal color descriptions. A future refactor
// may rename them to semantic tokens (nd-action, nd-danger, nd-hack, nd-success).
/** Raw color primitives — private layer, no semantics (docs/design §1). */
const raw = {
  bg: "#0a0a0a",
  surface: "#161616",
  white: "#f2f2f2",
  blood: "#ff2020",
  amber: "#d4a017",
  steel: "#8aa4b8",
  text: "#e8e8e8",
  textMuted: "#9a9a9a",
  lightGray: "#c8c8c8",
  deadGray: "#3a3a3a",
} as const;

/**
 * Semantic color channels (kebab-case, `nd-` prefix = Neon Dusk). Each channel
 * references a raw primitive — change the primitive once, the whole palette
 * follows (issue #53).
 */
const colors = {
  "nd-bg": raw.bg,
  "nd-surface": raw.surface,
  "nd-cyan": raw.white,
  "nd-magenta": raw.blood,
  "nd-gold": raw.amber,
  "nd-purple": raw.steel,
  "nd-text": raw.text,
  "nd-text-secondary": raw.textMuted,
  "nd-green": raw.lightGray,
  "nd-dead-gray": raw.deadGray,
} as const;

/** Type families (docs/design §3). */
const fontFamily = {
  heading: ['"JetBrains Mono"', "monospace"],
  body: ["Inter", "sans-serif"],
  data: ['"Fira Code"', "monospace"],
  terminal: ['"Courier New"', '"Fira Code"', "monospace"],
} as const;

/** Corner radii. */
const borderRadius = {
  terminal: "2px",
  /** Progress bars (NIL, difficulty, Moral) — Tailwind's rounded-full value. */
  pill: "9999px",
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

/**
 * Stacking order. Layering contract (issue #53):
 * header (30) < nav (40) < overlay (50). Overlays always cover nav/header;
 * the sticky HUD lives at header level so nav/overlay float above it.
 */
const zIndex = {
  "nd-header": 30,
  "nd-nav": 40,
  "nd-overlay": 50,
} as const;

/** Minimum touch target (WCAG 2.5.5, docs/design §4) — 44px. */
const minHeight = {
  touch: "44px",
} as const;

const minWidth = {
  touch: "44px",
} as const;

/** Named animations (Tailwind `animation` theme key). */
const animation = {
  glitch: "glitch 0.2s ease-in-out infinite alternate",
  flicker: "flicker 0.15s ease-in-out infinite alternate",
  "pulse-neon": "pulse-neon 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
  "fade-in": "fade-in 0.5s ease-out both",
} as const;

/** Keyframes backing {@link animation}. */
const keyframes = {
  glitch: {
    "0%": { transform: "translate(0)" },
    "20%": { transform: "translate(-1px, 1px)" },
    "40%": { transform: "translate(1px, -1px)" },
    "60%": { transform: "translate(-1px, 0)" },
    "80%": { transform: "translate(1px, 0)" },
    "100%": { transform: "translate(0)" },
  },
  flicker: {
    "0%, 100%": { opacity: "1" },
    "50%": { opacity: "0.8" },
  },
  "pulse-neon": {
    "0%, 100%": { opacity: "1" },
    "50%": { opacity: "0.5" },
  },
  "fade-in": {
    from: { opacity: "0" },
    to: { opacity: "1" },
  },
} as const;

/** Decorative effects for plain CSS consumers (scanlines, noise...). */
const effects = {
  /** Body scanline grid overlay (docs/design §8 of 00-direcao-visual). */
  scanline: "rgba(255, 255, 255, 0.015)",
} as const;

/** All design tokens, grouped by Tailwind theme key. */
export const tokens = {
  raw,
  colors,
  fontFamily,
  borderRadius,
  boxShadow,
  screens,
  transitionDuration,
  fontSize,
  zIndex,
  minHeight,
  minWidth,
  animation,
  keyframes,
  effects,
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

/** Trampo base success chance (GigListItem.successChance × 100, issue #140). */
const gigChanceBands: Band[] = [
  { min: 0, max: 39, color: "bg-nd-magenta", label: "baixa" },
  { min: 40, max: 69, color: "bg-nd-gold", label: "média" },
  { min: 70, max: 100, color: "bg-nd-green", label: "alta" },
];

/**
 * Moral: "lenda" (gold) is exclusive to score 100 — matches the server
 * readout (nextThreshold === null only at 100, see StreetCredInfo).
 */
const streetCredBands: Band[] = [
  { min: 0, max: 99, color: "bg-nd-cyan", label: "na rua" },
  { min: 100, max: 100, color: "bg-nd-gold", label: "lenda" },
];

/**
 * Color bands per resource bar (docs/design/05-design-tokens.md §Thresholds).
 * Invariant: each array covers every integer 0–100 with exactly one band, in
 * monotonic order (ascending for nil/hp/gigDifficulty/gigChance/streetCred;
 * descending for humanity), so `bandFor` always resolves after clamping/rounding.
 */
export const RESOURCE_BAR_BANDS = {
  nil: nilBands,
  humanity: humanityBands,
  hp: hpBands,
  gigDifficulty: gigDifficultyBands,
  gigChance: gigChanceBands,
  streetCred: streetCredBands,
};

/** Keys of {@link RESOURCE_BAR_BANDS}. */
export type ResourceBarKey = keyof typeof RESOURCE_BAR_BANDS;

/**
 * Pure band lookup shared by {@link bandFor} and MetricBar custom bands.
 * Clamps and rounds `percent`, then returns the first band whose inclusive
 * range contains it, or `undefined` when the array has no matching band.
 * Non-finite values (NaN, ±Infinity) resolve to the FIRST band — the most
 * critical state for ascending arrays (nil, hp, gigDifficulty, streetCred);
 * `humanity` is ordered descending, so its first band is "Íntegro" (100–71).
 * Bands are checked in order; bounds are inclusive (≥ min, ≤ max).
 */
export function bandForBands(bands: Band[], percent: number): Band | undefined {
  if (!Number.isFinite(percent)) return bands[0];
  const p = Math.min(100, Math.max(0, Math.round(percent)));
  return bands.find((b) => p >= b.min && p <= b.max);
}

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
 * Fallback: last band (RESOURCE_BAR_BANDS covers every integer 0–100, so the
 * fallback only guards against a misconfigured array).
 */
export function bandFor(resource: ResourceBarKey, percent: number): Band {
  const bands = RESOURCE_BAR_BANDS[resource];
  return bandForBands(bands, percent) ?? bands[bands.length - 1];
}