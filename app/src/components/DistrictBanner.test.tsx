import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Origin } from "@neon-dusk/shared";
import DistrictBanner from "@/components/DistrictBanner";

// Non-hub districts render their two-letter glyph; Babilônia renders the
// feira-stall glyph + "// MERCADO DO SUBMUNDO" (02-mundo-e-universo.md).
const NON_HUB_GLYPHS: [Origin, string][] = [
  ["a_paraiso", "PA"],
  ["o_fervo", "FE"],
  ["o_fluxo", "FL"],
  ["a_quebrada", "QB"],
  ["as_mortas", "AM"],
  ["o_ponto", "PT"],
];

describe("DistrictBanner", () => {
  it("should default to Babilônia with the hub label", () => {
    render(<DistrictBanner />);

    expect(screen.getByText(/BABILÔNIA/)).toBeInTheDocument();
    expect(screen.getByText("// MERCADO DO SUBMUNDO")).toBeInTheDocument();
  });

  it("should render the district name and two-letter glyph for a non-hub district", () => {
    render(<DistrictBanner district="a_paraiso" />);

    expect(screen.getByText(/A PARAÍSO/)).toBeInTheDocument();
    expect(screen.getByText("// PA")).toBeInTheDocument();
  });

  it("should render the correct glyph for every non-hub district", () => {
    for (const [district, glyph] of NON_HUB_GLYPHS) {
      const { unmount } = render(<DistrictBanner district={district} />);
      expect(screen.getByText(`// ${glyph}`), `${district} glyph`).toBeInTheDocument();
      unmount();
    }
  });
});
