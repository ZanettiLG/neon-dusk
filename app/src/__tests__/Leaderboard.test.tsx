import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { create } from "zustand";
import Leaderboard from "@/components/Leaderboard";
import type { LeaderboardEntry } from "@neon-dusk/shared";

// Mock the stores as controllable Zustand singletons: components subscribe to
// state we set per test, and the fetch actions are no-ops (no async races
// between the mount effect and render assertions).
const storeMocks = vi.hoisted(() => {
  const initial = {
    info: null,
    loading: false,
    error: null as string | null,
    leaderboard: null as LeaderboardEntry[] | null,
    leaderboardLoading: false,
    leaderboardError: null as string | null,
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

const entries: LeaderboardEntry[] = [
  { position: 1, characterName: "Ghost", crewName: null, score: 80, title: "Elite" },
  { position: 2, characterName: "Rex", crewName: null, score: 50, title: "Edgerunner" },
  { position: 3, characterName: "Kiro", crewName: null, score: 10, title: "Pro" },
];

describe("Leaderboard", () => {
  beforeEach(() => {
    useStreetCredStore.setState({ ...storeMocks.initial });
    useAuthStore.setState({ character: null });
    vi.clearAllMocks();
  });

  it("should render the leaderboard table with entries", () => {
    useStreetCredStore.setState({ leaderboard: entries, leaderboardLoading: false, leaderboardError: null });

    render(<Leaderboard />);

    expect(screen.getByText("RANKING // STREET CRED")).toBeInTheDocument();
    expect(screen.getByText("TOP 20")).toBeInTheDocument();

    // Table headers.
    expect(screen.getByText("#")).toBeInTheDocument();
    expect(screen.getByText("Runner")).toBeInTheDocument();
    expect(screen.getByText("Título")).toBeInTheDocument();
    expect(screen.getByText("SC")).toBeInTheDocument();

    // Entries: position, name, title badge and score.
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    expect(screen.getByText("Rex")).toBeInTheDocument();
    expect(screen.getByText("Kiro")).toBeInTheDocument();
    expect(screen.getByText("Elite")).toBeInTheDocument();
    expect(screen.getByText("Edgerunner")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("should show skeleton rows while loading", () => {
    useStreetCredStore.setState({ leaderboard: null, leaderboardLoading: true, leaderboardError: null });

    const { container } = render(<Leaderboard />);

    // 5 skeleton rows.
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons).toHaveLength(5);
    expect(screen.queryByText("Nenhum runner ainda.")).not.toBeInTheDocument();
  });

  it("should show the empty state message when there are no entries", () => {
    useStreetCredStore.setState({ leaderboard: [], leaderboardLoading: false, leaderboardError: null });

    render(<Leaderboard />);

    expect(screen.getByText("Nenhum runner ainda.")).toBeInTheDocument();
  });

  it("should show the error state with a retry button that refetches", async () => {
    useStreetCredStore.setState({
      leaderboard: null,
      leaderboardLoading: false,
      leaderboardError: "Falha ao carregar o ranking",
    });
    const fetchLeaderboard = useStreetCredStore.getState().fetchLeaderboard;

    render(<Leaderboard />);

    expect(screen.getByText("Falha ao carregar o ranking")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Tentar de novo" }));

    expect(fetchLeaderboard).toHaveBeenCalledWith(20);
  });

  it("should highlight the current player's row", () => {
    useAuthStore.setState({ character: { name: "Ghost" } as never });
    useStreetCredStore.setState({ leaderboard: entries, leaderboardLoading: false, leaderboardError: null });

    render(<Leaderboard />);

    expect(screen.getByText("← você")).toBeInTheDocument();
    // The marker renders once, next to the current player's name.
    expect(screen.queryAllByText("← você")).toHaveLength(1);
  });
});
