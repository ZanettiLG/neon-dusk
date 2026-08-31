import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import RoundResetOverlay from "@/components/shell/RoundResetOverlay";
import { useAuthStore } from "@/stores/auth";
import type { RoundHistoryResponse, RoundInfoResponse } from "@neon-dusk/shared";

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

const activeRound: RoundInfoResponse = {
  roundNumber: 3,
  startedAt: "2026-08-30T00:00:00.000Z",
  endsAt: "2026-09-13T00:00:00.000Z",
  timeRemainingSeconds: 86400,
  status: "active",
  intermissionUntil: null,
};

const intermissionRound: RoundInfoResponse = {
  roundNumber: 3,
  startedAt: "2026-09-13T00:00:00.000Z",
  endsAt: "2026-09-27T00:00:00.000Z",
  timeRemainingSeconds: 0,
  status: "intermission",
  intermissionUntil: new Date(Date.now() + 5 * 60_000).toISOString(),
};

const history: RoundHistoryResponse = {
  rounds: [
    {
      roundNumber: 2,
      startedAt: "2026-08-16T00:00:00.000Z",
      endedAt: "2026-08-30T00:00:00.000Z",
      stats: {
        totalGigsCompleted: 42,
        totalEddiesEarned: 12345,
        totalPvpFights: 17,
        totalActiveCharacters: 88,
        topCrewName: null,
        topScCharacterName: "Raven",
        topScValue: 100,
      },
    },
  ],
  nextCursor: null,
};

function seedAuth() {
  useAuthStore.setState({ accessToken: "token", refreshToken: "refresh" });
}

async function flushAsync() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe("RoundResetOverlay", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    seedAuth();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing while the round is active", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/round") return Promise.resolve(activeRound);
      return Promise.resolve(history);
    });

    render(<RoundResetOverlay />);
    await flushAsync();

    expect(screen.queryByText("APAGÃO")).not.toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/round");
  });

  it("shows the blackout during intermission with the countdown and round stats", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/round") return Promise.resolve(intermissionRound);
      return Promise.resolve(history);
    });

    render(<RoundResetOverlay />);

    expect(await screen.findByText("APAGÃO")).toBeInTheDocument();
    expect(screen.getByText("RODADA 3 ENCERRADA")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/round/history?limit=1");

    expect(screen.getByText("Trampos completos: 42")).toBeInTheDocument();
    expect(screen.getByText("Grana gerada: G$ 12.345")).toBeInTheDocument();
    expect(screen.getByText("Lutas PvP: 17")).toBeInTheDocument();
    expect(screen.getByText("Corredores ativos: 88")).toBeInTheDocument();
    expect(screen.getByText("Lenda da rodada: Raven")).toBeInTheDocument();
    expect(screen.getByText(/As Lendas sobrevivem/)).toBeInTheDocument();
    expect(screen.getByText(/5:00|4:5\d/)).toBeInTheDocument();
  });

  it("persists the dismiss and stays hidden for the same round", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/round") return Promise.resolve(intermissionRound);
      return Promise.resolve(history);
    });
    const user = userEvent.setup();

    const { unmount } = render(<RoundResetOverlay />);
    expect(await screen.findByText("APAGÃO")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /FECHAR/i }));
    expect(localStorage.getItem("nd:round-dismissed")).toBe("3");
    expect(screen.queryByText("APAGÃO")).not.toBeInTheDocument();

    // A remount with the same round must not re-show the blackout.
    unmount();
    render(<RoundResetOverlay />);
    await flushAsync();
    expect(screen.queryByText("APAGÃO")).not.toBeInTheDocument();
  });

  it("auto-dismisses when the round returns to active on the next poll", async () => {
    vi.useFakeTimers();
    let roundCalls = 0;
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/round") {
        roundCalls++;
        return Promise.resolve(roundCalls === 1 ? intermissionRound : activeRound);
      }
      return Promise.resolve(history);
    });

    render(<RoundResetOverlay />);
    await flushAsync();
    expect(screen.getByText("APAGÃO")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText("APAGÃO")).not.toBeInTheDocument();
  });

  it("stays hidden when the round fetch fails (best-effort)", async () => {
    mocks.api.get.mockRejectedValue(new Error("api down"));

    render(<RoundResetOverlay />);
    await flushAsync();

    expect(screen.queryByText("APAGÃO")).not.toBeInTheDocument();
  });
});
