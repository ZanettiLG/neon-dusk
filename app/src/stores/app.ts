import { create } from "zustand";
import { api } from "@/api/client";
import type { HealthResponse } from "@neon-dusk/shared";

interface AppState {
  health: HealthResponse | null;
  healthError: string | null;
  healthLoading: boolean;
  checkHealth: () => Promise<void>;
}

/**
 * Global app store (Zustand singleton) — backend health status. Ephemeral,
 * not persisted. Selectors used by components:
 * - isHealthy = health?.status === "ok"
 * - dbConnected = health?.services.database === "connected"
 * - redisConnected = health?.services.redis === "connected"
 */
export const useAppStore = create<AppState>((set) => ({
  health: null,
  healthError: null,
  healthLoading: false,

  checkHealth: async () => {
    set({ healthLoading: true, healthError: null });
    try {
      set({ health: await api.get<HealthResponse>("/api/health") });
    } catch (err) {
      set({ healthError: err instanceof Error ? err.message : "Connection failed" });
    } finally {
      set({ healthLoading: false });
    }
  },
}));
