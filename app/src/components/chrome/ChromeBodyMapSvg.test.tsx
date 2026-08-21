import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ChromeBodyMapSvg from "@/components/chrome/ChromeBodyMapSvg";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";

// Issue #10 — body-map interativo: 6 hit-areas por slot, ocupação anunciada,
// teclado (Enter/Space), slot cheio desabilitado e legenda HTML como canal
// textual (cor nunca é o único canal).

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
  it("should render 6 hit-areas, one per cromo slot", () => {
    render(<ChromeBodyMapSvg installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getAllByRole("button")).toHaveLength(6);
    for (const label of [
      "Córtex Frontal",
      "Ocular",
      "Braços",
      "Esqueleto",
      "Sistema Nervoso",
      "Tegumentar",
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

  it("should mark the selected slot with aria-current and keep color as decoration", () => {
    render(<ChromeBodyMapSvg installed={[]} selectedSlot="arms" onSelectSlot={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^Braços — / })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("button", { name: /^Ocular — / })).not.toHaveAttribute("aria-current");
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

  it("should render the legenda HTML com contagens and implant names (text channel)", () => {
    render(<ChromeBodyMapSvg installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getByText("2/3 — Cuca Acesa, Mnemônica")).toBeInTheDocument();
    expect(screen.getAllByText("0/2 — vazio")).toHaveLength(2); // ocular + skeleton
  });
});
