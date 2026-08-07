import { create } from "zustand";
import { api } from "@/api/client";
import type { LeaderboardEntry, StreetCredInfo } from "@neon-dusk/shared";

interface StreetCredState {
  /** Live street-cred readout (decay applied server-side). */
  info: StreetCredInfo | null;
  loading: boolean;
  error: string | null;
  leaderboard: LeaderboardEntry[] | null;
  leaderboardLoading: boolean;
  leaderboardError: string | null;

  fetchSC: () => Promise<void>;
  fetchLeaderboard: (limit?: number) => Promise<void>;
}

/**
 * Street Cred store (Zustand singleton) — live SC readout for the header
 * badge and the public top-50 leaderboard. fetchSC is a no-op without a
 * character (the endpoint 404s otherwise).
 */
export const useStreetCredStore = create<StreetCredState>((set) => ({
  info: null,
  loading: false,
  error: null,
  leaderboard: null,
  leaderboardLoading: false,
  leaderboardError: null,

  fetchSC: async () => {
    set({ loading: true, error: null });
    try {
      set({ info: await api.get<StreetCredInfo>("/api/street-cred") });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Falha ao carregar Street Cred" });
    } finally {
      set({ loading: false });
    }
  },

  fetchLeaderboard: async (limit = 20) => {
    set({ leaderboardLoading: true, leaderboardError: null });
    try {
      const res = await api.get<{ leaderboard: LeaderboardEntry[] }>(
        `/api/street-cred/leaderboard?limit=${limit}`,
      );
      set({ leaderboard: res.leaderboard });
    } catch (err) {
      set({ leaderboardError: err instanceof Error ? err.message : "Falha ao carregar o ranking" });
    } finally {
      set({ leaderboardLoading: false });
    }
  },
}));
