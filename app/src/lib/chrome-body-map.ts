import type { ChromeSlot } from "@neon-dusk/shared";

// Label geometry for the body map (issue #188, labels-only redesign). The
// artwork is a static PNG (app/src/assets/chrome/body-map.png) rendered
// decoratively at 55% width; the 9 interactive labels flank it in two side
// columns, each anchored at a pinned vertical percentage (0–100) of the map
// container so every label row tracks its body region at any breakpoint
// without JS measurement (ADR-3). Values are a static pinned table (ADR
// #188: 9 valores pinnados) and keep a minimum 8% step between labels of the
// same column.
//
// The #94 hit-area layering is deleted (SLOT_HIT_AREAS, LAYER_ORDER,
// resolveSlot, pips): the labels-only reference has no click on the body —
// labels are buttons beside the figure, never boxes over it — so there is no
// click-owner matrix to maintain.

/** Vertical anchor of one slot label, in % of the map container (0–100). */
export interface SlotLabelPos {
  slot: ChromeSlot;
  /** Which side column the label sits in (left = torso/head systems). */
  column: "left" | "right";
  /** Top anchor in % of the map container (0–100). */
  y: number;
}

/** One label per slot, y values pinned by the #188 design (gap ≥ 8% intra-column). */
export const SLOT_LABEL_POS: SlotLabelPos[] = [
  { slot: "frontal_cortex", column: "left", y: 21 },
  { slot: "ocular", column: "left", y: 29 },
  { slot: "operating_system", column: "left", y: 37 },
  { slot: "circulatory", column: "left", y: 45 },
  { slot: "skeleton", column: "left", y: 53 },
  { slot: "nervous_system", column: "left", y: 61 },
  { slot: "integumentary", column: "left", y: 69 },
  { slot: "arms", column: "right", y: 46 },
  { slot: "legs", column: "right", y: 72 },
];
