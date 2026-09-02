import { describe, it, expect } from "vitest";
import { HEAT_LEVELS, heatLevelFor } from "@/lib/heat";

// Issue #18 — district heat band bucketing (map view).

describe("HEAT_LEVELS", () => {
  it("should define the four canonical bands in order", () => {
    expect(HEAT_LEVELS.map((b) => b.level)).toEqual(["limpo", "quente", "pegando_fogo", "inferno"]);
    expect(HEAT_LEVELS[0].label).toBe("LIMPO");
    expect(HEAT_LEVELS[2].label).toBe("PEGANDO FOGO");
    expect(HEAT_LEVELS[3].label).toBe("INFERNO");
    expect(HEAT_LEVELS[3].pulse).toBe(true);
  });
});

describe("heatLevelFor", () => {
  it.each([
    [0, "limpo"],
    [1, "quente"],
    [49, "quente"],
    [50, "pegando_fogo"],
    [99, "pegando_fogo"],
    [100, "inferno"],
    [250, "inferno"],
  ])("should bucket %d as %s", (heat, level) => {
    expect(heatLevelFor(heat)).toBe(level);
  });

  it("should clamp negative values to limpo", () => {
    expect(heatLevelFor(-5)).toBe("limpo");
  });

  it("should treat non-finite values as limpo", () => {
    expect(heatLevelFor(NaN)).toBe("limpo");
    expect(heatLevelFor(Infinity)).toBe("limpo");
  });
});
