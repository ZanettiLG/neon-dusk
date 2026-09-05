import type { ChromeSlot } from "@neon-dusk/shared";

// Interactive geometry for the AI-generated body map (issues #94, #103). The
// artwork is a static PNG (app/src/assets/chrome/body-map.png); everything the
// player interacts with is positioned here in percentages (0–100) so the
// overlay scales at any breakpoint without JS measurement (ADR-3).
//
// #103 re-derived every coordinate from the replaced AI figure (rembg matte
// measured on the 512×1024 asset): figure bbox x 27.9–69.7% / y 23.5–95.1%,
// head y 23.5–34.4% (center x≈48.5), arms x 28.9–37% / 60–69.7% (y 35–60.5%),
// legs down to y 95.1%. The #94 z-order semantics are preserved: the torso
// rectangle (integumentary) stays the base layer, skeleton owns the spine
// column, arms/legs/head zones render on top — clicks on skin still fall to
// the torso, never through to inner systems. Regenerating the image keeps
// these valid because the baseline pins the neutral pose
// (tools/asset-forge/baselines/neon-dusk.md).

/** Hit area of one slot, as a rectangle in % of the image (0–100). */
export interface SlotHitArea {
  slot: ChromeSlot;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One rectangle per body region; `arms` has two (left/right). */
export const SLOT_HIT_AREAS: SlotHitArea[] = [
  { slot: "legs", x: 27.5, y: 60, w: 41, h: 36 },
  { slot: "integumentary", x: 30, y: 34, w: 37, h: 27 },
  { slot: "nervous_system", x: 42, y: 50, w: 13, h: 11 },
  { slot: "skeleton", x: 42, y: 35, w: 13, h: 15 },
  { slot: "circulatory", x: 37, y: 37, w: 7, h: 8 },
  { slot: "arms", x: 27, y: 35, w: 11, h: 25.5 },
  { slot: "arms", x: 58.5, y: 35, w: 11.5, h: 25.5 },
  { slot: "ocular", x: 33, y: 27.5, w: 31, h: 7 },
  { slot: "operating_system", x: 38, y: 28.5, w: 21, h: 4.5 },
  { slot: "frontal_cortex", x: 35.5, y: 22.5, w: 26, h: 5.5 },
];

/** Pip/badge anchor per slot, in % of the image — real anatomy centers (#103). */
export const SLOT_PIPS: Record<ChromeSlot, { x: number; y: number }> = {
  frontal_cortex: { x: 48.5, y: 25 },
  ocular: { x: 48.5, y: 28.5 },
  operating_system: { x: 48.5, y: 32 },
  arms: { x: 33, y: 49 },
  skeleton: { x: 48.5, y: 42 },
  nervous_system: { x: 48.5, y: 55 },
  circulatory: { x: 39.5, y: 41 },
  integumentary: { x: 40, y: 57 },
  legs: { x: 46.5, y: 75 },
};

/**
 * Render order of the hit-area layers, bottom → top. Overlapping areas (e.g.
 * the torso rectangle covering skeleton/nervous_system) resolve clicks in
 * favor of the LAST sibling — the torso paints first as the base layer and
 * every smaller slot renders on top of it, same rule as the old SVG paint
 * order. resolveSlot() is the authoritative resolver for this rule. Every
 * slot appears exactly once.
 */
export const LAYER_ORDER: ChromeSlot[] = [
  "legs",
  "integumentary",
  "nervous_system",
  "skeleton",
  "circulatory",
  "arms",
  "ocular",
  "operating_system",
  "frontal_cortex",
];

/**
 * Owner of a click at image percentage (xPct, yPct): the topmost
 * LAYER_ORDER slot with a hit area containing the point. Rects are
 * half-open ([x, x+w) × [y, y+h)) so a boundary point has a single owner.
 * Returns null when the point falls outside every area. Source of truth for
 * click ownership (tests + ChromeBodyMapImage click arbitration).
 */
export function resolveSlot(xPct: number, yPct: number): ChromeSlot | null {
  for (let i = LAYER_ORDER.length - 1; i >= 0; i--) {
    const slot = LAYER_ORDER[i];
    const hit = SLOT_HIT_AREAS.some(
      (area) =>
        area.slot === slot &&
        xPct >= area.x &&
        xPct < area.x + area.w &&
        yPct >= area.y &&
        yPct < area.y + area.h,
    );
    if (hit) return slot;
  }
  return null;
}
