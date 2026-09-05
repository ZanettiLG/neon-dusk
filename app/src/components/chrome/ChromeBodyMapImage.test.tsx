import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChromeBodyMapImage from "@/components/chrome/ChromeBodyMapImage";
import { LAYER_ORDER } from "@/lib/chrome-body-map";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";

// Issue #94 — body-map interativo sobre a arte IA: hit-areas em porcentagem
// (10 botões — braços tem 2 regiões), ocupação anunciada, teclado
// (Enter/Space), slot cheio desabilitado e legenda HTML como canal textual
// (cor nunca é o único canal). Contrato do grupo preservado do ChromeBodyMapSvg.

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

describe("ChromeBodyMapImage", () => {
  it("should render the AI artwork decoratively and 10 hit-areas (9 slots, arms × 2)", () => {
    const renderResult = render(
      <ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />,
    );

    // alt="" + aria-hidden → the artwork is presentational (no img role);
    // all information lives in the buttons + legenda.
    const img = renderResult.container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img!.getAttribute("src")).toMatch(/body-map/);

    // 10 buttons: one per hit area (arms has left + right), 9 unique slots.
    expect(screen.getAllByRole("button")).toHaveLength(10);
    const uniqueSlots = new Set(
      screen.getAllByRole("button").map((b) => b.getAttribute("data-slot")),
    );
    expect(uniqueSlots.size).toBe(9);
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
      expect(
        screen.getAllByRole("button", { name: new RegExp(`^${label} — `) }).length,
      ).toBeGreaterThan(0);
    }
  });

  it("should position hit-areas with percentage geometry derived from the old SVG viewBox", () => {
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />);

    const legs = screen.getAllByRole("button", { name: /^Pernas — / })[0];
    expect(legs).toHaveStyle({ left: "42%", top: "58.75%", width: "16%", height: "24.25%" });

    // Paint order preserved: torso (Tegumentar) is the FIRST hit-area, so the
    // smaller slots rendered after it win overlapping clicks (LAYER_ORDER).
    const firstSlot = screen.getAllByRole("button")[0].getAttribute("data-slot");
    expect(firstSlot).toBe(LAYER_ORDER[0]);
  });

  it("should announce occupancy in each slot's aria-label", () => {
    render(<ChromeBodyMapImage installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Córtex Frontal — 2/3 ocupados" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Braços — 1/2 ocupados" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Ocular — 0/2 ocupados" })).toBeInTheDocument();
  });

  it("should select a slot on click", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    fireEvent.click(screen.getAllByRole("button", { name: /^Braços — / })[0]);

    expect(onSelectSlot).toHaveBeenCalledWith("arms");
  });

  it("should select a slot with Enter and Space", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: /^Córtex Frontal — / });
    fireEvent.keyDown(cortex, { key: "Enter" });
    expect(onSelectSlot).toHaveBeenCalledWith("frontal_cortex");

    const ocular = screen.getByRole("button", { name: /^Ocular — / });
    fireEvent.keyDown(ocular, { key: " " });
    expect(onSelectSlot).toHaveBeenCalledWith("ocular");
  });

  it("should preventDefault on Enter/Space (no native double-fire)", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: /^Córtex Frontal — / });
    // fireEvent resolves to !defaultPrevented — false proves preventDefault ran.
    expect(fireEvent.keyDown(cortex, { key: "Enter" })).toBe(false);
    expect(fireEvent.keyDown(cortex, { key: " " })).toBe(false);
    expect(onSelectSlot).toHaveBeenCalledTimes(2);
  });

  it("should skip full slots in keyboard tab order", async () => {
    const user = userEvent.setup();
    const full = [...LOADOUT, chromeRecord("i4", "Compilador", "frontal_cortex")];
    render(<ChromeBodyMapImage installed={full} selectedSlot={null} onSelectSlot={vi.fn()} />);

    const fullCortex = screen.getByRole("button", { name: "Córtex Frontal — 3/3 ocupados" });
    const focusable = screen
      .getAllByRole("button")
      .filter((b) => b.getAttribute("tabindex") !== "-1");
    expect(focusable).toHaveLength(9); // 10 hit-areas − 1 full slot

    focusable[0].focus();
    const visited: (string | null)[] = [];
    for (let i = 0; i < focusable.length; i++) {
      await user.tab();
      visited.push((document.activeElement as HTMLElement).getAttribute("data-slot"));
    }

    expect(visited).not.toContain("frontal_cortex");
    expect(new Set(visited).size).toBe(8); // 8 non-full slots (arms × 2 dedupe)
  });

  it("should mark the selected slot with aria-pressed and keep color as decoration", () => {
    render(<ChromeBodyMapImage installed={[]} selectedSlot="arms" onSelectSlot={vi.fn()} />);

    expect(screen.getAllByRole("button", { name: /^Braços — / })[0]).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^Ocular — / })).not.toHaveAttribute("aria-pressed");
  });

  it("should disable a full slot: aria-disabled, no click, no keyboard selection, CHEIO badge", () => {
    const onSelectSlot = vi.fn();
    const full = [...LOADOUT, chromeRecord("i4", "Compilador", "frontal_cortex")];
    render(<ChromeBodyMapImage installed={full} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: "Córtex Frontal — 3/3 ocupados" });
    expect(cortex).toHaveAttribute("aria-disabled", "true");
    expect(cortex).toHaveAttribute("tabindex", "-1");
    // Text channel for "full" — never color alone.
    expect(screen.getByText("CHEIO")).toBeInTheDocument();

    fireEvent.click(cortex);
    fireEvent.keyDown(cortex, { key: "Enter" });
    fireEvent.keyDown(cortex, { key: " " });

    expect(onSelectSlot).not.toHaveBeenCalled();
  });

  it("should not render the CHEIO badge when no slot is full", () => {
    render(<ChromeBodyMapImage installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.queryByText("CHEIO")).not.toBeInTheDocument();
  });

  it("should render the legenda HTML com contagens and implant names (text channel)", () => {
    render(<ChromeBodyMapImage installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getByText("2/3 — Cuca Acesa, Mnemônica")).toBeInTheDocument();
    expect(screen.getAllByText("0/2 — vazio")).toHaveLength(2); // ocular + skeleton
  });
});
