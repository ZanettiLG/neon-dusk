import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "@/stores/app";
import type { HealthResponse } from "@neon-dusk/shared";

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

const health: HealthResponse = {
  status: "ok",
  timestamp: "2026-01-01T00:00:00.000Z",
  uptime: 42,
  version: "0.1.0",
  services: { database: "connected", redis: "connected" },
};

describe("useAppStore", () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState());
    mocks.api.get.mockReset();
  });

  it("should store the health payload on success", async () => {
    mocks.api.get.mockResolvedValue(health);

    await useAppStore.getState().checkHealth();

    const s = useAppStore.getState();
    expect(s.health).toEqual(health);
    expect(s.healthError).toBeNull();
    expect(s.healthLoading).toBe(false);
    expect(mocks.api.get).toHaveBeenCalledWith("/api/health");
  });

  it("should record an error and keep health null when the request fails", async () => {
    mocks.api.get.mockRejectedValue(new Error("API down"));

    await useAppStore.getState().checkHealth();

    const s = useAppStore.getState();
    expect(s.health).toBeNull();
    expect(s.healthError).toBe("API down");
    expect(s.healthLoading).toBe(false);
  });

  it("should retry and recover after an error", async () => {
    mocks.api.get.mockRejectedValueOnce(new Error("API down")).mockResolvedValue(health);

    await useAppStore.getState().checkHealth();
    expect(useAppStore.getState().healthError).toBe("API down");

    await useAppStore.getState().checkHealth();
    expect(useAppStore.getState().health).toEqual(health);
    expect(useAppStore.getState().healthError).toBeNull();
  });
});
