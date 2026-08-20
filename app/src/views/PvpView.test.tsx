import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PvpView from "@/views/PvpView";
import type { PvpAttackableResponse, PvpCombatRecord, PvpHistoryResponse } from "@neon-dusk/shared";

const mocks = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
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

const attackable: PvpAttackableResponse = {
  targets: [
    {
      characterId: "c2",
      name: "Raven",
      streetCred: 12,
      power: 8,
      noobShield: true,
      weeklyAttacksReceived: 0,
    },
  ],
};

const combat: PvpCombatRecord = {
  id: "pc1",
  attackerName: "Ghost",
  defenderName: "Raven",
  attackerPower: 10,
  defenderPower: 8,
  winnerId: "c1",
  won: true,
  lootAmount: 120,
  grieferPenalty: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const history: PvpHistoryResponse = {
  combats: [combat],
  nextCursor: null,
};

describe("PvpView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
  });

  it("should show a loading state while targets are being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    render(<PvpView />);

    expect(screen.getAllByText("▌ loading...").length).toBeGreaterThan(0);
  });

  it("should render attackable targets and the history tab", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/pvp/attackable") return Promise.resolve(attackable);
      if (url === "/api/pvp/history") return Promise.resolve(history);
      return Promise.resolve({});
    });
    const user = userEvent.setup();

    render(<PvpView />);

    expect(await screen.findByText("Raven")).toBeInTheDocument();
    expect(screen.getByText("Escudo de iniciante ativo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atacar" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Histórico" }));

    expect(await screen.findByText("VITÓRIA")).toBeInTheDocument();
    expect(screen.getByText("G$ 120")).toBeInTheDocument();
    expect(mocks.api.get).toHaveBeenCalledWith("/api/pvp/attackable");
    expect(mocks.api.get).toHaveBeenCalledWith("/api/pvp/history");
  });

  it("should show an error state when the targets fetch fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("Falha ao carregar alvos"));

    render(<PvpView />);

    expect(await screen.findByText("Falha ao carregar alvos")).toBeInTheDocument();
  });

  it("should surface the attack result message", async () => {
    mocks.api.get.mockResolvedValue(attackable);
    mocks.api.post.mockResolvedValue({ won: true, lootAmount: 120 });
    const user = userEvent.setup();

    render(<PvpView />);

    await user.click(await screen.findByRole("button", { name: "Atacar" }));

    expect(await screen.findByText("Vitória! +G$ 120")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/pvp/attack", {
      targetId: "c2",
    });
  });

  it("should surface attack error from the API", async () => {
    mocks.api.get.mockResolvedValue(attackable);
    mocks.api.post.mockRejectedValue(new Error("Ação em cooldown. Aguarde."));
    const user = userEvent.setup();

    render(<PvpView />);

    await user.click(await screen.findByRole("button", { name: "Atacar" }));

    expect(await screen.findByText("Ação em cooldown. Aguarde.")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/pvp/attack", {
      targetId: "c2",
    });
  });

  it("should re-fetch and render targets after unmount and remount", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/pvp/attackable") return Promise.resolve(attackable);
      if (url === "/api/pvp/history") return Promise.resolve(history);
      return Promise.resolve({});
    });

    const { unmount } = render(<PvpView />);
    expect(await screen.findByText("Raven")).toBeInTheDocument();

    unmount();
    render(<PvpView />);

    // Remount re-runs the effect — targets must render again, not stay stuck
    // in loading, and both fetches must have been re-executed.
    expect(await screen.findByText("Raven")).toBeInTheDocument();
    expect(screen.queryByText("▌ loading...")).not.toBeInTheDocument();
    const attackableCalls = mocks.api.get.mock.calls.filter(
      ([url]) => url === "/api/pvp/attackable",
    );
    expect(attackableCalls).toHaveLength(2);
  });

  it("should not stay stuck in loading after StrictMode remount", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/pvp/attackable") return Promise.resolve(attackable);
      if (url === "/api/pvp/history") return Promise.resolve(history);
      return Promise.resolve({});
    });

    // StrictMode runs the effect twice on the SAME instance (mount → cleanup →
    // mount). Without the #191 fix (mountedRef.current = true at effect start),
    // the second run's fetches resolve against mountedRef=false and the screen
    // stays in loading forever.
    render(
      <StrictMode>
        <PvpView />
      </StrictMode>,
    );

    expect(await screen.findByText("Raven")).toBeInTheDocument();
    expect(screen.queryByText("▌ loading...")).not.toBeInTheDocument();
  });
});
