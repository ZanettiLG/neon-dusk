import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import type { GigListItem } from "@neon-dusk/shared";
import GigBoardView from "@/views/GigBoardView";

// Mock the stores as controllable Zustand singletons (same pattern as
// SaideiraView.test.tsx / Leaderboard.test.tsx): the board state is set per
// test and fetchBoard is a no-op so the mount effect never races the render
// assertions. GigCard reads useAuthStore for the requirement chips, so the
// auth store is mocked with a stable character too.
const storeMocks = vi.hoisted(() => {
  const initial = {
    board: null as {
      gigs: GigListItem[];
      activeGig: null;
    } | null,
    boardLoading: false,
    boardError: null as string | null,
    actionLoading: false,
    actionError: null as string | null,
    lastWrapup: null,
    fetchBoard: vi.fn(),
    acceptGig: vi.fn(),
    doLegwork: vi.fn(),
    executeGig: vi.fn(),
    escapeGig: vi.fn(),
    wrapUpGig: vi.fn(),
    abandonGig: vi.fn(),
    fetchHistory: vi.fn(),
  };
  return { initial };
});

vi.mock("@/stores/gig", () => ({
  useGigStore: create(() => ({ ...storeMocks.initial })),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: create(() => ({
    character: null,
    accessToken: null,
  })),
}));

const { useGigStore } = await import("@/stores/gig");

/** One board row fixture (delivery T1 by default — overrides for the rest). */
function gigItem(overrides: Partial<GigListItem> = {}): GigListItem {
  return {
    id: "g-1",
    name: "Corre da Farmácia",
    tier: "t1",
    type: "delivery",
    district: "Babilônia",
    difficulty: 14,
    baseReward: 500,
    nilCost: 10,
    requiredStats: {},
    meetsRequirements: true,
    cooldownRemaining: 0,
    successChance: 0.5,
    heatGenerated: 5,
    ...overrides,
  };
}

function boardWith(gigs: GigListItem[]) {
  useGigStore.setState({ board: { gigs: gigs, activeGig: null }, lastWrapup: null });
}

function renderView() {
  return render(<GigBoardView />);
}

describe("GigBoardView", () => {
  beforeEach(() => {
    useGigStore.setState({ ...storeMocks.initial });
    vi.clearAllMocks();
  });

  it("renders the filter tabs with role=tab and the active one aria-selected", async () => {
    boardWith([gigItem()]);
    renderView();

    // Tier filter: "Todos" is active by default; the 5 tier tabs exist.
    const todos = screen.getByRole("tab", { name: "Todos" });
    expect(todos).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "T1" })).toHaveAttribute("aria-selected", "false");
    for (const tier of ["T2", "T3", "T4", "T5"]) {
      expect(screen.getByRole("tab", { name: tier })).toBeInTheDocument();
    }

    // Type filter: "Todos tipos" active, plus one tab per trampo type.
    expect(screen.getByRole("tab", { name: "Todos tipos" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    for (const type of ["Extração", "Entrega", "Sabotagem"]) {
      expect(screen.getByRole("tab", { name: type })).toBeInTheDocument();
    }

    // Clicking T2 flips aria-selected between the tabs.
    await userEvent.setup().click(screen.getByRole("tab", { name: "T2" }));
    expect(screen.getByRole("tab", { name: "T2" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "false");
  });

  it("filters the board by tier (T2 → 1 card, Todos → 2)", async () => {
    boardWith([
      gigItem({ id: "g-1", name: "Corre da Farmácia", tier: "t1" }),
      gigItem({ id: "g-2", name: "Linha Vermelha", tier: "t2", difficulty: 65, nilCost: 20 }),
    ]);
    renderView();

    expect(screen.getAllByRole("article")).toHaveLength(2);

    await userEvent.setup().click(screen.getByRole("tab", { name: "T2" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Linha Vermelha")).toBeInTheDocument();
    expect(screen.queryByText("Corre da Farmácia")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Todos" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("filters the board by type (Sabotagem → 1 card, Todos tipos → 2)", async () => {
    boardWith([
      gigItem({ id: "g-1", name: "Corre da Farmácia", type: "delivery" }),
      gigItem({ id: "g-3", name: "Sucata Premiada", type: "sabotage", difficulty: 20 }),
    ]);
    renderView();

    expect(screen.getAllByRole("article")).toHaveLength(2);

    await userEvent.setup().click(screen.getByRole("tab", { name: "Sabotagem" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("Sucata Premiada")).toBeInTheDocument();
    expect(screen.queryByText("Corre da Farmácia")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("tab", { name: "Todos tipos" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
  });

  it("shows the empty-filter message when no trampo matches", async () => {
    boardWith([gigItem({ id: "g-2", name: "Linha Vermelha", tier: "t2" })]);
    renderView();

    await userEvent.setup().click(screen.getByRole("tab", { name: "T1" }));
    expect(screen.getByText(/Nenhum trampo com esse filtro/)).toBeInTheDocument();
  });
});
