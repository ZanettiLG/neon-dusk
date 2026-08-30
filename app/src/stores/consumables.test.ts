import { describe, it, expect, beforeEach, vi } from "vitest";
import { useConsumablesStore } from "@/stores/consumables";
import type { ConsumablesResponse, ConsumableUseResponse } from "@neon-dusk/shared";

// Issue #48 — consumables store tests. The store calls the other stores
// through getState() at call time (never import time), so the test mocks
// useHudStore/useHumanityStore modules and asserts the refresh/fetch calls.

const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code: string;
    details?: unknown;
    constructor(status: number, code: string, message: string, details?: unknown) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    hudRefresh: vi.fn(),
    humanityFetch: vi.fn(),
    ApiError,
  };
});

vi.mock("@/api/client", () => ({
  api: mocks.api,
  ApiError: mocks.ApiError,
}));

vi.mock("@/stores/hud", () => ({
  useHudStore: { getState: () => ({ refresh: mocks.hudRefresh }) },
}));

vi.mock("@/stores/humanity", () => ({
  useHumanityStore: { getState: () => ({ fetch: mocks.humanityFetch }) },
}));

// Canonical catalog fixture (mirrors server/src/content/consumables.ts).
const sampleItems: ConsumablesResponse["items"] = [
  {
    id: "estabilizador",
    slug: "estabilizador",
    name: "Estabilizador",
    tier: 1,
    restoreAmount: 5,
    cooldownHours: 0,
    ownedQuantity: 1,
    nextAvailableAt: null,
  },
  {
    id: "freio",
    slug: "freio",
    name: "Freio",
    tier: 2,
    restoreAmount: 10,
    cooldownHours: 12,
    ownedQuantity: 2,
    nextAvailableAt: null,
  },
  {
    id: "choque",
    slug: "choque",
    name: "Choque",
    tier: 3,
    restoreAmount: 15,
    cooldownHours: 24,
    ownedQuantity: 0,
    nextAvailableAt: null,
  },
];

const useResponse: ConsumableUseResponse = {
  humanityBefore: 50,
  humanityAfter: 55,
  restored: 5,
  costEddies: 0,
  nextAvailableAt: null,
};

describe("useConsumablesStore", () => {
  beforeEach(() => {
    useConsumablesStore.setState(useConsumablesStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    mocks.hudRefresh.mockReset();
    mocks.humanityFetch.mockReset();
  });

  it("should populate items from GET /api/consumables", async () => {
    mocks.api.get.mockResolvedValue({ items: sampleItems });

    await useConsumablesStore.getState().fetch();

    const s = useConsumablesStore.getState();
    expect(s.items).toEqual(sampleItems);
    expect(s.loading).toBe(false);
    expect(s.error).toBeNull();
  });

  it("should surface the fetch error without throwing", async () => {
    mocks.api.get.mockRejectedValue(new Error("api down"));

    await useConsumablesStore.getState().fetch();

    const s = useConsumablesStore.getState();
    expect(s.items).toBeNull();
    expect(s.error).toBe("api down");
    expect(s.loading).toBe(false);
  });

  it("should refresh items, record lastUse and ping the HUD/humanity stores on success", async () => {
    mocks.api.post.mockResolvedValue(useResponse);
    // The post-use refetch hits GET /api/consumables again with updated stock.
    mocks.api.get.mockImplementation((url: string) => {
      if (url === "/api/consumables") {
        return Promise.resolve({
          items: sampleItems.map((item) =>
            item.id === "estabilizador" ? { ...item, ownedQuantity: 0 } : item,
          ),
        });
      }
      return Promise.resolve(undefined);
    });

    const result = await useConsumablesStore.getState().useItem("estabilizador");

    expect(mocks.api.post).toHaveBeenCalledWith("/api/consumables/use", {
      itemId: "estabilizador",
    });
    expect(result).toEqual(useResponse);
    const s = useConsumablesStore.getState();
    expect(s.items?.[0]?.ownedQuantity).toBe(0);
    expect(s.lastUse).toEqual(useResponse);
    expect(s.useError).toBeNull();
    expect(s.usingItemId).toBeNull();
    expect(mocks.hudRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.humanityFetch).toHaveBeenCalledTimes(1);
  });

  it("should set a structured COOLDOWN_ACTIVE error with nextAvailableAt and re-throw", async () => {
    const unlock = new Date(Date.now() + 12 * 3600_000).toISOString();
    mocks.api.post.mockRejectedValue(
      new mocks.ApiError(429, "COOLDOWN_ACTIVE", "Ação em cooldown.", { nextAvailableAt: unlock }),
    );

    await expect(useConsumablesStore.getState().useItem("freio")).rejects.toBeInstanceOf(
      mocks.ApiError,
    );

    const s = useConsumablesStore.getState();
    expect(s.useError).toEqual({
      code: "COOLDOWN_ACTIVE",
      message: "Ação em cooldown.",
      nextAvailableAt: unlock,
    });
    expect(s.usingItemId).toBeNull();
    expect(s.lastUse).toBeNull();
    // No refetch, no cross-store pings on failure.
    expect(mocks.hudRefresh).not.toHaveBeenCalled();
    expect(mocks.humanityFetch).not.toHaveBeenCalled();
  });

  it("should normalize non-ApiError failures to UNKNOWN_ERROR", async () => {
    mocks.api.post.mockRejectedValue(new Error("boom"));

    await expect(useConsumablesStore.getState().useItem("choque")).rejects.toThrow("boom");

    expect(useConsumablesStore.getState().useError).toEqual({
      code: "UNKNOWN_ERROR",
      message: "boom",
      nextAvailableAt: null,
    });
  });

  // The remaining server error codes the panel can surface (issue #48
  // criteria 2): same normalization path as COOLDOWN_ACTIVE — structured
  // useError, no refetch, no cross-store pings, re-throw for the caller.
  it.each([
    ["NOT_OWNED", 400, "Você não tem este item no inventário."],
    ["CONSUMABLE_NOT_FOUND", 404, "Item não encontrado."],
    ["RATE_LIMITED", 429, "Muitas requisições. Aguarde."],
    ["UNAUTHORIZED", 401, "Sessão expirada. Faça login novamente."],
    ["FLATLINED", 403, "Personagem apagado. Sem ações permitidas."],
    ["VALIDATION_ERROR", 400, "Dados inválidos. Verifique os campos."],
  ])(
    "should set a structured %s error and re-throw",
    async (code, status, message) => {
      mocks.api.post.mockRejectedValue(new mocks.ApiError(status, code, message));

      await expect(useConsumablesStore.getState().useItem("estabilizador")).rejects.toBeInstanceOf(
        mocks.ApiError,
      );

      const s = useConsumablesStore.getState();
      expect(s.useError).toEqual({ code, message, nextAvailableAt: null });
      expect(s.usingItemId).toBeNull();
      expect(s.lastUse).toBeNull();
      expect(mocks.hudRefresh).not.toHaveBeenCalled();
      expect(mocks.humanityFetch).not.toHaveBeenCalled();
    },
  );

  it("should still resolve with the use result when the post-use refetch fails", async () => {
    mocks.api.post.mockResolvedValue(useResponse);
    // The follow-up GET /api/consumables fails — fetch() swallows the error
    // (sets `error`), so the use still resolves and the success feedback shows.
    mocks.api.get.mockRejectedValue(new Error("api down"));

    const result = await useConsumablesStore.getState().useItem("estabilizador");

    expect(result).toEqual(useResponse);
    const s = useConsumablesStore.getState();
    expect(s.lastUse).toEqual(useResponse);
    expect(s.useError).toBeNull();
    expect(s.error).toBe("api down");
    expect(mocks.hudRefresh).toHaveBeenCalledTimes(1);
    expect(mocks.humanityFetch).toHaveBeenCalledTimes(1);
  });
});
