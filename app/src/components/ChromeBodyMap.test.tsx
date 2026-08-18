import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ChromeBodyMap from "@/components/ChromeBodyMap";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";

// ND-139 — ChromeBodyMap: all 6 body slots with count/capacity, implant names
// in filled slots, dimmed placeholders in empty ones. Empty/loading states are
// handled by the DashboardView, not this component.

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
      humanityCost: 5,
      basePrice: 100,
    },
  };
}

const SEEDED_LOADOUT: InstalledChromeRecord[] = [
  chromeRecord("inst-1", "Mnemônica", "frontal_cortex"),
  chromeRecord("inst-2", "Compilador Neural", "frontal_cortex"),
  chromeRecord("inst-3", "Braço Hidráulico", "arms"),
  chromeRecord("inst-4", "Espinha de Vidro", "nervous_system"),
];

describe("ChromeBodyMap", () => {
  it("should render all 6 slot labels", () => {
    render(<ChromeBodyMap installed={[]} />);

    for (const label of [
      "Córtex Frontal",
      "Ocular",
      "Braços",
      "Esqueleto",
      "Sistema Nervoso",
      "Tegumentar",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("should render count/capacity for a seeded loadout", () => {
    render(<ChromeBodyMap installed={SEEDED_LOADOUT} />);

    expect(screen.getByText("2/3")).toBeInTheDocument(); // frontal_cortex
    expect(screen.getAllByText("0/2")).toHaveLength(2); // ocular + skeleton
    expect(screen.getByText("1/2")).toBeInTheDocument(); // arms
    expect(screen.getByText("1/3")).toBeInTheDocument(); // nervous_system
    expect(screen.getByText("0/3")).toBeInTheDocument(); // integumentary
  });

  it("should show implant names in filled slots", () => {
    render(<ChromeBodyMap installed={SEEDED_LOADOUT} />);

    expect(screen.getByText("Mnemônica")).toBeInTheDocument();
    expect(screen.getByText("Compilador Neural")).toBeInTheDocument();
    expect(screen.getByText("Braço Hidráulico")).toBeInTheDocument();
    expect(screen.getByText("Espinha de Vidro")).toBeInTheDocument();
  });

  it("should dim empty slots and render a placeholder dash", () => {
    render(<ChromeBodyMap installed={SEEDED_LOADOUT} />);

    // Ocular, Esqueleto and Tegumentar are empty → 3 dashes.
    const dashes = screen.getAllByText("—");
    expect(dashes).toHaveLength(3);
    for (const dash of dashes) {
      // The dash span is a direct child of the slot card div.
      expect(dash.closest("div")).toHaveClass("opacity-60", "border-nd-cyan/10");
    }
  });

  it("should not dim filled slots", () => {
    render(<ChromeBodyMap installed={SEEDED_LOADOUT} />);

    // Filled card (frontal_cortex): the implant name's closest div is the card.
    expect(screen.getByText("Mnemônica").closest("div")).not.toHaveClass("opacity-60");
  });
});
