import { create } from "zustand";
import { api } from "@/api/client";
import type { HumanityInfo, TherapyResponse, TherapyType } from "@neon-dusk/shared";

interface HumanityState {
  info: HumanityInfo | null;
  loading: boolean;
  error: string | null;
  /** GET /api/humanity — band, flatline, scrubber + therapy readout. */
  fetch: () => Promise<void>;
  /** POST /api/therapy — undergo a session (clinic/attunement). */
  undergoTherapy: (therapyType: TherapyType) => Promise<TherapyResponse>;
}

/**
 * Humanity store (Zustand singleton) — cyberpsychosis readout + therapy
 * (issue #28). The therapy action refreshes the readout on success so the
 * shared 24h cooldown stays in sync with the server.
 */
export const useHumanityStore = create<HumanityState>((set) => ({
  info: null,
  loading: false,
  error: null,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const info = await api.get<HumanityInfo>("/api/humanity");
      set({ info, loading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Falha ao carregar humanidade",
        loading: false,
      });
    }
  },

  undergoTherapy: async (therapyType) => {
    set({ loading: true, error: null });
    try {
      const result = await api.post<TherapyResponse>("/api/therapy", { therapyType });
      const info = await api.get<HumanityInfo>("/api/humanity");
      set({ info, loading: false });
      return result;
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Falha na terapia",
        loading: false,
      });
      throw err;
    }
  },
}));