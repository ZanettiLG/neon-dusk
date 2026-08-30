import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { create } from "zustand";
import { MemoryRouter } from "react-router-dom";
import EconomyTab from "@/views/admin/EconomyTab";
import type { AdminEconomy } from "@neon-dusk/shared";

// Mock the admin store as a controllable Zustand singleton (same pattern as
// SaideiraView.test.tsx): components subscribe to state we set per test, and
// the fetch actions are no-ops so there are no async races between the mount
// effect and render assertions.
const storeMocks = vi.hoisted(() => {
  const initial = {
    economy: null as AdminEconomy | null,
    economyLoading: false,
    economyError: null as string | null,
    fetchEconomy: vi.fn(),
  };
  return { initial };
});

vi.mock("@/stores/admin", () => ({
  useAdminStore: create(() => ({ ...storeMocks.initial })),
}));

const { useAdminStore } = await import("@/stores/admin");

function economy(overrides: Partial<AdminEconomy>): AdminEconomy {
  return {
    eddiesInCirculation: 12345,
    inflation: 0.03,
    faucetsTotal: 700,
    sinksTotal: 200,
    topFaucets24h: [{ source: "GIG_PAYOUT", amount: 600 }],
    topSinks24h: [{ source: "VENDOR_PURCHASE", amount: 200 }],
    dailyActiveCharacters: 42,
    transactions24h: 123,
    hourlyBreakdown24h: [],
    ...overrides,
  };
}

function renderView() {
  return render(
    <MemoryRouter>
      <EconomyTab />
    </MemoryRouter>,
  );
}

describe("EconomyTab", () => {
  beforeEach(() => {
    useAdminStore.setState({ ...storeMocks.initial });
    vi.clearAllMocks();
  });

  it("should render the big-number cards including inflation and round totals", () => {
    useAdminStore.setState({ economy: economy({}) });

    renderView();

    expect(screen.getByText("Grana em Circulação")).toBeInTheDocument();
    expect(screen.getByText("G$ 12.345")).toBeInTheDocument();
    // ND-052: round inflation + faucet/sink totals.
    expect(screen.getByText("Inflação (rodada)")).toBeInTheDocument();
    expect(screen.getByText("3,0%")).toBeInTheDocument();
    expect(screen.getByText("Faucets (rodada)")).toBeInTheDocument();
    expect(screen.getByText("G$ 700")).toBeInTheDocument();
    expect(screen.getByText("Sinks (rodada)")).toBeInTheDocument();
    expect(screen.getByText("G$ 200")).toBeInTheDocument();
    expect(screen.getByText("Ativos (24h)")).toBeInTheDocument();
    expect(screen.getByText("Transações (24h)")).toBeInTheDocument();
    expect(screen.getByText("Top Faucet")).toBeInTheDocument();
  });

  it.each([
    { inflation: 0.03, badge: "estável", color: "text-nd-green" },
    { inflation: 0.1, badge: "atenção", color: "text-nd-gold" },
    { inflation: 0.2, badge: "risco", color: "text-nd-magenta" },
  ])("should show a $color badge for $inflation inflation", ({ inflation, badge, color }) => {
    useAdminStore.setState({ economy: economy({ inflation }) });

    renderView();

    const badgeEl = screen.getByText(badge);
    expect(badgeEl).toBeInTheDocument();
    expect(badgeEl.className).toContain(color);
  });

  it("should show the store error when the economy fails to load", () => {
    useAdminStore.setState({ economyError: "Falha ao carregar economia" });

    renderView();

    expect(screen.getByText("Falha ao carregar economia")).toBeInTheDocument();
  });
});
