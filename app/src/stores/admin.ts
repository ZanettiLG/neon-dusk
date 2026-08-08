import { create } from "zustand";
import { api } from "@/api/client";
import type {
  AdminAuditEntry,
  AdminAuditResponse,
  AdminEconomy,
  AdminPlayer,
  AdminPlayersResponse,
  AdminTransaction,
} from "@neon-dusk/shared";

interface AdminState {
  // Players
  players: AdminPlayer[];
  playersTotal: number;
  playersPage: number;
  playersLoading: boolean;
  playersError: string | null;

  // Economy
  economy: AdminEconomy | null;
  economyLoading: boolean;
  economyError: string | null;

  // Params
  params: Record<string, string>;
  paramsLoading: boolean;
  paramsError: string | null;
  paramsSaving: boolean;

  // Audit
  auditEntries: AdminAuditEntry[];
  auditCursor: string | null;
  auditLoading: boolean;
  auditError: string | null;

  // Transactions
  transactions: AdminTransaction[];
  transactionsTotal: number;
  transactionsLoading: boolean;
  transactionsError: string | null;

  // Actions
  fetchPlayers: (opts?: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: string;
  }) => Promise<void>;
  banPlayer: (characterId: string, reason: string) => Promise<void>;
  unbanPlayer: (characterId: string) => Promise<void>;
  fetchEconomy: () => Promise<void>;
  fetchParams: () => Promise<void>;
  updateParams: (params: Record<string, string>) => Promise<void>;
  fetchAuditLog: (opts?: {
    action?: string;
    result?: string;
    cursor?: string;
  }) => Promise<void>;
  loadMoreAudit: () => Promise<void>;
  fetchTransactions: (opts?: {
    type?: string;
    limit?: number;
    offset?: number;
  }) => Promise<void>;
}

/**
 * Admin panel store (ND-052). No persist — admin data is transient.
 */
export const useAdminStore = create<AdminState>()((set, get) => ({
  players: [],
  playersTotal: 0,
  playersPage: 1,
  playersLoading: false,
  playersError: null,

  economy: null,
  economyLoading: false,
  economyError: null,

  params: {},
  paramsLoading: false,
  paramsError: null,
  paramsSaving: false,

  auditEntries: [],
  auditCursor: null,
  auditLoading: false,
  auditError: null,

  transactions: [],
  transactionsTotal: 0,
  transactionsLoading: false,
  transactionsError: null,

  fetchPlayers: async (opts) => {
    set({ playersLoading: true, playersError: null });
    try {
      const params = new URLSearchParams();
      if (opts?.page) params.set("page", String(opts.page));
      if (opts?.pageSize) params.set("pageSize", String(opts.pageSize));
      if (opts?.search) params.set("search", opts.search);
      if (opts?.sort) params.set("sort", opts.sort);
      const qs = params.toString();
      const data = await api.get<AdminPlayersResponse>(`/api/admin/players${qs ? `?${qs}` : ""}`);
      set({
        players: data.players,
        playersTotal: data.total,
        playersPage: data.page,
        playersError: null,
      });
    } catch (err) {
      set({ playersError: err instanceof Error ? err.message : "Falha ao carregar jogadores" });
    } finally {
      set({ playersLoading: false });
    }
  },

  banPlayer: async (characterId, reason) => {
    await api.post(`/api/admin/players/${characterId}/ban`, { reason });
    // Refresh player list to show updated status.
    const state = get();
    await state.fetchPlayers({
      page: state.playersPage,
    });
  },

  unbanPlayer: async (characterId) => {
    await api.post(`/api/admin/players/${characterId}/unban`, {});
    const state = get();
    await state.fetchPlayers({
      page: state.playersPage,
    });
  },

  fetchEconomy: async () => {
    set({ economyLoading: true, economyError: null });
    try {
      set({ economy: await api.get<AdminEconomy>("/api/admin/economy") });
    } catch (err) {
      set({ economyError: err instanceof Error ? err.message : "Falha ao carregar economia" });
    } finally {
      set({ economyLoading: false });
    }
  },

  fetchParams: async () => {
    set({ paramsLoading: true, paramsError: null });
    try {
      set({ params: await api.get<Record<string, string>>("/api/admin/params") });
    } catch (err) {
      set({ paramsError: err instanceof Error ? err.message : "Falha ao carregar parâmetros" });
    } finally {
      set({ paramsLoading: false });
    }
  },

  updateParams: async (params) => {
    set({ paramsSaving: true, paramsError: null });
    try {
      set({ params: await api.patch<Record<string, string>>("/api/admin/params", { params }) });
    } catch (err) {
      set({ paramsError: err instanceof Error ? err.message : "Falha ao salvar parâmetros" });
      throw err;
    } finally {
      set({ paramsSaving: false });
    }
  },

  fetchAuditLog: async (opts) => {
    set({ auditLoading: true, auditError: null });
    try {
      const params = new URLSearchParams();
      if (opts?.action) params.set("action", opts.action);
      if (opts?.result) params.set("result", opts.result);
      if (opts?.cursor) params.set("cursor", opts.cursor);
      const qs = params.toString();
      const data = await api.get<AdminAuditResponse>(`/api/admin/audit${qs ? `?${qs}` : ""}`);
      set({
        auditEntries: data.entries,
        auditCursor: data.nextCursor,
        auditError: null,
      });
    } catch (err) {
      set({ auditError: err instanceof Error ? err.message : "Falha ao carregar auditoria" });
    } finally {
      set({ auditLoading: false });
    }
  },

  loadMoreAudit: async () => {
    const { auditCursor } = get();
    if (!auditCursor) return;
    set({ auditLoading: true });
    try {
      const params = new URLSearchParams();
      params.set("cursor", auditCursor);
      const data = await api.get<AdminAuditResponse>(`/api/admin/audit?${params.toString()}`);
      set((s) => ({
        auditEntries: [...s.auditEntries, ...data.entries],
        auditCursor: data.nextCursor,
        auditError: null,
      }));
    } catch (err) {
      set({ auditError: err instanceof Error ? err.message : "Falha ao carregar mais" });
    } finally {
      set({ auditLoading: false });
    }
  },

  fetchTransactions: async (opts) => {
    set({ transactionsLoading: true, transactionsError: null });
    try {
      const params = new URLSearchParams();
      if (opts?.type) params.set("type", opts.type);
      if (opts?.limit) params.set("limit", String(opts.limit));
      if (opts?.offset) params.set("offset", String(opts.offset));
      const qs = params.toString();
      const data = await api.get<{
        transactions: AdminTransaction[];
        total: number;
      }>(`/api/admin/transactions${qs ? `?${qs}` : ""}`);
      set({ transactions: data.transactions, transactionsTotal: data.total });
    } catch (err) {
      set({
        transactionsError:
          err instanceof Error ? err.message : "Falha ao carregar transações",
      });
    } finally {
      set({ transactionsLoading: false });
    }
  },
}));
