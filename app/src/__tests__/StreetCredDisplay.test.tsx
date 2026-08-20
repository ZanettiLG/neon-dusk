import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { create } from "zustand";
import StreetCredDisplay from "@/components/StreetCredDisplay";
import type { StreetCredInfo } from "@neon-dusk/shared";

// Mock the stores as controllable Zustand singletons: components subscribe to
// state we set per test, and the fetch actions are no-ops (no async races
// between the mount effect and render assertions).
const storeMocks = vi.hoisted(() => {
  const initial = {
    info: null as StreetCredInfo | null,
    loading: false,
    error: null as string | null,
    leaderboard: null,
    leaderboardLoading: false,
    leaderboardError: null,
    fetchSC: vi.fn(),
    fetchLeaderboard: vi.fn(),
  };
  return { initial };
});

vi.mock("@/stores/street-cred", () => ({
  useStreetCredStore: create(() => ({ ...storeMocks.initial })),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: create(() => ({ character: null })),
}));

const { useStreetCredStore } = await import("@/stores/street-cred");
const { useAuthStore } = await import("@/stores/auth");

function renderDisplay() {
  const { container } = render(<StreetCredDisplay />);
  return { container };
}

describe("StreetCredDisplay", () => {
  beforeEach(() => {
    useStreetCredStore.setState({ ...storeMocks.initial });
    useAuthStore.setState({ character: null });
    vi.clearAllMocks();
  });

  it("should render the score, title and a progress bar toward the next threshold", () => {
    useAuthStore.setState({ character: {} as never });
    useStreetCredStore.setState({
      info: {
        score: 12,
        title: "Perna",
        maxAchieved: 12,
        nextThreshold: { score: 25, title: "Pro" },
        scToNext: 13,
      },
      loading: false,
      error: null,
    });

    const { container } = renderDisplay();

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("PERNA")).toBeInTheDocument();
    expect(screen.getByText("★")).toBeInTheDocument();

    // Progress bar: score 12 sits between the 10 and 25 thresholds.
    const bar = container.querySelector('[style*="width"]');
    expect(bar).not.toBeNull();
    const width = (bar as HTMLElement).style.width;
    const pct = Number.parseFloat(width);
    expect(pct).toBeGreaterThan(0);
    expect(pct).toBeLessThanOrEqual(100);
  });

  it("should show the skeleton while loading (no data yet)", () => {
    useAuthStore.setState({ character: {} as never });
    useStreetCredStore.setState({ info: null, loading: true, error: null });

    const { container } = renderDisplay();

    expect(container.querySelector('[class*="animate-pulse"]')).not.toBeNull();
    expect(screen.queryByText("LENDA")).not.toBeInTheDocument();
  });

  it("should render the Lenda state in gold without a progress bar at score 100", () => {
    useAuthStore.setState({ character: {} as never });
    useStreetCredStore.setState({
      info: {
        score: 100,
        title: "Lenda",
        maxAchieved: 100,
        nextThreshold: null,
        scToNext: null,
      },
      loading: false,
      error: null,
    });

    const { container } = renderDisplay();

    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("LENDA")).toBeInTheDocument();
    // No progress bar in the lenda badge.
    expect(container.querySelector('[style*="width"]')).toBeNull();
  });

  it("should render the Lenda de SP tier with a progress bar toward Lenda", () => {
    useAuthStore.setState({ character: {} as never });
    useStreetCredStore.setState({
      info: {
        score: 95,
        title: "Lenda de SP",
        maxAchieved: 95,
        nextThreshold: { score: 100, title: "Lenda" },
        scToNext: 5,
      },
      loading: false,
      error: null,
    });

    const { container } = renderDisplay();

    expect(screen.getByText("95")).toBeInTheDocument();
    expect(screen.getByText("LENDA DE SP")).toBeInTheDocument();
    // Progress bar spans the 90→100 band (not 75→100) — mirror ladder must
    // include the 90 threshold.
    const bar = container.querySelector('[style*="width"]');
    expect(bar).not.toBeNull();
    const pct = Number.parseFloat((bar as HTMLElement).style.width);
    expect(pct).toBe(50);
  });

  it("should hide entirely when the fetch errored", () => {
    useAuthStore.setState({ character: {} as never });
    useStreetCredStore.setState({ info: null, loading: false, error: "Falha ao carregar Moral" });

    const { container } = renderDisplay();

    expect(screen.queryByText("LENDA")).not.toBeInTheDocument();
    expect(screen.queryByText("PERNA")).not.toBeInTheDocument();
    expect(screen.queryByText("12")).not.toBeInTheDocument();
    // Renders the hidden placeholder div only — no skeleton.
    expect(container.querySelector('[class*="animate-pulse"]')).toBeNull();
    expect(container.firstElementChild).toBeInTheDocument();
  });

  it("should not fetch when the user has no character", () => {
    renderDisplay();

    expect(useStreetCredStore.getState().fetchSC).not.toHaveBeenCalled();
  });
});
