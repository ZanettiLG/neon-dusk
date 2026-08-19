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

/** SSE connection state — three-tier so the UI can show progress. */
export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface SaideiraState {
  // Hub
  hub: SaideiraHubInfo | null;
  hubLoading: boolean;
  hubError: string | null;

  // Chat
  messages: ChatMessage[];
  chatStatus: ConnectionStatus;
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

// --- SSE reconnect machinery (module-level, survives store re-renders) ---

/** Active EventSource instance — null when disconnected or reconnecting. */
let eventSource: EventSource | null = null;
/** Set by disconnectChat() so a pending reconnect timer never resurrects the
 * stream after an intentional teardown (e.g. navigating away). */
let chatStopped = false;
/** Number of consecutive failed reconnect attempts. Reset on successful
 * connect. Drives the backoff delay and the offline threshold. */
let reconnectAttempts = 0;
/** Active reconnect timer handle — cleared on teardown or successful connect. */
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
/** Last EventSource ID received from the server, sent as Last-Event-ID on
 * reconnect so the server can resume from where the stream dropped. */
let lastEventId: string | null = null;

/** Backoff: 1s, 2s, 4s, 8s, 16s (max). */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MAX_MS = 16_000;
const OFFLINE_THRESHOLD = 3;

function backoffDelay(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** (attempts - 1), BACKOFF_MAX_MS);
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

/**
 * Saideira store (Zustand singleton) — hub readout, real-time chat (SSE +
 * Redis pub/sub) and the Legends menu. connectChat establishes the SSE stream
 * with exponential backoff reconnect; disconnectChat tears down cleanly.
 */
export const useSaideiraStore = create<SaideiraState>((set, get) => ({
  hub: null,
  hubLoading: false,
  hubError: null,

  messages: [],
  chatStatus: "offline",
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
    if (eventSource) return; // already connected

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    clearReconnectTimer();

    // ponytail: query-param token — EventSource can't set Authorization
    // headers. Switch to an HTTP-only cookie when the auth system supports it.
    let url = `${API_BASE_URL}/api/saideira/chat/stream?token=${encodeURIComponent(token)}`;
    if (lastEventId) {
      url += `&lastEventId=${encodeURIComponent(lastEventId)}`;
    }
    const es = new EventSource(url);
    eventSource = es;

    es.onopen = () => {
      reconnectAttempts = 0;
      set({ chatStatus: "connected" });
    };

    es.onmessage = (event) => {
      if (event.lastEventId) lastEventId = event.lastEventId;
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

      reconnectAttempts++;
      set({ chatStatus: reconnectAttempts >= OFFLINE_THRESHOLD ? "offline" : "reconnecting" });
      es.close();
      eventSource = null;

      if (chatStopped) return;

      const delay = backoffDelay(reconnectAttempts);
      reconnectTimer = setTimeout(() => {
        if (!chatStopped && eventSource === null) get().connectChat();
      }, delay);
    };
  },

  disconnectChat: () => {
    chatStopped = true;
    clearReconnectTimer();
    eventSource?.close();
    eventSource = null;
    reconnectAttempts = 0;
    lastEventId = null;
    set({ chatStatus: "offline" });
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
      set({ crewError: err instanceof Error ? err.message : "Falha ao carregar o ranking de bondes" });
    } finally {
      set({ crewLoading: false });
    }
  },
}));
