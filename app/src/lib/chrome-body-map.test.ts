import { describe, it, expect } from "vitest";
import { CHROME_SLOTS } from "@neon-dusk/shared";
import { LAYER_ORDER, SLOT_HIT_AREAS, SLOT_PIPS } from "./chrome-body-map";

// Issue #94 — geometry of the AI body-map overlay: hit-areas and pip anchors
// in image percentages (0–100), derived from the old SVG viewBox (x/2, y/4).

describe("chrome-body-map", () => {
  it("should define hit areas for all 9 slots (arms with left + right entries)", () => {
    const slots = new Set(SLOT_HIT_AREAS.map((area) => area.slot));
    expect(slots).toEqual(new Set(CHROME_SLOTS));
    expect(SLOT_HIT_AREAS).toHaveLength(10);
    expect(SLOT_HIT_AREAS.filter((area) => area.slot === "arms")).toHaveLength(2);
  });

  it("should keep every coordinate within 0–100 and positive-sized", () => {
    for (const { x, y, w, h } of SLOT_HIT_AREAS) {
      for (const value of [x, y]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      for (const value of [w, h]) {
        expect(value).toBeGreaterThan(0);
        expect(value).toBeLessThanOrEqual(100);
      }
      expect(x + w).toBeLessThanOrEqual(100);
      expect(y + h).toBeLessThanOrEqual(100);
    }
    for (const { x, y } of Object.values(SLOT_PIPS)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(100);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(100);
    }
  });

  it("should order layers bottom → top with every slot exactly once", () => {
    expect(LAYER_ORDER).toHaveLength(9);
    expect(new Set(LAYER_ORDER).size).toBe(9);
    expect(new Set(LAYER_ORDER)).toEqual(new Set(CHROME_SLOTS));
    // Base layer first (torso covers the smaller slots' geometry).
    expect(LAYER_ORDER[0]).toBe("legs");
    expect(LAYER_ORDER[1]).toBe("integumentary");
    expect(LAYER_ORDER[LAYER_ORDER.length - 1]).toBe("frontal_cortex");
  });

  it("should anchor pips for each of the 9 slots", () => {
    expect(Object.keys(SLOT_PIPS).sort()).toEqual([...CHROME_SLOTS].sort());
  });
});
