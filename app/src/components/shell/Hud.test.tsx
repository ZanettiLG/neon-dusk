import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Hud from "@/components/shell/Hud";
import { useAuthStore } from "@/stores/auth";
import { useStreetCredStore } from "@/stores/street-cred";
import { useHudStore } from "@/stores/hud";
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
  streetCred: 42,
  maxStreetCredAchieved: 42,
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

describe("Hud", () => {
  beforeEach(() => {
    useAuthStore.setState({ character });
    useStreetCredStore.setState({ info: null, error: null });
    mocks.api.get.mockReset();
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/characters/me/nil") {
        return Promise.resolve({
          current: 50,
          max: 100,
          nextTickSeconds: 0,
          regenerating: false,
          updatedAt: "2026-01-01T00:00:00.000Z",
        });
      }
      if (url === "/api/street-cred") {
        return Promise.resolve({
          score: 42,
          title: "Hustler",
          maxAchieved: 42,
          nextThreshold: { score: 50, title: "Corredor" },
          scToNext: 8,
        });
      }
      if (url === "/api/economy/balance") {
        return Promise.resolve({ balance: 1234, escrow: 200, lifetimeEarned: 5000, lifetimeSpent: 3766 });
      }
      if (url === "/api/chrome/installed") {
        return Promise.resolve({
          installed: [],
          effectiveHumanity: 70,
          humanitySpent: 0,
          statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
          hpBonus: 0,
          gigSuccessBonus: 0,
          nilMaxBonus: 0,
        });
      }
      return Promise.resolve(undefined);
    });
  });

  it("renders the four HUD cells (NIL, Humanidade, Grana, Moral)", async () => {
    render(<Hud />);

    const group = screen.getByRole("region", { name: "Status do personagem" });
    expect(group).toBeInTheDocument();

    // NIL/Humanidade start as skeletons until their fetches settle.
    expect(await screen.findByRole("meter", { name: "NIL" })).toBeInTheDocument();
    expect(await screen.findByRole("meter", { name: "Humanidade" })).toBeInTheDocument();
    expect(await screen.findByRole("meter", { name: "Moral" })).toBeInTheDocument();
    expect(await screen.findByText("G$ 1.234")).toBeInTheDocument();
  });

  it("fires the readout fetches on mount", async () => {
    render(<Hud />);

    await waitFor(() => {
      expect(mocks.api.get).toHaveBeenCalledWith("/api/characters/me/nil");
      expect(mocks.api.get).toHaveBeenCalledWith("/api/street-cred");
      expect(mocks.api.get).toHaveBeenCalledWith("/api/economy/balance");
      expect(mocks.api.get).toHaveBeenCalledWith("/api/chrome/installed");
    });
  });

  it("falls back to character.streetCred for Moral while the live readout loads", () => {
    render(<Hud />);

    // The fallback shows 42% of 100 (character snapshot) until the live SC lands.
    const meter = screen.getByRole("meter", { name: "Moral" });
    expect(meter).toHaveAttribute("aria-valuenow", "42");
  });

  it("renders nothing without a character", () => {
    useAuthStore.setState({ character: null });
    render(<Hud />);

    expect(screen.queryByRole("region", { name: "Status do personagem" })).not.toBeInTheDocument();
    expect(mocks.api.get).not.toHaveBeenCalled();
  });

  it("shows the grana error marker when the balance fetch fails", async () => {
    useHudStore.setState({ balance: null, balanceError: "wallet down" });
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/economy/balance") return Promise.reject(new Error("wallet down"));
      if (url === "/api/chrome/installed") {
        return Promise.resolve({
          installed: [],
          effectiveHumanity: 70,
          humanitySpent: 0,
          statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
          hpBonus: 0,
          gigSuccessBonus: 0,
          nilMaxBonus: 0,
        });
      }
      return Promise.resolve(undefined);
    });

    render(<Hud />);

    // Grana cell shows the ✗ alert instead of a value.
    expect(await screen.findByRole("alert")).toHaveTextContent("✗");
    expect(screen.queryByText(/G\$ /)).not.toBeInTheDocument();
  });

  it("shows the humanity error state when the cromo fetch fails", async () => {
    useHudStore.setState({ humanity: null, humanityError: "cromo down" });
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/economy/balance") {
        return Promise.resolve({ balance: 1234, escrow: 200, lifetimeEarned: 5000, lifetimeSpent: 3766 });
      }
      if (url === "/api/chrome/installed") return Promise.reject(new Error("cromo down"));
      return Promise.resolve(undefined);
    });

    render(<Hud />);

    // Humanity cell renders the MetricBar error alert.
    expect(await screen.findByRole("alert")).toHaveTextContent(/erro ao carregar/i);
  });
});
