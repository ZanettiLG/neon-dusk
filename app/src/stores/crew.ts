import { create } from "zustand";
import { api, API_BASE_URL } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import type {
  Crew,
  CrewDetailResponse,
  CrewMember,
  ChatMessage,
  ChatHistoryResponse,
} from "@neon-dusk/shared";

/** SSE connection state. */
export type ConnectionStatus = "connected" | "reconnecting" | "offline";

interface CrewState {
  // Crew list
  crews: Crew[];
  crewsLoading: boolean;
  crewsError: string | null;

  // Crew detail
  crewDetail: CrewDetailResponse | null;
  detailLoading: boolean;
  detailError: string | null;

  // Chat
  messages: ChatMessage[];
  chatStatus: ConnectionStatus;
  chatSendLoading: boolean;
  chatSendError: string | null;

  // Actions — list
  fetchCrews: () => Promise<void>;

  // Actions — detail
  fetchCrewDetail: (id: string) => Promise<void>;
  createCrew: (name: string, tag: string) => Promise<Crew>;
  inviteMember: (crewId: string, characterId: string) => Promise<void>;
  joinCrew: (crewId: string) => Promise<void>;
  leaveCrew: (crewId: string) => Promise<void>;
  kickMember: (crewId: string, characterId: string) => Promise<void>;
  dissolveCrew: (crewId: string) => Promise<void>;

  // Actions — chat
  sendMessage: (crewId: string, message: string) => Promise<void>;
  connectChat: (crewId: string) => void;
  disconnectChat: () => void;
  fetchChatHistory: (crewId: string) => Promise<void>;
}

// --- SSE reconnect machinery (module-level) ---

let eventSource: EventSource | null = null;
let chatStopped = false;
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let lastEventId: string | null = null;

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
 * Crew store (Zustand singleton) — crew list, detail, member management, and
 * real-time crew chat via SSE (same pattern as saideira store).
 */
export const useCrewStore = create<CrewState>((set, get) => ({
  crews: [],
  crewsLoading: false,
  crewsError: null,

  crewDetail: null,
  detailLoading: false,
  detailError: null,

  messages: [],
  chatStatus: "offline",
  chatSendLoading: false,
  chatSendError: null,

  // --- List ---

  fetchCrews: async () => {
    set({ crewsLoading: true, crewsError: null });
    try {
      const data = await api.get<Crew[]>("/api/crews");
      set({ crews: data });
    } catch (err) {
      set({ crewsError: err instanceof Error ? err.message : "Falha ao carregar bondes" });
    } finally {
      set({ crewsLoading: false });
    }
  },

  // --- Detail ---

  fetchCrewDetail: async (id: string) => {
    set({ detailLoading: true, detailError: null });
    try {
      const data = await api.get<CrewDetailResponse>(`/api/crews/${id}`);
      set({ crewDetail: data });
    } catch (err) {
      set({ detailError: err instanceof Error ? err.message : "Falha ao carregar detalhes do bonde" });
    } finally {
      set({ detailLoading: false });
    }
  },

  createCrew: async (name: string, tag: string) => {
    const res = await api.post<{ crew: Crew; member: CrewMember }>("/api/crews", { name, tag });
    return res.crew;
  },

  inviteMember: async (crewId: string, characterId: string) => {
    await api.post(`/api/crews/${crewId}/invite`, { characterId });
  },

  joinCrew: async (crewId: string) => {
    await api.post(`/api/crews/${crewId}/join`, {});
  },

  leaveCrew: async (crewId: string) => {
    await api.post(`/api/crews/${crewId}/leave`, {});
  },

  kickMember: async (crewId: string, characterId: string) => {
    await api.post(`/api/crews/${crewId}/kick`, { characterId });
  },

  dissolveCrew: async (crewId: string) => {
    await api.delete(`/api/crews/${crewId}`);
  },

  // --- Chat ---

  sendMessage: async (crewId: string, message: string) => {
    set({ chatSendLoading: true, chatSendError: null });
    try {
      await api.post(`/api/crews/${crewId}/chat`, { message });
    } catch (err) {
      set({ chatSendError: err instanceof Error ? err.message : "Falha ao enviar mensagem" });
      throw err;
    } finally {
      set({ chatSendLoading: false });
    }
  },

  fetchChatHistory: async (crewId: string) => {
    try {
      const res = await api.get<ChatHistoryResponse>(`/api/crews/${crewId}/chat/history`);
      set({ messages: res.messages });
    } catch {
      // Best-effort — SSE fills the gap
    }
  },

  connectChat: (crewId: string) => {
    chatStopped = false;
    if (eventSource) return;

    const token = useAuthStore.getState().accessToken;
    if (!token) return;

    clearReconnectTimer();

    let url = `${API_BASE_URL}/api/crews/${crewId}/chat/stream?token=${encodeURIComponent(token)}`;
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
        set((s) => ({ messages: [...s.messages.slice(-49), msg] }));
      } catch {
        // malformed frame — ignore
      }
    };

    es.onerror = () => {
      if (eventSource !== es) return;
      reconnectAttempts++;
      set({ chatStatus: reconnectAttempts >= OFFLINE_THRESHOLD ? "offline" : "reconnecting" });
      es.close();
      eventSource = null;

      if (chatStopped) return;

      const delay = backoffDelay(reconnectAttempts);
      reconnectTimer = setTimeout(() => {
        if (!chatStopped && eventSource === null) get().connectChat(crewId);
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
}));
