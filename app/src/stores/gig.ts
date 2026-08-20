import { create } from "zustand";
import { api } from "@/api/client";
import type {
  ActiveGig,
  GigBoardResponse,
  GigEscapeResponse,
  GigExecuteResponse,
  GigHistoryResponse,
  GigWrapupResponse,
} from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import { useStreetCredStore } from "@/stores/street-cred";

interface GigState {
  board: GigBoardResponse | null;
  boardLoading: boolean;
  boardError: string | null;
  history: GigHistoryResponse | null;
  historyLoading: boolean;
  historyError: string | null;
  actionLoading: boolean;
  actionError: string | null;
  lastWrapup: GigWrapupResponse | null;

  fetchBoard: () => Promise<void>;
  acceptGig: (id: string) => Promise<ActiveGig>;
  doLegwork: (id: string) => Promise<ActiveGig>;
  executeGig: (id: string) => Promise<GigExecuteResponse>;
  escapeGig: (id: string) => Promise<GigEscapeResponse>;
  wrapUpGig: (id: string) => Promise<GigWrapupResponse>;
  abandonGig: (id: string) => Promise<void>;
  fetchHistory: (opts?: { limit?: number; cursor?: string }) => Promise<void>;
}

/**
 * Trampos store (singleton Zustand) — quadro do Despachante Cupim, o loop de 5 fases do
 * trampo ativo e o histórico paginado por cursor. Ações de fase patcheiam `board.activeGig`
 * straight from the server response; wrap up clears it and refreshes the board.
 */
export const useGigStore = create<GigState>((set, get) => ({
  board: null,
  boardLoading: false,
  boardError: null,
  history: null,
  historyLoading: false,
  historyError: null,
  actionLoading: false,
  actionError: null,
  lastWrapup: null,

  fetchBoard: async () => {
    set({ boardLoading: true, boardError: null });
    try {
      set({ board: await api.get<GigBoardResponse>("/api/gigs") });
    } catch (err) {
      set({ boardError: err instanceof Error ? err.message : "Falha ao carregar o quadro" });
    } finally {
      set({ boardLoading: false });
    }
  },

  acceptGig: async (id) => {
    set({ actionLoading: true, actionError: null, lastWrapup: null });
    try {
      const res = await api.post<{ activeGig: ActiveGig }>(`/api/gigs/${id}/accept`, {});
      set((s) => ({ board: s.board ? { ...s.board, activeGig: res.activeGig } : null }));
      // NIL was spent — keep the dashboard bar honest.
      void useAuthStore.getState().fetchNil();
      return res.activeGig;
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : "Falha ao aceitar trampo" });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  doLegwork: async (id) => {
    set({ actionLoading: true, actionError: null });
    try {
      const activeGig = await api.post<ActiveGig>(`/api/gigs/${id}/legwork`, {});
      set((s) => ({ board: s.board ? { ...s.board, activeGig } : null }));
      return activeGig;
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : "Falha ao iniciar legwork" });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  executeGig: async (id) => {
    set({ actionLoading: true, actionError: null });
    try {
      const res = await api.post<GigExecuteResponse>(`/api/gigs/${id}/execute`, {});
      set((s) => ({ board: s.board ? { ...s.board, activeGig: res.activeGig } : null }));
      return res;
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : "Falha ao executar" });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  escapeGig: async (id) => {
    set({ actionLoading: true, actionError: null });
    try {
      const res = await api.post<GigEscapeResponse>(`/api/gigs/${id}/escape`, {});
      set((s) => ({ board: s.board ? { ...s.board, activeGig: res.activeGig } : null }));
      return res;
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : "Falha na fuga" });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  wrapUpGig: async (id) => {
    set({ actionLoading: true, actionError: null });
    try {
      const res = await api.post<GigWrapupResponse>(`/api/gigs/${id}/wrapup`, {});
      set((s) => ({ lastWrapup: res, board: s.board ? { ...s.board, activeGig: null } : null }));
      // Payout/street-cred changed — refresh the board so cooldowns reflect
      // the completed trampo (best-effort; the wrapup already resolved).
      void get().fetchBoard();
      void useAuthStore.getState().fetchNil();
      // HUD readouts: payout moves grana, outcome moves Moral (issue #13).
      void useHudStore.getState().refresh();
      void useStreetCredStore.getState().fetchSC();
      return res;
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : "Falha ao concluir trampo" });
      throw err;
    } finally {
      set({ actionLoading: false });
    }
  },

  abandonGig: async (id) => {
    set({ actionLoading: true, actionError: null });
    try {
      await api.post(`/api/gigs/${id}/abandon`, {});
      set((s) => ({ board: s.board ? { ...s.board, activeGig: null } : null }));
      void get().fetchBoard();
      // NIL is refunded — keep the dashboard bar honest.
      void useAuthStore.getState().fetchNil();
    } catch (err) {
      set({ actionError: err instanceof Error ? err.message : "Falha ao abandonar trampo" });
    } finally {
      set({ actionLoading: false });
    }
  },

  fetchHistory: async (opts) => {
    set({ historyLoading: true, historyError: null });
    try {
      const { limit, cursor } = opts ?? {};
      const query = new URLSearchParams();
      if (limit) query.set("limit", String(limit));
      if (cursor) query.set("cursor", cursor);
      const qs = query.toString();
      const res = await api.get<GigHistoryResponse>(`/api/gigs/history${qs ? `?${qs}` : ""}`);
      set({ history: res });
    } catch (err) {
      set({ historyError: err instanceof Error ? err.message : "Falha ao carregar histórico" });
    } finally {
      set({ historyLoading: false });
    }
  },
}));
