import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChromeBodyMapSvg from "@/components/chrome/ChromeBodyMapSvg";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";

// Issue #10 — body-map interativo: 9 hit-areas por slot (issue #28 adicionou
// operating_system, circulatory e legs), ocupação anunciada, teclado
// (Enter/Space), slot cheio desabilitado e legenda HTML como canal textual
// (cor nunca é o único canal).

function chromeRecord(installedId: string, name: string, slot: ChromeSlot): InstalledChromeRecord {
  return {
    installedId,
    installedAt: "2026-01-01T00:00:00.000Z",
    definition: {
      id: `def-${installedId}`,
      slug: `slug-${installedId}`,
      name,
      slot,
      tier: 1,
      bonuses: {},
      humanityCost: 3,
      basePrice: 100,
    },
  };
}

const LOADOUT: InstalledChromeRecord[] = [
  chromeRecord("i1", "Cuca Acesa", "frontal_cortex"),
  chromeRecord("i2", "Mnemônica", "frontal_cortex"),
  chromeRecord("i3", "Braço de Ferro", "arms"),
];

describe("ChromeBodyMapSvg", () => {
  it("should render 9 hit-areas, one per cromo slot", () => {
    render(<ChromeBodyMapSvg installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(9);
    for (const label of [
      "Córtex Frontal",
      "Ocular",
      "Sistema Operacional",
      "Braços",
      "Esqueleto",
      "Sistema Nervoso",
      "Circulatório",
      "Tegumentar",
      "Pernas",
    ]) {
      expect(screen.getByRole("button", { name: new RegExp(`^${label} — `) })).toBeInTheDocument();
    }
  });

  it("should announce occupancy in each slot's aria-label", () => {
    render(<ChromeBodyMapSvg installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Córtex Frontal — 2/3 ocupados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Braços — 1/2 ocupados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocular — 0/2 ocupados" })).toBeInTheDocument();
  });

  it("should select a slot on click", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapSvg installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    fireEvent.click(screen.getByRole("button", { name: /^Braços — / }));

    expect(onSelectSlot).toHaveBeenCalledWith("arms");
  });

  it("should select a slot with Enter and Space", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapSvg installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: /^Córtex Frontal — / });
    fireEvent.keyDown(cortex, { key: "Enter" });
    expect(onSelectSlot).toHaveBeenCalledWith("frontal_cortex");

    const ocular = screen.getByRole("button", { name: /^Ocular — / });
    fireEvent.keyDown(ocular, { key: " " });
    expect(onSelectSlot).toHaveBeenCalledWith("ocular");
  });

  it("should mark the selected slot with aria-pressed and keep color as decoration", () => {
    render(<ChromeBodyMapSvg installed={[]} selectedSlot="arms" onSelectSlot={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^Braços — / })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Ocular — / })).not.toHaveAttribute("aria-pressed");
  });

  it("should disable a full slot: aria-disabled, no click, no keyboard selection", () => {
    const onSelectSlot = vi.fn();
    const full = [
      ...LOADOUT,
      chromeRecord("i4", "Compilador", "frontal_cortex"),
    ];
    render(<ChromeBodyMapSvg installed={full} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: "Córtex Frontal — 3/3 ocupados" });
    expect(cortex).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(cortex);
    fireEvent.keyDown(cortex, { key: "Enter" });
    fireEvent.keyDown(cortex, { key: " " });

    expect(onSelectSlot).not.toHaveBeenCalled();
  });

  it("should paint the torso (integumentary) as the base layer with smaller slots on top (DOM order)", () => {
    render(<ChromeBodyMapSvg installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />);

    // Document order = paint order (later siblings capture pointer events
    // first). The torso polygon covers skeleton/nervous_system geometry, so it
    // must come FIRST; the smaller slots render on top of it. Issue #28 added
    // legs (under the torso), circulatory (over the spine) and the OS deck
    // (over the ocular zone).
    const labels = screen.getAllByRole("button").map((b) => b.getAttribute("aria-label"));
    expect(labels[0]).toMatch(/^Pernas — /);
    expect(labels[1]).toMatch(/^Tegumentar — /);
    expect(labels[2]).toMatch(/^Sistema Nervoso — /);
    expect(labels[3]).toMatch(/^Esqueleto — /);
    expect(labels[4]).toMatch(/^Circulatório — /);
    expect(labels[5]).toMatch(/^Braços — /);
    expect(labels[6]).toMatch(/^Ocular — /);
    expect(labels[7]).toMatch(/^Sistema Operacional — /);
    expect(labels[8]).toMatch(/^Córtex Frontal — /);
  });

  it("should render the legenda HTML com contagens and implant names (text channel)", () => {
    render(<ChromeBodyMapSvg installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getByText("2/3 — Cuca Acesa, Mnemônica")).toBeInTheDocument();
    expect(screen.getAllByText("0/2 — vazio")).toHaveLength(2); // ocular + skeleton
  });
});
