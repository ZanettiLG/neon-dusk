import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import IconGalleryView from "@/views/IconGalleryView";

// Dev-only gallery (route /dev/icons). Renders the 35 P0 icon sections from
// the asset manifest plus one section per raster registry type. Raster dirs
// are real on disk: `chrome/body-map.png` is committed, the other five hold
// only .gitkeep — so the empty-dir placeholder path is exercised for real.
describe("IconGalleryView", () => {
  it("should render the dev header and the icon sections from the manifest", () => {
    render(<IconGalleryView />);

    expect(
      screen.getByRole("heading", { name: "DEV — Galeria de Assets" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/registry v2/)).toBeInTheDocument();

    for (const title of [
      "Atributos",
      "Bancas",
      "Ações",
      "Recursos",
      "Molduras de Cards",
      "Tiers",
      "Estados",
    ]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }

    // A known icon card is reachable through its manifest alt.
    expect(
      screen.getByRole("img", { name: "Ícone do atributo Body" }),
    ).toBeInTheDocument();
  });

  it("should render one section per raster registry type with its metadata card", () => {
    render(<IconGalleryView />);

    for (const id of ["body-map", "portrait", "scene", "item", "backdrop", "gig-art"]) {
      expect(screen.getByRole("heading", { name: id })).toBeInTheDocument();
    }

    // body-map metadata: dims, regime, postprocess, output dir.
    const bodyMap = screen.getByRole("heading", { name: "body-map" }).closest("section");
    expect(bodyMap).not.toBeNull();
    expect(within(bodyMap!).getByText(/512×1024/)).toBeInTheDocument();
    expect(within(bodyMap!).getByText(/regime flat/)).toBeInTheDocument();
    expect(within(bodyMap!).getByText(/rembg: true/)).toBeInTheDocument();
    expect(within(bodyMap!).getByText(/app\/src\/assets\/chrome/)).toBeInTheDocument();

    // scene metadata carries its seed family members.
    const scene = screen.getByRole("heading", { name: "scene" }).closest("section");
    expect(within(scene!).getByText(/cenas-distritos: babilonia, as-mortas/)).toBeInTheDocument();
  });

  it("should show a placeholder for raster types without committed assets", () => {
    render(<IconGalleryView />);

    // portrait, scene, item, backdrop, `gig-art` have empty dirs; body-map has
    // the committed baseline, so exactly 5 placeholders render.
    expect(screen.getAllByText(/não gerado/)).toHaveLength(5);
    expect(screen.getAllByText(/node tools\/asset-forge\/cli\.mjs generate/)).toHaveLength(5);
  });

  it("should render the committed body-map baseline as a lazy-loaded figure", () => {
    render(<IconGalleryView />);

    const img = screen.getByAltText("body-map — body-map.png");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("loading", "lazy");
    expect(img).toHaveAttribute("src", expect.stringContaining("body-map.png"));
  });
});
