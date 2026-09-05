import { describe, it, expect } from "vitest";
import { CHROME_SLOTS } from "@neon-dusk/shared";
import { SLOT_LABEL_POS } from "./chrome-body-map";

// Issue #188 — labels-only redesign: pinned y anchors (static table) with a
// minimum 8% step inside each column. The #94 hit-area geometry (hit areas,
// LAYER_ORDER, resolveSlot, pips) is deleted — the body is never a click
// target, so there is no click-owner matrix to pin.

describe("chrome-body-map (SLOT_LABEL_POS)", () => {
  it("should define exactly one label per slot (9 pinned values)", () => {
    expect(SLOT_LABEL_POS).toHaveLength(9);
    expect(new Set(SLOT_LABEL_POS.map((p) => p.slot))).toEqual(new Set(CHROME_SLOTS));
  });

  it("should place the 7 torso/head systems on the left and arms/legs on the right, in pinned order", () => {
    const left = SLOT_LABEL_POS.filter((p) => p.column === "left").map((p) => p.slot);
    const right = SLOT_LABEL_POS.filter((p) => p.column === "right").map((p) => p.slot);
    expect(left).toEqual([
      "frontal_cortex",
      "ocular",
      "operating_system",
      "circulatory",
      "skeleton",
      "nervous_system",
      "integumentary",
    ]);
    expect(right).toEqual(["arms", "legs"]);
  });

  it("should keep every y anchor within 0–100 with a minimum 8% gap inside a column", () => {
    for (const column of ["left", "right"] as const) {
      const ys = SLOT_LABEL_POS
        .filter((p) => p.column === column)
        .map((p) => p.y)
        .sort((a, b) => a - b);
      for (const y of ys) {
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
      for (let i = 1; i < ys.length; i++) {
        expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(8);
      }
    }
  });
});
