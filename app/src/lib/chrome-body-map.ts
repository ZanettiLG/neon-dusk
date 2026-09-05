import type { ChromeSlot } from "@neon-dusk/shared";

// Interactive geometry for the AI-generated body map (issue #94). The artwork
// is a static PNG (app/src/assets/chrome/body-map.png); everything the player
// interacts with is positioned here in percentages (0–100) so the overlay
// scales at any breakpoint without JS measurement (ADR-3).
//
// Coordinates are derived from the old ChromeBodyMapSvg viewBox 200×400
// (x/2, y/4), preserving the geometry tuned in issues #10/#28: each hit area
// bounds the artwork path plus its stroke width. Regenerating the image keeps
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
  { slot: "legs", x: 42, y: 58.75, w: 16, h: 24.25 },
  { slot: "integumentary", x: 17.5, y: 23, w: 65, h: 35.75 },
  { slot: "nervous_system", x: 42, y: 39.5, w: 16, h: 17.5 },
  { slot: "skeleton", x: 29, y: 18, w: 42, h: 30 },
  { slot: "circulatory", x: 31, y: 25.5, w: 16, h: 8 },
  { slot: "arms", x: 4, y: 25, w: 29, h: 35 },
  { slot: "arms", x: 67, y: 25, w: 29, h: 35 },
  { slot: "ocular", x: 34, y: 9.25, w: 32, h: 11.5 },
  { slot: "operating_system", x: 39, y: 14.5, w: 22, h: 8 },
  { slot: "frontal_cortex", x: 36.5, y: 1.75, w: 27, h: 11.5 },
];

/** Pip/badge anchor per slot, in % of the image (viewBox PIPS / 2 and / 4). */
export const SLOT_PIPS: Record<ChromeSlot, { x: number; y: number }> = {
  frontal_cortex: { x: 50, y: 3 },
  ocular: { x: 50, y: 21.5 },
  operating_system: { x: 50, y: 13 },
  arms: { x: 18, y: 61.5 },
  skeleton: { x: 56, y: 33 },
  nervous_system: { x: 56, y: 63 },
  circulatory: { x: 28, y: 44 },
  integumentary: { x: 30, y: 63 },
  legs: { x: 50, y: 88 },
};

/**
 * Render order of the hit-area layers, bottom → top. Overlapping areas (e.g.
 * the torso rectangle covering skeleton/nervous_system) resolve clicks in
 * favor of the LAST sibling — the torso paints first as the base layer and
 * every smaller slot renders on top of it, same rule as the old SVG paint
 * order. Every slot appears exactly once.
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
