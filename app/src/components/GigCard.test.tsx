import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { create } from "zustand";
import GigCard from "@/components/GigCard";
import type { GigListItem } from "@neon-dusk/shared";

vi.mock("@/stores/auth", () => ({
  useAuthStore: create(() => ({ character: null })),
}));

/** A board trampo with the fields GigCard renders (issue #140). */
function trampo(overrides: Partial<GigListItem> = {}): GigListItem {
  return {
    id: "g-1",
    name: "Corre da Farmácia",
    tier: "t1",
    type: "delivery",
    district: "Paraíso",
    difficulty: 14,
    baseReward: 500,
    nilCost: 100,
    requiredStats: {},
    meetsRequirements: true,
    cooldownRemaining: 0,
    successChance: 0.65,
    heatGenerated: 5,
    ...overrides,
  };
}

describe("GigCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should show CHANCE before accept: badge + textual label (color is not the only channel)", () => {
    render(<GigCard trampo={trampo({ successChance: 0.65 })} disabled={false} onAccept={vi.fn()} />);
    // Textual label — never color alone.
    expect(screen.getByText(/chance 65% · média/i)).toBeInTheDocument();
    expect(screen.getByText("Chance")).toBeInTheDocument();
  });

  it("should show RISCO: Calor +N and the 'dobra se falhar' note", () => {
    render(<GigCard trampo={trampo({ heatGenerated: 5 })} disabled={false} onAccept={vi.fn()} />);
    expect(screen.getByText(/calor \+5/i)).toBeInTheDocument();
    expect(screen.getByText(/dobra se falhar/i)).toBeInTheDocument();
  });

  it("should show RECOMPENSA: G$ reward and the multiplier note", () => {
    render(<GigCard trampo={trampo({ baseReward: 500 })} disabled={false} onAccept={vi.fn()} />);
    expect(screen.getByText(/G\$ 500/i)).toBeInTheDocument();
    expect(screen.getByText(/×1\.32 máx/i)).toBeInTheDocument();
  });

  it("should show CUSTO NIL", () => {
    render(<GigCard trampo={trampo({ nilCost: 100 })} disabled={false} onAccept={vi.fn()} />);
    expect(screen.getByText("Custo NIL")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("should color the chance badge by band: baixa → magenta, média → gold, alta → green", () => {
    const { rerender } = render(
      <GigCard trampo={trampo({ successChance: 0.2 })} disabled={false} onAccept={vi.fn()} />,
    );
    // baixa (0–39) → magenta
    expect(screen.getByText(/chance 20% · baixa/i)).toHaveClass("text-nd-magenta");

    rerender(<GigCard trampo={trampo({ successChance: 0.5 })} disabled={false} onAccept={vi.fn()} />);
    // média (40–69) → gold
    expect(screen.getByText(/chance 50% · média/i)).toHaveClass("text-nd-gold");

    rerender(<GigCard trampo={trampo({ successChance: 0.9 })} disabled={false} onAccept={vi.fn()} />);
    // alta (70–100) → green
    expect(screen.getByText(/chance 90% · alta/i)).toHaveClass("text-nd-green");
  });

  it("should call onAccept with the trampo id when Aceitar is clicked", () => {
    const onAccept = vi.fn();
    render(<GigCard trampo={trampo()} disabled={false} onAccept={onAccept} />);
    screen.getByRole("button", { name: /aceitar/i }).click();
    expect(onAccept).toHaveBeenCalledWith("g-1");
  });
});
