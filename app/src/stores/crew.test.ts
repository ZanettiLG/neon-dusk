import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { useCrewStore } from "@/stores/crew";
import { useAuthStore } from "@/stores/auth";
import type {
  ChatMessage,
  Crew,
  CrewDetailResponse,
} from "@neon-dusk/shared";

// Mock the api client module (frontier) so store actions never touch fetch.
const mocks = vi.hoisted(() => {
  class ApiError extends Error {
    status: number;
    code: string;
    constructor(status: number, code: string, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
    }
  }
  return {
    api: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    },
    setAccessToken: vi.fn(),
    ApiError,
  };
});

vi.mock("@/api/client", () => ({
  api: mocks.api,
  setAccessToken: mocks.setAccessToken,
  ApiError: mocks.ApiError,
  API_BASE_URL: "",
}));

const crew: Crew = {
  id: "c1",
  name: "As Gralhas",
  tag: "GRL",
  leaderId: "char-1",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const member = {
  id: "m1",
  characterId: "char-1",
  characterName: "Ghost",
  streetCred: 50,
  joinedAt: "2026-01-01T00:00:00.000Z",
};

const crewDetail: CrewDetailResponse = {
  crew,
  members: [member],
  bonuses: [{ type: "gig_success", description: "Chance de sucesso em trampos", value: 5 }],
  leaderboardPosition: 1,
};

const message: ChatMessage = {
  id: "msg-1",
  characterName: "Ghost",
  crewTag: "GRL",
  message: "Vamos nessa.",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/**
 * Minimal EventSource double: captures URLs, exposes emit helpers so tests can
 * drive onopen/onmessage/onerror exactly like a real SSE connection would.
 */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }

  emitOpen() {
    this.onopen?.(new Event("open"));
  }

  emitMessage(data: string, lastEventId?: string) {
    this.onmessage?.(new MessageEvent("message", { data, lastEventId }));
  }

  emitError() {
    this.onerror?.(new Event("error"));
  }
}

describe("useCrewStore", () => {
  beforeEach(() => {
    // Module-level SSE state (eventSource, chatStopped, timers) is NOT part of
    // the zustand state — tear it down first, then reset the store itself.
    useCrewStore.getState().disconnectChat();
    useCrewStore.setState(useCrewStore.getInitialState());
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    mocks.api.delete.mockReset();
    FakeEventSource.instances = [];
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  describe("fetchCrews", () => {
    it("should populate the crew list and clear loading", async () => {
      mocks.api.get.mockResolvedValue([crew]);

      await useCrewStore.getState().fetchCrews();

      const s = useCrewStore.getState();
      expect(s.crews).toEqual([crew]);
      expect(s.crewsLoading).toBe(false);
      expect(s.crewsError).toBeNull();
      expect(mocks.api.get).toHaveBeenCalledWith("/api/crews");
    });

    it("should set crewsError without throwing when the request fails", async () => {
      mocks.api.get.mockRejectedValue(new Error("boom"));

      await expect(useCrewStore.getState().fetchCrews()).resolves.toBeUndefined();

      const s = useCrewStore.getState();
      expect(s.crewsError).toBe("boom");
      expect(s.crewsLoading).toBe(false);
    });
  });

  describe("fetchCrewDetail", () => {
    it("should populate crewDetail and clear loading", async () => {
      mocks.api.get.mockResolvedValue(crewDetail);

      await useCrewStore.getState().fetchCrewDetail("c1");

      const s = useCrewStore.getState();
      expect(s.crewDetail).toEqual(crewDetail);
      expect(s.detailLoading).toBe(false);
      expect(s.detailError).toBeNull();
      expect(mocks.api.get).toHaveBeenCalledWith("/api/crews/c1");
    });

    it("should set detailError without throwing when the request fails", async () => {
      mocks.api.get.mockRejectedValue(new Error("Crew não encontrada."));

      await expect(useCrewStore.getState().fetchCrewDetail("c1")).resolves.toBeUndefined();

      expect(useCrewStore.getState().detailError).toBe("Crew não encontrada.");
      expect(useCrewStore.getState().detailLoading).toBe(false);
    });
  });

  describe("createCrew", () => {
    it("should POST the crew and return it", async () => {
      mocks.api.post.mockResolvedValue({ crew, member });

      const created = await useCrewStore.getState().createCrew("As Gralhas", "GRL");

      expect(created).toEqual(crew);
      expect(mocks.api.post).toHaveBeenCalledWith("/api/crews", {
        name: "As Gralhas",
        tag: "GRL",
      });
    });
  });

  describe("member management", () => {
    it("should invite a member", async () => {
      await useCrewStore.getState().inviteMember("c1", "char-9");

      expect(mocks.api.post).toHaveBeenCalledWith("/api/crews/c1/invite", {
        characterId: "char-9",
      });
    });

    it("should join a crew", async () => {
      await useCrewStore.getState().joinCrew("c1");

      expect(mocks.api.post).toHaveBeenCalledWith("/api/crews/c1/join", {});
    });

    it("should leave a crew", async () => {
      await useCrewStore.getState().leaveCrew("c1");

      expect(mocks.api.post).toHaveBeenCalledWith("/api/crews/c1/leave", {});
    });

    it("should kick a member", async () => {
      await useCrewStore.getState().kickMember("c1", "char-2");

      expect(mocks.api.post).toHaveBeenCalledWith("/api/crews/c1/kick", {
        characterId: "char-2",
      });
    });

    it("should dissolve a crew", async () => {
      await useCrewStore.getState().dissolveCrew("c1");

      expect(mocks.api.delete).toHaveBeenCalledWith("/api/crews/c1");
    });
  });

  describe("chat", () => {
    it("should send a message and clear loading", async () => {
      mocks.api.post.mockResolvedValue(undefined);

      await useCrewStore.getState().sendMessage("c1", "Vamos nessa.");

      expect(mocks.api.post).toHaveBeenCalledWith("/api/crews/c1/chat", {
        message: "Vamos nessa.",
      });
      expect(useCrewStore.getState().chatSendLoading).toBe(false);
      expect(useCrewStore.getState().chatSendError).toBeNull();
    });

    it("should set chatSendError and rethrow when sending fails", async () => {
      mocks.api.post.mockRejectedValue(new Error("Não é membro da crew"));

      await expect(
        useCrewStore.getState().sendMessage("c1", "oi"),
      ).rejects.toThrow("Não é membro da crew");

      const s = useCrewStore.getState();
      expect(s.chatSendError).toBe("Não é membro da crew");
      expect(s.chatSendLoading).toBe(false);
    });

    it("should store the chat history", async () => {
      mocks.api.get.mockResolvedValue({ messages: [message] });

      await useCrewStore.getState().fetchChatHistory("c1");

      expect(useCrewStore.getState().messages).toEqual([message]);
      expect(mocks.api.get).toHaveBeenCalledWith("/api/crews/c1/chat/history");
    });

    it("should keep messages unchanged when history fails (best-effort)", async () => {
      mocks.api.get.mockRejectedValue(new Error("boom"));
      useCrewStore.setState({ messages: [message] });

      await expect(useCrewStore.getState().fetchChatHistory("c1")).resolves.toBeUndefined();

      expect(useCrewStore.getState().messages).toEqual([message]);
    });
  });

  describe("SSE chat connection", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal("EventSource", FakeEventSource);
      useAuthStore.setState({ accessToken: "at" });
    });

    it("should open an EventSource with the crew stream and the auth token", () => {
      useCrewStore.getState().connectChat("c1");

      expect(FakeEventSource.instances).toHaveLength(1);
      expect(FakeEventSource.instances[0].url).toBe(
        "/api/crews/c1/chat/stream?token=at",
      );
    });

    it("should be a no-op without an access token", () => {
      useAuthStore.setState({ accessToken: null });

      useCrewStore.getState().connectChat("c1");

      expect(FakeEventSource.instances).toHaveLength(0);
    });

    it("should mark the chat connected on open", () => {
      useCrewStore.getState().connectChat("c1");

      FakeEventSource.instances[0].emitOpen();

      expect(useCrewStore.getState().chatStatus).toBe("connected");
    });

    it("should append incoming messages and cap the list at 50", () => {
      useCrewStore.setState({ messages: Array.from({ length: 50 }, (_, i) => ({ ...message, id: `m${i}` })) });
      useCrewStore.getState().connectChat("c1");

      FakeEventSource.instances[0].emitMessage(JSON.stringify(message), "evt-1");

      const messages = useCrewStore.getState().messages;
      expect(messages).toHaveLength(50);
      expect(messages[49]).toEqual(message);
    });

    it("should schedule a reconnect on error and reopen a fresh EventSource", () => {
      useCrewStore.getState().connectChat("c1");

      FakeEventSource.instances[0].emitError();

      expect(useCrewStore.getState().chatStatus).toBe("reconnecting");
      expect(FakeEventSource.instances[0].closed).toBe(true);

      vi.advanceTimersByTime(1000);

      expect(FakeEventSource.instances).toHaveLength(2);
    });

    it("should go offline after the reconnect threshold", () => {
      useCrewStore.getState().connectChat("c1");

      FakeEventSource.instances[0].emitError(); // attempt 1 — reconnecting
      vi.advanceTimersByTime(1000);
      FakeEventSource.instances[1].emitError(); // attempt 2 — reconnecting
      vi.advanceTimersByTime(2000);
      FakeEventSource.instances[2].emitError(); // attempt 3 — offline

      expect(useCrewStore.getState().chatStatus).toBe("offline");
    });

    it("should stop reconnecting when disconnectChat is called", () => {
      useCrewStore.getState().connectChat("c1");

      FakeEventSource.instances[0].emitError();
      useCrewStore.getState().disconnectChat();

      expect(useCrewStore.getState().chatStatus).toBe("offline");

      vi.advanceTimersByTime(10_000);

      expect(FakeEventSource.instances).toHaveLength(1);
    });
  });
});
