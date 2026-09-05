import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChromeBodyMapImage from "@/components/chrome/ChromeBodyMapImage";
import { SLOT_LABEL_POS } from "@/lib/chrome-body-map";
import type { ChromeSlot, InstalledChromeRecord } from "@neon-dusk/shared";

// Issue #188 — labels-only body map: 9 label buttons flanking the decorative
// figure (SLOT_LABEL_POS), occupancy in aria + status text, keyboard
// preserved (Enter/Space, full slot out of tab order), no hit-areas/pips/
// CHEIO badge/legenda. Geometry anchors are inline style (token guard #53).

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
  it("should render the artwork decoratively and exactly 9 slot labels in pinned order", () => {
    const renderResult = render(
      <ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />,
    );

    // alt="" + aria-hidden → the artwork is presentational (no img role);
    // all information lives in the label buttons.
    const img = renderResult.container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("aria-hidden", "true");
    expect(img!.getAttribute("src")).toMatch(/body-map/);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(9);
    // DOM order = SLOT_LABEL_POS order: frontal_cortex first, legs last.
    expect(buttons.map((b) => b.getAttribute("data-slot"))).toEqual(
      SLOT_LABEL_POS.map((p) => p.slot),
    );
  });

  it("should position labels by column + pinned y anchor, not as boxes over the body", () => {
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />);

    const cortex = screen.getByRole("button", { name: /^Córtex Frontal:/ });
    expect(cortex.style.top).toBe("21%");
    expect(cortex.className).toContain("lg:left-0");

    const legs = screen.getByRole("button", { name: /^Pernas:/ });
    expect(legs.style.top).toBe("72%");
    expect(legs.className).toContain("lg:right-0");

    // Labels are not percentage boxes over the figure (the #94 hit-area
    // geometry is gone): no inline width/height, no resolveSlot arbitration.
    for (const button of screen.getAllByRole("button")) {
      expect(button.style.width).toBe("");
      expect(button.style.height).toBe("");
    }
  });

  it("should announce occupancy in each label's aria-label", () => {
    render(<ChromeBodyMapImage installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Córtex Frontal: 2/3 ocupados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Braços: 1/2 ocupados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ocular: 0/2 ocupados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pernas: 0/1 ocupados" })).toBeInTheDocument();
  });

  it("should show name + occupancy status, with CHEIO only on full slots", () => {
    render(<ChromeBodyMapImage installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />);

    expect(screen.getByText("Córtex Frontal")).toBeInTheDocument();
    expect(screen.getByText("2/3")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.queryByText(/CHEIO/)).not.toBeInTheDocument();
  });

  it("should keep the group a11y contract and drop the legenda/pips markers", () => {
    const { container } = render(
      <ChromeBodyMapImage installed={LOADOUT} selectedSlot={null} onSelectSlot={vi.fn()} />,
    );

    expect(screen.getByRole("group", { name: "Mapa corporal de cromo" })).toBeInTheDocument();
    // Deletions from the #188 design: no <dl> legenda, no pointer-events-none
    // pip/badge markers over the artwork.
    expect(container.querySelector("dl")).toBeNull();
  });

  it("should select a slot on click", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    fireEvent.click(screen.getByRole("button", { name: /^Braços:/ }));

    expect(onSelectSlot).toHaveBeenCalledWith("arms");
  });

  it("should select a slot with Enter and Space (preventDefault, no double-fire)", () => {
    const onSelectSlot = vi.fn();
    render(<ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: /^Córtex Frontal:/ });
    // fireEvent resolves to !defaultPrevented — false proves preventDefault ran.
    expect(fireEvent.keyDown(cortex, { key: "Enter" })).toBe(false);
    expect(onSelectSlot).toHaveBeenCalledWith("frontal_cortex");

    const ocular = screen.getByRole("button", { name: /^Ocular:/ });
    expect(fireEvent.keyDown(ocular, { key: " " })).toBe(false);
    expect(onSelectSlot).toHaveBeenCalledWith("ocular");
  });

  it("should mark the selected slot with aria-pressed", () => {
    render(<ChromeBodyMapImage installed={[]} selectedSlot="arms" onSelectSlot={vi.fn()} />);

    expect(screen.getByRole("button", { name: /^Braços:/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /^Ocular:/ })).not.toHaveAttribute("aria-pressed");
  });

  it("should disable a full slot: tabIndex −1, aria-disabled, guard on click/keys, CHEIO status", async () => {
    const user = userEvent.setup();
    const onSelectSlot = vi.fn();
    const full = [...LOADOUT, chromeRecord("i4", "Compilador", "frontal_cortex")];
    render(<ChromeBodyMapImage installed={full} selectedSlot={null} onSelectSlot={onSelectSlot} />);

    const cortex = screen.getByRole("button", { name: "Córtex Frontal: 3/3 ocupados" });
    expect(cortex).toHaveAttribute("tabindex", "-1");
    expect(cortex).toHaveAttribute("aria-disabled", "true");
    // Redundant text channel for "full" — the label status, never color alone.
    expect(cortex).toHaveTextContent("3/3 · CHEIO");

    fireEvent.click(cortex);
    fireEvent.keyDown(cortex, { key: "Enter" });
    fireEvent.keyDown(cortex, { key: " " });
    expect(onSelectSlot).not.toHaveBeenCalled();

    // Full slot is out of the tab order; the other 8 slots remain tabbable.
    expect(
      screen
        .getAllByRole("button")
        .filter((b) => b.getAttribute("tabindex") !== "-1"),
    ).toHaveLength(8);
    await user.tab();
    expect(document.activeElement).not.toBe(cortex);
  });

  it("should apply the pinned label states: default cyan/70, selected gold+pulse, full magenta/60", () => {
    const full = [...LOADOUT, chromeRecord("i4", "Compilador", "frontal_cortex")];
    render(<ChromeBodyMapImage installed={full} selectedSlot="arms" onSelectSlot={vi.fn()} />);

    // Default: cyan/70 + hover cyan + pointer.
    const ocular = screen.getByRole("button", { name: /^Ocular:/ });
    expect(ocular.className).toContain("text-nd-cyan/70");
    expect(ocular.className).toContain("hover:text-nd-cyan");
    expect(ocular.className).toContain("cursor-pointer");

    // Selected: gold + pulse.
    const arms = screen.getByRole("button", { name: /^Braços:/ });
    expect(arms.className).toContain("text-nd-gold");
    expect(arms.className).toContain("animate-pulse-neon");

    // Full: magenta/60 + cursor-not-allowed.
    const cortex = screen.getByRole("button", { name: "Córtex Frontal: 3/3 ocupados" });
    expect(cortex.className).toContain("text-nd-magenta/60");
    expect(cortex.className).toContain("cursor-not-allowed");
  });

  it("should keep a single DOM for mobile: 2-column grid under the figure via lg:contents", () => {
    const { container } = render(
      <ChromeBodyMapImage installed={[]} selectedSlot={null} onSelectSlot={vi.fn()} />,
    );

    // The label wrapper is the mobile grid (2 columns) that vanishes on
    // desktop (lg:contents) — one DOM, no duplicate labels per breakpoint.
    const wrapper = container.querySelector("div.grid");
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain("grid-cols-2");
    expect(wrapper!.className).toContain("lg:contents");

    // Mobile layout: figure on top, labels below (DOM order = flex-col order).
    const img = container.querySelector("img")!;
    expect(img.compareDocumentPosition(wrapper!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
