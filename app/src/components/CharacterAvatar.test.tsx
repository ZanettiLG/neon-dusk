import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CharacterAvatar from "@/components/CharacterAvatar";

describe("CharacterAvatar", () => {
  it("renders the dashed placeholder when origin is null", () => {
    render(<CharacterAvatar origin={null} />);

    const img = screen.getByRole("img", { name: "Sem origem definida" });
    expect(img).toBeInTheDocument();
    expect(img.querySelector("polygon")).toHaveAttribute("stroke-dasharray");
  });

  it("renders the PA glyph for a_paraiso", () => {
    render(<CharacterAvatar origin="a_paraiso" />);

    expect(screen.getByRole("img", { name: "Avatar de A Paraíso" })).toBeInTheDocument();
    expect(screen.getByText("PA")).toBeInTheDocument();
  });

  it("renders the FE glyph for o_fervo", () => {
    render(<CharacterAvatar origin="o_fervo" />);
    expect(screen.getByText("FE")).toBeInTheDocument();
  });

  it("renders the FL glyph for o_fluxo", () => {
    render(<CharacterAvatar origin="o_fluxo" />);
    expect(screen.getByText("FL")).toBeInTheDocument();
  });

  it("renders the QB glyph for a_quebrada", () => {
    render(<CharacterAvatar origin="a_quebrada" />);
    expect(screen.getByText("QB")).toBeInTheDocument();
  });

  it("renders the BA glyph for babilonia", () => {
    render(<CharacterAvatar origin="babilonia" />);
    expect(screen.getByText("BA")).toBeInTheDocument();
  });

  it("renders the AM glyph for as_mortas", () => {
    render(<CharacterAvatar origin="as_mortas" />);
    expect(screen.getByText("AM")).toBeInTheDocument();
  });

  it("renders the PT glyph for o_ponto", () => {
    render(<CharacterAvatar origin="o_ponto" />);
    expect(screen.getByText("PT")).toBeInTheDocument();
  });

  it("scales with the size prop", () => {
    const { container } = render(<CharacterAvatar origin="a_paraiso" size="sm" />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "32");

    const { container: lgContainer } = render(<CharacterAvatar origin="a_paraiso" size="lg" />);
    expect(lgContainer.querySelector("svg")).toHaveAttribute("width", "64");
  });
});
