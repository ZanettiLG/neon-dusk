import { create } from "zustand";
import { api, API_BASE_URL } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import type {
  SaideiraHubInfo,
  ChatMessage,
  ChatHistoryResponse,
  LegendsResponse,
  CrewLeaderboardResponse,
} from "@neon-dusk/shared";

interface SaideiraState {
  // Hub
  hub: SaideiraHubInfo | null;
  hubLoading: boolean;
  hubError: string | null;

  // Chat
  messages: ChatMessage[];
  chatConnected: boolean;
  chatSendLoading: boolean;
  chatSendError: string | null;

  // Legends
  legends: LegendsResponse | null;
  legendsLoading: boolean;
  legendsError: string | null;

  // Crew leaderboard
  crewLeaderboard: CrewLeaderboardResponse | null;
  crewLoading: boolean;
  crewError: string | null;

  // Actions
  fetchHub: () => Promise<void>;
  fetchHistory: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  connectChat: () => void;
  disconnectChat: () => void;
  fetchLegends: () => Promise<void>;
  fetchCrewLeaderboard: () => Promise<void>;
}

/**
 * Live EventSource for the chat stream. Module-level so reconnect timers and
 * the active connection survive across store re-renders (Zustand actions are
 * stable singleton functions).
 */
let eventSource: EventSource | null = null;
/** Set by disconnectChat() so a pending reconnect timer never resurrects the
 * stream after an intentional teardown (e.g. navigating away). */
let chatStopped = false;

/**
 * Saideira store (Zustand singleton) — hub readout, real-time chat (SSE +
 * Redis pub/sub) and the Legends menu. connectChat reconnects with a 3s
 * backoff on error; disconnectChat tears down cleanly.
 */
export const useSaideiraStore = create<SaideiraState>((set, get) => ({
  hub: null,
  hubLoading: false,
  hubError: null,

  messages: [],
  chatConnected: false,
  chatSendLoading: false,
  chatSendError: null,

  legends: null,
  legendsLoading: false,
  legendsError: null,

  crewLeaderboard: null,
  crewLoading: false,
  crewError: null,

  fetchHub: async () => {
    set({ hubLoading: true, hubError: null });
    try {
      set({ hub: await api.get<SaideiraHubInfo>("/api/saideira") });
    } catch (err) {
      set({ hubError: err instanceof Error ? err.message : "Falha ao carregar a Saideira" });
    } finally {
      set({ hubLoading: false });
    }
  },

  fetchHistory: async () => {
    try {
      const res = await api.get<ChatHistoryResponse>("/api/saideira/chat/history");
      set({ messages: res.messages });
    } catch {
      // Chat is best-effort — the SSE stream fills the gap when it connects.
    }
  },

  sendMessage: async (message) => {
    set({ chatSendLoading: true, chatSendError: null });
    try {
      // The sender receives their own message back via SSE (publish precedes
      // the 201), so no local append — avoids duplicates.
      await api.post<ChatMessage>("/api/saideira/chat", { message });
    } catch (err) {
      set({ chatSendError: err instanceof Error ? err.message : "Falha ao enviar mensagem" });
      throw err;
    } finally {
      set({ chatSendLoading: false });
    }
  },

  connectChat: () => {
    chatStopped = false;
    if (eventSource) return; // já conectado

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    // ponytail: query-param token — EventSource can't set Authorization
    // headers. Switch to an HTTP-only cookie when the auth system supports it.
    const es = new EventSource(
      `${API_BASE_URL}/api/saideira/chat/stream?token=${encodeURIComponent(token)}`,
    );
    eventSource = es;

    es.onopen = () => set({ chatConnected: true });

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ChatMessage;
        set((s) => ({ messages: [...s.messages.slice(-49), msg] })); // keep last 50
      } catch {
        // malformed frame — ignore (heartbeats are comments, never data:)
      }
    };

    es.onerror = () => {
      // Only react to the active instance — a stale event from a closed
      // connection must not schedule a duplicate stream.
      if (eventSource !== es) return;
      set({ chatConnected: false });
      es.close();
      eventSource = null;
      setTimeout(() => {
        if (!chatStopped && eventSource === null) get().connectChat();
      }, 3000);
    };
  },

  disconnectChat: () => {
    chatStopped = true;
    eventSource?.close();
    eventSource = null;
    set({ chatConnected: false });
  },

  fetchLegends: async () => {
    set({ legendsLoading: true, legendsError: null });
    try {
      set({ legends: await api.get<LegendsResponse>("/api/saideira/legends") });
    } catch (err) {
      set({ legendsError: err instanceof Error ? err.message : "Falha ao carregar as lendas" });
    } finally {
      set({ legendsLoading: false });
    }
  },

  fetchCrewLeaderboard: async () => {
    set({ crewLoading: true, crewError: null });
    try {
      set({ crewLeaderboard: await api.get<CrewLeaderboardResponse>("/api/saideira/leaderboard/crews") });
    } catch (err) {
      set({ crewError: err instanceof Error ? err.message : "Falha ao carregar o ranking de crews" });
    } finally {
      set({ crewLoading: false });
    }
  },
}));
