import { describe, it, expect, beforeEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { useAppStore } from "@/stores/app";

const healthy = {
  status: "ok",
  timestamp: "2026-08-06T00:00:00.000Z",
  uptime: 42,
  version: "0.1.0",
  services: { database: "connected", redis: "connected" },
};

describe("useAppStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should start with initial state", () => {
    const store = useAppStore();

    expect(store.health).toBeNull();
    expect(store.healthError).toBeNull();
    expect(store.healthLoading).toBe(false);
    expect(store.isHealthy).toBe(false);
    expect(store.dbConnected).toBe(false);
    expect(store.redisConnected).toBe(false);
  });

  it("should set health data and derived flags on successful check", async () => {
    const store = useAppStore();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthy), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const promise = store.checkHealth();
    expect(store.healthLoading).toBe(true);
    await promise;

    expect(store.healthLoading).toBe(false);
    expect(store.health).toEqual(healthy);
    expect(store.healthError).toBeNull();
    expect(store.isHealthy).toBe(true);
    expect(store.dbConnected).toBe(true);
    expect(store.redisConnected).toBe(true);
  });

  it("should surface a degraded (503) response as an error", async () => {
    const store = useAppStore();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthy), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await store.checkHealth();

    expect(store.healthLoading).toBe(false);
    expect(store.health).toBeNull();
    expect(store.healthError).toBe("Request failed");
    expect(store.isHealthy).toBe(false);
  });

  it("should capture the error message when the request fails", async () => {
    const store = useAppStore();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network request failed")));

    await store.checkHealth();

    expect(store.healthLoading).toBe(false);
    expect(store.healthError).toBe("Network request failed");
    expect(store.health).toBeNull();
    expect(store.isHealthy).toBe(false);
  });

  it("should call the api client with the health endpoint", async () => {
    const store = useAppStore();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(healthy), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await store.checkHealth();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/health",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("should expose checkHealth so views can retry", async () => {
    const store = useAppStore();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(healthy), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await store.checkHealth();
    expect(store.health).toEqual(healthy);
    await flushPromises();
  });
});
