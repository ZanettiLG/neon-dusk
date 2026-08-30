import { describe, it, expect } from "vitest";
import { ORIGINS } from "@neon-dusk/shared";
import type { Origin } from "@neon-dusk/shared";
import { ORIGIN_LABELS } from "@/lib/labels";
import { originFromDistrictString } from "@/lib/district-meta";

// originFromDistrictString normalizes the two real payload formats: vendor
// seeds store the Origin key ("o_fervo") while trampo templates store the
// display label ("O Fervo"). Both must resolve to the same Origin.
describe("originFromDistrictString", () => {
  it("should map the Origin key form used by vendor seeds", () => {
    expect(originFromDistrictString("o_fervo")).toBe("o_fervo");
    expect(originFromDistrictString("babilonia")).toBe("babilonia");
    expect(originFromDistrictString("as_mortas")).toBe("as_mortas");
  });

  it("should map the display-label form used by trampo templates", () => {
    expect(originFromDistrictString("O Fervo")).toBe("o_fervo");
    expect(originFromDistrictString("Babilônia")).toBe("babilonia");
    expect(originFromDistrictString("A Quebrada")).toBe("a_quebrada");
  });

  it("should cover every Origin in the key form", () => {
    for (const origin of ORIGINS) {
      expect(originFromDistrictString(origin), `${origin} key`).toBe(origin);
    }
  });

  it("should map every display label back to its Origin", () => {
    for (const [origin, label] of Object.entries(ORIGIN_LABELS) as [Origin, string][]) {
      expect(originFromDistrictString(label), label).toBe(origin);
    }
  });

  it("should return null for unknown district strings", () => {
    expect(originFromDistrictString("Tóquio")).toBeNull();
    expect(originFromDistrictString("")).toBeNull();
  });

  it("should be case-sensitive for display labels (payloads are canonical)", () => {
    expect(originFromDistrictString("o fervo")).toBeNull();
    expect(originFromDistrictString("O FERVO")).toBeNull();
    expect(originFromDistrictString("BABILÔNIA")).toBeNull();
  });
});
