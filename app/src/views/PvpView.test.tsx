import { describe, it, expect, beforeEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PvpView from "@/views/PvpView";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import { useStreetCredStore } from "@/stores/street-cred";
import type {
  Character,
  PvpAttackableResponse,
  PvpCombatRecord,
  PvpCombatResult,
  PvpHistoryResponse,
} from "@neon-dusk/shared";

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

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "bicho",
  body: 6,
  reflexes: 4,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 20,
  maxStreetCredAchieved: 20,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const attackable: PvpAttackableResponse = {
  nilCost: 20,
  cooldownSeconds: 15,
  targets: [
    {
      characterId: "c2",
      name: "Raven",
      streetCred: 12,
      power: 8,
      noobShield: true,
      weeklyAttacksReceived: 0,
      griefRisk: false,
    },
  ],
};

const combatResult: PvpCombatResult = {
  combatId: "pc1",
  won: true,
  attackerPower: 10,
  defenderPower: 8,
  lootAmount: 120,
  streetCredChange: 5,
  newStreetCred: 25,
  newBalance: 1120,
  grieferPenalty: false,
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

function mockGets() {
  mocks.api.get.mockImplementation((url: string) => {
    if (url === "/api/pvp/attackable") return Promise.resolve(attackable);
    if (url === "/api/pvp/history") return Promise.resolve(history);
    return Promise.resolve({});
  });
}

function seedStores() {
  useAuthStore.setState({
    character,
    nilStatus: {
      current: 100,
      max: 100,
      nextTickSeconds: 0,
      regenerating: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  });
  useHudStore.setState({
    balance: 1000,
    escrow: 0,
    humanity: 50,
    statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
  });
  useStreetCredStore.setState({
    info: {
      score: 20,
      title: "Perna",
      maxAchieved: 20,
      nextThreshold: { score: 25, title: "Pro" },
      scToNext: 5,
    },
  });
}

describe("PvpView", () => {
  beforeEach(() => {
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    seedStores();
  });

  it("should show a loading state while targets are being fetched", () => {
    mocks.api.get.mockImplementation(() => new Promise(() => {}));

    render(<PvpView />);

    expect(screen.getAllByText("▌ loading...").length).toBeGreaterThan(0);
  });

  it("should render attackable targets and the history tab", async () => {
    mockGets();
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

  it("should show the griefRisk badge on the target card", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/pvp/attackable")
        return Promise.resolve({
          nilCost: 20,
          cooldownSeconds: 15,
          targets: [
            {
              characterId: "c3",
              name: "Cutter",
              streetCred: 30,
              power: 9,
              noobShield: false,
              weeklyAttacksReceived: 4,
              griefRisk: true,
            },
          ],
        });
      if (url === "/api/pvp/history") return Promise.resolve(history);
      return Promise.resolve({});
    });

    render(<PvpView />);

    expect(await screen.findByText("Risco de grief")).toBeInTheDocument();
  });

  it("should show an error state when the targets fetch fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("Falha ao carregar alvos"));

    render(<PvpView />);

    expect(await screen.findByText("Falha ao carregar alvos")).toBeInTheDocument();
  });

  it("should open the confirm modal with the two cards, cost and risk", async () => {
    mockGets();
    const user = userEvent.setup();

    render(<PvpView />);

    await user.click(await screen.findByRole("button", { name: "Atacar" }));

    expect(screen.getByText("VOCÊ")).toBeInTheDocument();
    expect(screen.getByText("Ghost")).toBeInTheDocument();
    // The target appears both on the list card and on the confirm card.
    expect(screen.getAllByText("Raven").length).toBeGreaterThan(0);
    expect(screen.getByText("Custo: 20 NIL")).toBeInTheDocument();
    // noobShield cuts the target's Moral loss only — the attacker's loot stays 10%.
    expect(screen.getByText(/Risco: -10% do saldo \(~G\$ 100\) · -5% Moral/)).toBeInTheDocument();
  });

  it("should POST the attack on confirm and open the result modal", async () => {
    mockGets();
    mocks.api.post.mockResolvedValue(combatResult);
    const user = userEvent.setup();

    render(<PvpView />);

    await user.click(await screen.findByRole("button", { name: "Atacar" }));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR ATAQUE/i }));

    expect(await screen.findByText("VITÓRIA")).toBeInTheDocument();
    expect(screen.getByText("Poder: 10 vs 8")).toBeInTheDocument();
    expect(screen.getByText("Saque: G$ 120")).toBeInTheDocument();
    expect(screen.getByText("Moral: +5 → 25")).toBeInTheDocument();
    expect(screen.getByText("Saldo: G$ 1120")).toBeInTheDocument();

    expect(mocks.api.post).toHaveBeenCalledWith("/api/pvp/attack", {
      targetId: "c2",
    });
  });

  it("should not POST when the attack is cancelled", async () => {
    mockGets();
    const user = userEvent.setup();

    render(<PvpView />);

    await user.click(await screen.findByRole("button", { name: "Atacar" }));
    await user.click(screen.getByRole("button", { name: /CANCELAR/i }));

    expect(screen.queryByText(/Custo:/)).not.toBeInTheDocument();
    expect(mocks.api.post).not.toHaveBeenCalled();
  });

  it("should surface the attack error inside the confirm modal", async () => {
    mockGets();
    mocks.api.post.mockRejectedValue(new Error("Ação em cooldown. Aguarde."));
    const user = userEvent.setup();

    render(<PvpView />);

    await user.click(await screen.findByRole("button", { name: "Atacar" }));
    await user.click(screen.getByRole("button", { name: /CONFIRMAR ATAQUE/i }));

    expect(await screen.findByText("Ação em cooldown. Aguarde.")).toBeInTheDocument();
    expect(mocks.api.post).toHaveBeenCalledWith("/api/pvp/attack", {
      targetId: "c2",
    });
  });

  it("should re-fetch and render targets after unmount and remount", async () => {
    mockGets();

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
    mockGets();

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
