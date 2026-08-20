import { describe, it, expect, beforeEach, vi } from "vitest";
import { useHudStore } from "@/stores/hud";
import type { EconomyBalanceResponse, InstalledChromeResponse } from "@neon-dusk/shared";

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

const balance: EconomyBalanceResponse = {
  balance: 1234,
  escrow: 200,
  lifetimeEarned: 5000,
  lifetimeSpent: 3766,
};

const chrome: InstalledChromeResponse = {
  installed: [],
  effectiveHumanity: 70,
  humanitySpent: 0,
  statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
  hpBonus: 0,
  gigSuccessBonus: 0,
  nilMaxBonus: 0,
};

describe("useHudStore.refresh", () => {
  beforeEach(() => {
    useHudStore.setState(useHudStore.getInitialState());
    mocks.api.get.mockReset();
  });

  it("should set balance and humanity on success", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/economy/balance") return Promise.resolve(balance);
      if (url === "/api/chrome/installed") return Promise.resolve(chrome);
      return Promise.resolve(undefined);
    });

    await useHudStore.getState().refresh();

    const s = useHudStore.getState();
    expect(s.balance).toBe(1234);
    expect(s.balanceError).toBeNull();
    expect(s.humanity).toBe(70);
    expect(s.humanityError).toBeNull();
  });

  it("should keep humanity when the balance fetch fails (allSettled)", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/economy/balance") return Promise.reject(new Error("wallet down"));
      if (url === "/api/chrome/installed") return Promise.resolve(chrome);
      return Promise.resolve(undefined);
    });

    await useHudStore.getState().refresh();

    const s = useHudStore.getState();
    expect(s.balance).toBeNull();
    expect(s.balanceError).toBe("wallet down");
    expect(s.humanity).toBe(70);
    expect(s.humanityError).toBeNull();
  });

  it("should keep balance when the cromo fetch fails (allSettled)", async () => {
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/economy/balance") return Promise.resolve(balance);
      if (url === "/api/chrome/installed") return Promise.reject(new Error("cromo down"));
      return Promise.resolve(undefined);
    });

    await useHudStore.getState().refresh();

    const s = useHudStore.getState();
    expect(s.balance).toBe(1234);
    expect(s.balanceError).toBeNull();
    expect(s.humanity).toBeNull();
    expect(s.humanityError).toBe("cromo down");
  });

  it("should not throw when both fetches fail", async () => {
    mocks.api.get.mockRejectedValue(new Error("api down"));

    await expect(useHudStore.getState().refresh()).resolves.toBeUndefined();

    const s = useHudStore.getState();
    expect(s.balance).toBeNull();
    expect(s.balanceError).toBe("api down");
    expect(s.humanity).toBeNull();
    expect(s.humanityError).toBe("api down");
  });
});
