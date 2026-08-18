import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";
import type {
  AuthResponse,
  Character,
  NilStatus,
  User,
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
}));

const user: User = {
  id: "u1",
  email: "fixer@neondusk.gg",
  role: "player",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "solo",
  body: 3,
  reflexes: 3,
  intelligence: 3,
  technical: 3,
  cool: 3,
  streetCred: 0,
  maxStreetCredAchieved: 0,
  ability: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const authResponse = (overrides: Partial<AuthResponse> = {}): AuthResponse => ({
  accessToken: "at",
  refreshToken: "rt",
  user,
  character: null,
  ...overrides,
});

const nilStatus: NilStatus = {
  current: 80,
  max: 100,
  nextTickSeconds: 300,
  regenerating: true,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState());
    mocks.api.get.mockReset();
    mocks.api.post.mockReset();
    mocks.setAccessToken.mockReset();
  });

  describe("login", () => {
    it("should store tokens and user, and sync the api client token, on success", async () => {
      mocks.api.post.mockResolvedValue(authResponse());

      await useAuthStore.getState().login({ email: "fixer@neondusk.gg", password: "pw" });

      const s = useAuthStore.getState();
      expect(s.accessToken).toBe("at");
      expect(s.refreshToken).toBe("rt");
      expect(s.user?.email).toBe("fixer@neondusk.gg");
      expect(s.loading).toBe(false);
      expect(s.error).toBeNull();
      expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/login", {
        email: "fixer@neondusk.gg",
        password: "pw",
      });
      expect(mocks.setAccessToken).toHaveBeenCalledWith("at");
    });

    it("should set error, rethrow and keep the session empty when the API fails", async () => {
      mocks.api.post.mockRejectedValue(new Error("Invalid credentials"));

      await expect(
        useAuthStore.getState().login({ email: "a@b.com", password: "x" }),
      ).rejects.toThrow("Invalid credentials");

      const s = useAuthStore.getState();
      expect(s.error).toBe("Invalid credentials");
      expect(s.loading).toBe(false);
      expect(s.accessToken).toBeNull();
      expect(s.user).toBeNull();
    });
  });

  describe("register", () => {
    it("should store tokens and user on success", async () => {
      mocks.api.post.mockResolvedValue(authResponse({ character }));

      await useAuthStore.getState().register({ email: "new@neondusk.gg", password: "pw" });

      const s = useAuthStore.getState();
      expect(s.accessToken).toBe("at");
      expect(s.character).toEqual(character);
      expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/register", {
        email: "new@neondusk.gg",
        password: "pw",
      });
      expect(mocks.setAccessToken).toHaveBeenCalledWith("at");
    });

    it("should set error and rethrow when the API fails", async () => {
      mocks.api.post.mockRejectedValue(new Error("Email taken"));

      await expect(
        useAuthStore.getState().register({ email: "a@b.com", password: "pw" }),
      ).rejects.toThrow("Email taken");

      expect(useAuthStore.getState().error).toBe("Email taken");
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe("applyAuth", () => {
    it("should apply the full AuthResponse and sync the api client token", () => {
      useAuthStore.getState().applyAuth(authResponse({ character }));

      const s = useAuthStore.getState();
      expect(s.user).toEqual(user);
      expect(s.character).toEqual(character);
      expect(s.accessToken).toBe("at");
      expect(s.refreshToken).toBe("rt");
      expect(mocks.setAccessToken).toHaveBeenCalledWith("at");
    });
  });

  describe("clearAuth", () => {
    it("should reset state, clear the api token and wipe persisted storage", () => {
      useAuthStore.getState().applyAuth(authResponse({ character }));
      useAuthStore.setState({ nilStatus });

      useAuthStore.getState().clearAuth();

      const s = useAuthStore.getState();
      expect(s.accessToken).toBeNull();
      expect(s.refreshToken).toBeNull();
      expect(s.user).toBeNull();
      expect(s.character).toBeNull();
      expect(s.nilStatus).toBeNull();
      expect(s.nilError).toBeNull();
      expect(mocks.setAccessToken).toHaveBeenLastCalledWith(null);
      expect(localStorage.getItem("nd_auth")).toBeNull();
    });
  });

  describe("logout", () => {
    it("should revoke the session server-side then clear local state", async () => {
      mocks.api.post.mockResolvedValue(undefined);
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user });

      await useAuthStore.getState().logout();

      expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/logout", {
        refreshToken: "rt",
      });
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().refreshToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("should still clear locally when the server call fails", async () => {
      mocks.api.post.mockRejectedValue(new Error("network down"));
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user });

      await useAuthStore.getState().logout();

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("should skip the server call when there is no refresh token", async () => {
      await useAuthStore.getState().logout();

      expect(mocks.api.post).not.toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("should rotate tokens and return true on success", async () => {
      mocks.api.post.mockResolvedValue(
        authResponse({ accessToken: "at2", refreshToken: "rt2" }),
      );
      useAuthStore.setState({ refreshToken: "rt" });

      const ok = await useAuthStore.getState().refresh();

      expect(ok).toBe(true);
      expect(useAuthStore.getState().accessToken).toBe("at2");
      expect(useAuthStore.getState().refreshToken).toBe("rt2");
      expect(mocks.api.post).toHaveBeenCalledWith("/api/auth/refresh", {
        refreshToken: "rt",
      });
    });

    it("should return false without calling the API when there is no refresh token", async () => {
      const ok = await useAuthStore.getState().refresh();

      expect(ok).toBe(false);
      expect(mocks.api.post).not.toHaveBeenCalled();
    });

    it("should clear the session and return false when the refresh fails", async () => {
      mocks.api.post.mockRejectedValue(new mocks.ApiError(401, "UNAUTHORIZED", "expired"));
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user });

      const ok = await useAuthStore.getState().refresh();

      expect(ok).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe("fetchMe", () => {
    it("should store the user and character from /api/auth/me", async () => {
      mocks.api.get.mockResolvedValue({ user, character });

      await useAuthStore.getState().fetchMe();

      expect(useAuthStore.getState().user).toEqual(user);
      expect(useAuthStore.getState().character).toEqual(character);
      expect(mocks.api.get).toHaveBeenCalledWith("/api/auth/me");
    });
  });

  describe("bootstrap", () => {
    it("should skip entirely when no tokens are present", async () => {
      await useAuthStore.getState().bootstrap();

      expect(mocks.api.get).not.toHaveBeenCalled();
      expect(mocks.setAccessToken).not.toHaveBeenCalled();
    });

    it("should sync the token and restore user/character when tokens exist", async () => {
      mocks.api.get.mockResolvedValue({ user, character });
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt" });

      await useAuthStore.getState().bootstrap();

      expect(mocks.setAccessToken).toHaveBeenCalledWith("at");
      expect(useAuthStore.getState().user).toEqual(user);
      expect(useAuthStore.getState().character).toEqual(character);
    });

    it("should clear the session on a 401", async () => {
      mocks.api.get.mockRejectedValue(new mocks.ApiError(401, "UNAUTHORIZED", "expired"));
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user });

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it("should keep the tokens on network errors (retry later)", async () => {
      mocks.api.get.mockRejectedValue(new TypeError("Failed to fetch"));
      useAuthStore.setState({ accessToken: "at", refreshToken: "rt", user });

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().accessToken).toBe("at");
      expect(useAuthStore.getState().user).toEqual(user);
    });
  });

  describe("createCharacter", () => {
    it("should store and return the created character", async () => {
      mocks.api.post.mockResolvedValue(character);

      const created = await useAuthStore.getState().createCharacter({
        name: "Ghost",
        origin: "a_paraiso",
        role: "solo",
        attributes: { body: 5, reflexes: 5, intelligence: 4, technical: 4, cool: 4 },
      });

      expect(created).toEqual(character);
      expect(useAuthStore.getState().character).toEqual(character);
      expect(mocks.api.post).toHaveBeenCalledWith(
        "/api/characters",
        expect.objectContaining({ name: "Ghost", role: "solo" }),
      );
    });
  });

  describe("fetchNil", () => {
    it("should be a no-op without a character", async () => {
      await useAuthStore.getState().fetchNil();

      expect(mocks.api.get).not.toHaveBeenCalled();
      expect(useAuthStore.getState().nilLoading).toBe(false);
    });

    it("should store the live NIL readout", async () => {
      mocks.api.get.mockResolvedValue(nilStatus);
      useAuthStore.setState({ character });

      await useAuthStore.getState().fetchNil();

      expect(useAuthStore.getState().nilStatus).toEqual(nilStatus);
      expect(useAuthStore.getState().nilLoading).toBe(false);
      expect(useAuthStore.getState().nilError).toBeNull();
      expect(mocks.api.get).toHaveBeenCalledWith("/api/characters/me/nil");
    });

    it("should set nilError without throwing when the request fails", async () => {
      mocks.api.get.mockRejectedValue(
        new mocks.ApiError(503, "NIL_UNAVAILABLE", "NIL indisponível"),
      );
      useAuthStore.setState({ character });

      await expect(useAuthStore.getState().fetchNil()).resolves.toBeUndefined();

      expect(useAuthStore.getState().nilError).toBe("NIL indisponível");
      expect(useAuthStore.getState().nilLoading).toBe(false);
    });

    it("should fall back to a PT-BR message for non-ApiError failures", async () => {
      // Raw TypeError ("Failed to fetch") must never leak through to the UI.
      mocks.api.get.mockRejectedValue(new TypeError("Failed to fetch"));
      useAuthStore.setState({ character });

      await expect(useAuthStore.getState().fetchNil()).resolves.toBeUndefined();

      expect(useAuthStore.getState().nilError).toBe("Falha ao carregar NIL");
      expect(useAuthStore.getState().nilLoading).toBe(false);
    });
  });

  describe("useStim", () => {
    const stimResponse = {
      added: 20,
      status: { ...nilStatus, current: 100, regenerating: false, nextTickSeconds: 0 },
    };

    it("should apply the stim status and return the response", async () => {
      mocks.api.post.mockResolvedValue(stimResponse);

      const out = await useAuthStore.getState().useStim();

      expect(out).toEqual(stimResponse);
      expect(useAuthStore.getState().nilStatus).toEqual(stimResponse.status);
      expect(mocks.api.post).toHaveBeenCalledWith("/api/characters/me/nil/use-stim", {});
    });

    it("should set nilError and rethrow on cooldown/failure", async () => {
      mocks.api.post.mockRejectedValue(new mocks.ApiError(429, "COOLDOWN", "Em cooldown"));

      await expect(useAuthStore.getState().useStim()).rejects.toThrow("Em cooldown");

      expect(useAuthStore.getState().nilError).toBe("Em cooldown");
      expect(useAuthStore.getState().nilLoading).toBe(false);
    });
  });
});
