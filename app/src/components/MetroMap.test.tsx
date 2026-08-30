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
});
