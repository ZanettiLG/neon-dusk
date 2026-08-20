import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import TimerAlerts from "@/components/shell/TimerAlerts";
import { useAuthStore } from "@/stores/auth";
import { useGigStore } from "@/stores/gig";
import { useSaideiraStore } from "@/stores/saideira";
import type { Character } from "@neon-dusk/shared";

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "bicho",
  body: 3,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 20,
  maxStreetCredAchieved: 20,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  ApiError: class extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  },
}));

function legworkGig() {
  return {
    id: "ag-1",
    gigId: "g-1",
    gigName: "Corre da Farmácia",
    gigType: "delivery",
    gigTier: "t1",
    phase: "legwork",
    status: "active",
    acceptedAt: "2026-01-01T00:00:00Z",
    legworkStartedAt: new Date(Date.now() - 60_000).toISOString(),
    legworkCompleted: false,
    legworkMinutes: 5,
    executeOutcome: null,
    escapeOutcome: null,
    actualPayout: null,
    escapeDifficulty: 0.5,
  };
}

describe("TimerAlerts", () => {
  beforeEach(() => {
    useAuthStore.setState({ character });
    useGigStore.setState(useGigStore.getInitialState());
    useSaideiraStore.setState(useSaideiraStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.get.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prioritizes the legwork countdown over the round", () => {
    useGigStore.setState({ board: { gigs: [], activeGig: legworkGig() } });
    useSaideiraStore.setState({
      hub: {
        onlineCount: 3,
        lastReset: null,
        currentRound: 2,
        roundEndsAt: new Date(Date.now() + 90_000_000).toISOString(),
      },
    });

    render(<TimerAlerts />);

    // Stable label and ticking countdown are separate nodes.
    expect(screen.getByText(/TRAMPO ATIVO · legwork$/)).toBeInTheDocument();
    expect(screen.getByText(/4:0\d/)).toBeInTheDocument();
    expect(screen.queryByText(/ROUND termina/)).not.toBeInTheDocument();
  });

  it("shows the round countdown when no trampo is in legwork", () => {
    useSaideiraStore.setState({
      hub: {
        onlineCount: 3,
        lastReset: null,
        currentRound: 2,
        roundEndsAt: new Date(Date.now() + 90_000_000).toISOString(),
      },
    });

    render(<TimerAlerts />);

    expect(screen.getByText(/ROUND termina em$/)).toBeInTheDocument();
    expect(screen.getByText(/1d 1h/)).toBeInTheDocument();
  });

  it("shows the ready ability when no trampo and no round data", async () => {
    useAuthStore.setState({
      character: {
        ...character,
        ability: {
          abilityType: "combat_trance",
          isActive: false,
          activeUntil: null,
          cooldownUntil: new Date(Date.now() - 60_000).toISOString(),
          cooldownRemainingMs: 0,
        },
      },
    });

    render(<TimerAlerts />);

    // Board/hub are lazily fetched (both settle to undefined via the mock).
    await waitFor(() => {
      expect(mocks.api.get).toHaveBeenCalledWith("/api/gigs");
      expect(mocks.api.get).toHaveBeenCalledWith("/api/saideira");
    });
    expect(screen.getByText(/Combat Trance pronta/)).toBeInTheDocument();
  });

  it("renders nothing when there is no timer to show", async () => {
    render(<TimerAlerts />);

    await waitFor(() => {
      expect(mocks.api.get).toHaveBeenCalled();
    });
    expect(screen.queryByText(/TRAMPO ATIVO/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ROUND termina/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pronta/)).not.toBeInTheDocument();
  });

  it("does not show the ability as ready while its cooldown is active", async () => {
    useAuthStore.setState({
      character: {
        ...character,
        ability: {
          abilityType: "combat_trance",
          isActive: false,
          activeUntil: null,
          cooldownUntil: new Date(Date.now() + 60_000).toISOString(),
          cooldownRemainingMs: 60_000,
        },
      },
    });

    render(<TimerAlerts />);

    await waitFor(() => {
      expect(mocks.api.get).toHaveBeenCalled();
    });
    expect(screen.queryByText(/pronta/)).not.toBeInTheDocument();
  });

  it("skips the legwork alert once the trampo legwork is completed", () => {
    useGigStore.setState({
      board: { gigs: [], activeGig: { ...legworkGig(), legworkCompleted: true } },
    });
    useSaideiraStore.setState({
      hub: {
        onlineCount: 3,
        lastReset: null,
        currentRound: 2,
        roundEndsAt: new Date(Date.now() + 90_000_000).toISOString(),
      },
    });

    render(<TimerAlerts />);

    // Falls through to the round alert instead of the legwork countdown.
    expect(screen.queryByText(/TRAMPO ATIVO/)).not.toBeInTheDocument();
    expect(screen.getByText(/ROUND termina em$/)).toBeInTheDocument();
    expect(screen.getByText(/1d 1h/)).toBeInTheDocument();
  });

  it("keeps the aria-live region on the stable label while the countdown ticks", async () => {
    vi.useFakeTimers();
    useGigStore.setState({ board: { gigs: [], activeGig: legworkGig() } });

    const { container } = render(<TimerAlerts />);

    // The live region contains only the alert label — the ticking countdown is
    // a sibling node, so 1s ticks never reach the screen-reader queue.
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion?.textContent).toBe("TRAMPO ATIVO · legwork");

    const before = screen.getByText(/4:0\d/).textContent;
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    // Countdown moved (4:00 → 3:57) while the announced label stayed put.
    expect(screen.getByText(/3:5\d/).textContent).not.toBe(before);
    expect(liveRegion?.textContent).toBe("TRAMPO ATIVO · legwork");
  });

  it("shows the ready ability alert when the cooldown expires without navigation", async () => {
    vi.useFakeTimers();
    useAuthStore.setState({
      character: {
        ...character,
        ability: {
          abilityType: "combat_trance",
          isActive: false,
          activeUntil: null,
          cooldownUntil: new Date(Date.now() + 60_000).toISOString(),
          cooldownRemainingMs: 60_000,
        },
      },
    });

    render(<TimerAlerts />);

    expect(screen.queryByText(/pronta/)).not.toBeInTheDocument();

    // Only the cooldown timer is running (no trampo, no round) — the banner
    // must flip by itself when it expires, with no navigation involved.
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });

    expect(screen.getByText(/Combat Trance pronta/)).toBeInTheDocument();
    // The cooldown clock stopped once it hit zero.
    expect(vi.getTimerCount()).toBe(0);
  });
});
