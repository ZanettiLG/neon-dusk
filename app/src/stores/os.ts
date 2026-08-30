import { create } from "zustand";
import { api } from "@/api/client";
import type { OsActivateResponse, OsStatus } from "@neon-dusk/shared";

interface OsState {
  status: OsStatus | null;
  loading: boolean;
  error: string | null;
  /** GET /api/os/status — installed OS + activation readout. */
  fetch: () => Promise<void>;
  /** POST /api/os/activate — starts the installed OS effect window. */
  activate: () => Promise<OsActivateResponse>;
}

/**
 * OS store (Zustand singleton) — installed OS + activation readout
 * (issue #28). The OS is installed through the normal cromo surgery flow;
 * this store only reads state and fires daily-charge activations.
 */
export const useOsStore = create<OsState>((set) => ({
  status: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.get<OsStatus>("/api/os/status");
      set({ status, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Falha ao carregar SO",
        loading: false,
      });
    }
  },

  activate: async () => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<OsActivateResponse>("/api/os/activate", {});
      // Refresh the readout so usesRemaining/activeUntil stay in sync.
      const status = await api.get<OsStatus>("/api/os/status");
      set({ status, loading: false });
      return result;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Falha ao ativar o SO",
        loading: false,
      });
      throw err;
    }
  },
}));