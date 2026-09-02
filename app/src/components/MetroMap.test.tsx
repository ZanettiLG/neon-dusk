import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { Origin } from "@neon-dusk/shared";
import MetroMap from "@/components/MetroMap";

const STATIONS: [Origin, string][] = [
  ["a_paraiso", "A Paraíso"],
  ["o_fervo", "O Fervo"],
  ["o_fluxo", "O Fluxo"],
  ["a_quebrada", "A Quebrada"],
  ["babilonia", "Babilônia"],
  ["as_mortas", "As Mortas"],
  ["o_ponto", "O Ponto"],
];

function renderMap(props: Partial<ComponentProps<typeof MetroMap>> = {}) {
  const onSelect = props.onSelect ?? vi.fn();
  render(
    <MetroMap
      currentDistrict={props.currentDistrict ?? null}
      originDistrict={props.originDistrict ?? null}
      vendorsByDistrict={props.vendorsByDistrict ?? {}}
      gigsByDistrict={props.gigsByDistrict ?? {}}
      heatByDistrict={props.heatByDistrict ?? {}}
      territoryByDistrict={props.territoryByDistrict ?? {}}
      traveling={props.traveling ?? false}
      onSelect={onSelect}
    />,
  );
  return onSelect;
}

describe("MetroMap", () => {
  it("should render the diagram with an accessible label", () => {
    renderMap();

    expect(
      screen.getByRole("img", { name: "Mapa do metrô de São Paulo 2087" }),
    ).toBeInTheDocument();
  });

  it("should render all 7 stations with glyphs and pt-BR labels", () => {
    renderMap();

    for (const [origin, label] of STATIONS) {
      expect(
        screen.getByRole("button", { name: `Estação ${label}` }),
        `${origin} station`,
      ).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    for (const glyph of ["PA", "FE", "FL", "QB", "BA", "AM", "PT"]) {
      expect(screen.getByText(glyph)).toBeInTheDocument();
    }
  });

  it("should draw both lines connecting their stops", () => {
    renderMap();

    const red = screen.getByTestId("metro-line-line-3-vermelha");
    expect(red).toHaveAttribute("points", "55,245 130,175 185,95 310,55");
    expect(red).toHaveClass("stroke-nd-magenta/40");

    const lilac = screen.getByTestId("metro-line-line-4-lilas");
    expect(lilac).toHaveAttribute("points", "70,70 185,95 200,235 320,220");
    expect(lilac).toHaveClass("stroke-nd-purple/40");

    expect(screen.getByText("Linha 3-Vermelha")).toBeInTheDocument();
    expect(screen.getByText("Linha 4-Lilás")).toBeInTheDocument();
  });

  it("should show vendor badges only for districts with vendors", () => {
    renderMap({ vendorsByDistrict: { o_fervo: 2, babilonia: 1 } });

    const fervoBadge = screen.getByTestId("metro-vendors-o_fervo");
    expect(within(fervoBadge).getByText("2")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("metro-vendors-babilonia")).getByText("1"),
    ).toBeInTheDocument();

    expect(screen.queryByTestId("metro-vendors-a_paraiso")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metro-vendors-o_ponto")).not.toBeInTheDocument();
  });

  it("should announce the vendor count in the station aria-label", () => {
    renderMap({ vendorsByDistrict: { o_fervo: 2, babilonia: 1 } });

    // Plural and singular forms — the badge itself is aria-hidden, so the
    // count must be reachable through the accessible name.
    expect(
      screen.getByRole("button", { name: "Estação O Fervo, 2 vendedores" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Estação Babilônia, 1 vendedor" }),
    ).toBeInTheDocument();

    // Districts without vendors keep the plain station name.
    expect(screen.getByRole("button", { name: "Estação A Paraíso" })).toBeInTheDocument();
  });

  it("should keep the vendor badge clear of the current-district marker", () => {
    renderMap({ currentDistrict: "o_fervo", vendorsByDistrict: { o_fervo: 2 } });

    const fervo = screen.getByRole("button", { name: "Estação O Fervo, 2 vendedores" });
    expect(within(fervo).getByText("VOCÊ ESTÁ AQUI")).toBeInTheDocument();

    // Geometry contract: the badge is vertically centered on the station
    // (x+27, y — o_fervo sits at 200,235). The marker band is y-24.5..y-15.5
    // and the badge spans y-12..y+12 — no overlap, even when both render.
    expect(screen.getByTestId("metro-vendors-o_fervo")).toHaveAttribute(
      "transform",
      "translate(227 235)",
    );
  });

  it("should mark the origin district with a ring and the current district with a fill", () => {
    renderMap({ originDistrict: "a_paraiso", currentDistrict: "babilonia" });

    const origin = screen.getByRole("button", { name: "Estação A Paraíso" });
    expect(origin).toHaveAttribute("data-origin", "true");
    expect(origin.querySelector("circle")).toHaveClass("stroke-nd-cyan");

    const current = screen.getByRole("button", { name: "Estação Babilônia" });
    expect(current).toHaveAttribute("data-current", "true");
    expect(within(current).getByText("VOCÊ ESTÁ AQUI")).toBeInTheDocument();
    // The station core circle is filled (fill utility beats the fill=none attr).
    expect(current.querySelector("circle")).toHaveClass("fill-nd-cyan/20");
  });

  it("should fire onSelect on click, Enter and Space", () => {
    const onSelect = renderMap();

    fireEvent.click(screen.getByRole("button", { name: "Estação O Fervo" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Estação O Fervo" }), { key: "Enter" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Estação O Ponto" }), { key: " " });

    expect(onSelect).toHaveBeenCalledTimes(3);
    expect(onSelect).toHaveBeenCalledWith("o_fervo");
    expect(onSelect).toHaveBeenCalledWith("o_ponto");
  });

  it("should not fire onSelect while traveling", () => {
    const onSelect = renderMap({ traveling: true });

    fireEvent.click(screen.getByRole("button", { name: "Estação O Fervo" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Estação O Fervo" }), { key: "Enter" });

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Estação O Fervo" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  // ─── Issue #18: trampos / calor / território indicators ──────────────────

  it("should render trampo, heat and territory indicators only when data exists", () => {
    renderMap({
      gigsByDistrict: { o_fervo: 3, babilonia: 1 },
      heatByDistrict: { babilonia: 60 },
      territoryByDistrict: { a_paraiso: "BLD" },
    });

    // Trampos badges (count text inside).
    expect(within(screen.getByTestId("metro-gigs-o_fervo")).getByText("3")).toBeInTheDocument();
    expect(within(screen.getByTestId("metro-gigs-babilonia")).getByText("1")).toBeInTheDocument();

    // Calor label (band word).
    expect(screen.getByTestId("metro-heat-babilonia")).toHaveTextContent("PEGANDO FOGO");

    // Território label ([TAG]).
    expect(screen.getByTestId("metro-territory-a_paraiso")).toHaveTextContent("[BLD]");

    // Districts without data render no indicators.
    expect(screen.queryByTestId("metro-gigs-a_paraiso")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metro-heat-o_fervo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("metro-territory-babilonia")).not.toBeInTheDocument();
  });

  it("should announce the indicators in the station aria-label", () => {
    renderMap({
      gigsByDistrict: { o_fervo: 3, babilonia: 1 },
      heatByDistrict: { o_fervo: 30 },
      territoryByDistrict: { o_fervo: "BLD" },
    });

    expect(
      screen.getByRole("button", {
        name: "Estação O Fervo, 3 trampos, calor QUENTE (30), território do bonde BLD",
      }),
    ).toBeInTheDocument();

    // Singular trampo + no-indicator districts keep the plain name.
    expect(screen.getByRole("button", { name: "Estação Babilônia, 1 trampo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Estação A Paraíso" })).toBeInTheDocument();
  });

  it("should place the trampo badge on the station's left and keep heat/territory clear", () => {
    renderMap({
      gigsByDistrict: { o_fervo: 3 },
      heatByDistrict: { o_fervo: 30 },
      territoryByDistrict: { o_fervo: "BLD" },
    });

    // Geometry contract: trampo badge centered at (x-27, y) — o_fervo (200,235).
    expect(screen.getByTestId("metro-gigs-o_fervo")).toHaveAttribute(
      "transform",
      "translate(173 235)",
    );
    // Heat at (x, y+34), territory at (x, y-32) — inside the 400×300 viewBox.
    expect(screen.getByTestId("metro-heat-o_fervo")).toHaveAttribute("x", "200");
    expect(screen.getByTestId("metro-heat-o_fervo")).toHaveAttribute("y", "269");
    expect(screen.getByTestId("metro-territory-o_fervo")).toHaveAttribute("x", "200");
    expect(screen.getByTestId("metro-territory-o_fervo")).toHaveAttribute("y", "203");
  });

  it("should color the heat word by band and pulse on INFERNO", () => {
    renderMap({ heatByDistrict: { o_fervo: 30, babilonia: 120 } });

    expect(screen.getByTestId("metro-heat-o_fervo")).toHaveClass("fill-nd-gold");
    expect(screen.getByTestId("metro-heat-o_fervo")).not.toHaveClass("animate-pulse-neon");

    expect(screen.getByTestId("metro-heat-babilonia")).toHaveTextContent("INFERNO");
    expect(screen.getByTestId("metro-heat-babilonia")).toHaveClass(
      "fill-nd-magenta",
      "animate-pulse-neon",
    );
  });

  it("should render the QUENTE word for a low heat district", () => {
    renderMap({ heatByDistrict: { o_fervo: 30 } });

    expect(screen.getByTestId("metro-heat-o_fervo")).toHaveTextContent("QUENTE");
  });

  it("should keep indicators aria-hidden (announced via the station label)", () => {
    renderMap({
      gigsByDistrict: { o_fervo: 3 },
      heatByDistrict: { o_fervo: 30 },
      territoryByDistrict: { o_fervo: "BLD" },
    });

    expect(screen.getByTestId("metro-gigs-o_fervo")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("metro-heat-o_fervo")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("metro-territory-o_fervo")).toHaveAttribute("aria-hidden", "true");
  });

  it("should render the heat key with the bands that can appear on the map", () => {
    renderMap({ heatByDistrict: { o_fervo: 30 } });

    const heatKey = screen.getByTestId("metro-heat-legend");
    expect(within(heatKey).getByText("QUENTE")).toBeInTheDocument();
    expect(within(heatKey).getByText("PEGANDO FOGO")).toBeInTheDocument();
    expect(within(heatKey).getByText("INFERNO")).toBeInTheDocument();
    // LIMPO never renders a chip on the map, so it stays out of the heat key.
    expect(within(heatKey).queryByText("LIMPO")).not.toBeInTheDocument();
  });
});
