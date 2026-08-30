import { describe, it, expect } from "vitest";
import { ORIGINS } from "@neon-dusk/shared";
import type { Origin } from "@neon-dusk/shared";
import { METRO_LINES, findLineFor } from "@/lib/metro-lines";

// findLineFor resolves the line serving a station. O Fluxo sits on BOTH
// lines — the contract is first match (Linha 3-Vermelha).
describe("findLineFor", () => {
  it("should resolve the transfer station O Fluxo to the first match (Linha 3-Vermelha)", () => {
    expect(findLineFor("o_fluxo").id).toBe("line-3-vermelha");
  });

  it("should resolve red-line stations to the red line", () => {
    for (const origin of ["o_ponto", "babilonia", "a_paraiso"] as Origin[]) {
      expect(findLineFor(origin), origin).toMatchObject({
        id: "line-3-vermelha",
        label: "Linha 3-Vermelha",
      });
    }
  });

  it("should resolve lilac-only stations to the lilac line", () => {
    for (const origin of ["a_quebrada", "o_fervo", "as_mortas"] as Origin[]) {
      expect(findLineFor(origin), origin).toMatchObject({
        id: "line-4-lilas",
        label: "Linha 4-Lilás",
      });
    }
  });

  it("should cover all seven districts across the two lines", () => {
    const covered = new Set(METRO_LINES.flatMap((line) => line.stops));
    for (const origin of ORIGINS) {
      expect(covered.has(origin), `${origin} covered by a line`).toBe(true);
      expect(
        METRO_LINES.some((line) => line.stops.includes(origin)),
        origin,
      ).toBe(true);
    }
  });

  it("should fall back to the first line for an unknown origin (documented contract)", () => {
    // Origin is a closed union — the fallback only guards misconfiguration.
    expect(findLineFor("as_direto" as Origin).id).toBe("line-3-vermelha");
  });
});
