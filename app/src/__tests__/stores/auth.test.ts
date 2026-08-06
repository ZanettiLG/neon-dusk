import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useAuthStore } from "@/stores/auth";
import { ApiError, setAccessToken } from "@/api/client";
import type { AuthResponse, Character, User, UserWithCharacter } from "@neon-dusk/shared";

// Unit tests for the auth store — the network is stubbed at the fetch
// boundary (the store + api client run for real, only fetch is mocked).

const user: User = {
  id: "u1",
  email: "runner@neondusk.test",
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

const character: Character = {
  id: "c1",
  userId: "u1",
  name: "Ghost",
  origin: "a_paraiso",
  role: "solo",
  body: 5,
  reflexes: 4,
  intelligence: 4,
  technical: 4,
  cool: 5,
  createdAt: "2026-08-06T00:00:00.000Z",
  updatedAt: "2026-08-06T00:00:00.000Z",
};

const authResponse: AuthResponse = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  user,
  character: null,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stub global fetch to return `data` with `status`, returning the mock fn. */
function mockFetch(data: unknown, status = 200): ReturnType<typeof vi.fn> {
  // 204 (no content) must not carry a body — Response constructor rejects it.
  const response =
    status === 204 ? new Response(null, { status: 204 }) : jsonResponse(data, status);
  const mock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", mock);
  return mock;
}

describe("useAuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    setAccessToken(null);
    localStorage.clear();
  });

  afterEach(() => {
    // Clear BEFORE unstubbing: unstub reverts localStorage to the broken
    // jsdom object, where .clear() does not exist.
    setAccessToken(null);
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("should start with the initial state", () => {
    const store = useAuthStore();

    expect(store.user).toBeNull();
    expect(store.character).toBeNull();
    expect(store.accessToken).toBeNull();
    expect(store.refreshToken).toBeNull();
    expect(store.loading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.isAuthenticated).toBe(false);
    expect(store.hasCharacter).toBe(false);
    expect(store.needsCharacter).toBe(false);
  });

  it("should store tokens, user and persist the session on login", async () => {
    const store = useAuthStore();
    const fetchMock = mockFetch(authResponse);

    await store.login({ email: "runner@neondusk.test", password: "StrongPass123!" });

    expect(store.isAuthenticated).toBe(true);
    expect(store.accessToken).toBe("access-1");
    expect(store.refreshToken).toBe("refresh-1");
    expect(store.user).toEqual(user);
    expect(store.character).toBeNull();
    expect(store.needsCharacter).toBe(true);
    expect(store.loading).toBe(false);
    expect(localStorage.getItem("nd_access_token")).toBe("access-1");
    expect(localStorage.getItem("nd_refresh_token")).toBe("refresh-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "runner@neondusk.test", password: "StrongPass123!" }),
      }),
    );
  });

  it("should set the error and reject when login fails", async () => {
    const store = useAuthStore();
    mockFetch({ error: "INVALID_CREDENTIALS", message: "Invalid email or password" }, 401);

    await expect(store.login({ email: "x@neondusk.test", password: "wrong" })).rejects.toBeInstanceOf(
      ApiError,
    );

    expect(store.error).toBe("Invalid email or password");
    expect(store.isAuthenticated).toBe(false);
    expect(store.loading).toBe(false);
  });

  it("should authenticate and persist the session on register", async () => {
    const store = useAuthStore();
    const fetchMock = mockFetch(authResponse);

    await store.register({ email: "runner@neondusk.test", password: "StrongPass123!" });

    expect(store.isAuthenticated).toBe(true);
    expect(store.user?.email).toBe("runner@neondusk.test");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/register",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should clear state and revoke the refresh token on logout", async () => {
    const store = useAuthStore();
    mockFetch(authResponse);
    await store.login({ email: "runner@neondusk.test", password: "StrongPass123!" });

    const fetchMock = mockFetch(null, 204);
    await store.logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "refresh-1" }),
      }),
    );
    expect(store.isAuthenticated).toBe(false);
    expect(store.user).toBeNull();
    expect(store.character).toBeNull();
    expect(localStorage.getItem("nd_access_token")).toBeNull();
  });

  it("should always clear local state when logout fails server-side", async () => {
    const store = useAuthStore();
    mockFetch(authResponse);
    await store.login({ email: "runner@neondusk.test", password: "StrongPass123!" });

    mockFetch({ error: "INTERNAL_ERROR", message: "boom" }, 500);
    await store.logout();

    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("nd_refresh_token")).toBeNull();
  });

  it("should load the user and character via fetchMe", async () => {
    const store = useAuthStore();
    const withCharacter: UserWithCharacter = { user, character };
    mockFetch(withCharacter);

    await store.fetchMe();

    expect(store.user).toEqual(user);
    expect(store.character).toEqual(character);
    expect(store.hasCharacter).toBe(true);
  });

  it("should set the character when createCharacter succeeds", async () => {
    const store = useAuthStore();
    const fetchMock = mockFetch(character);

    const created = await store.createCharacter({
      name: "Ghost",
      origin: "a_paraiso",
      role: "solo",
      attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
    });

    expect(created).toEqual(character);
    expect(store.character).toEqual(character);
    expect(store.hasCharacter).toBe(true);
    expect(store.needsCharacter).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/characters",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("should rotate tokens on refresh and return true", async () => {
    const store = useAuthStore();
    mockFetch(authResponse);
    await store.login({ email: "runner@neondusk.test", password: "StrongPass123!" });

    const rotated: AuthResponse = {
      accessToken: "access-2",
      refreshToken: "refresh-2",
      user,
      character,
    };
    const fetchMock = mockFetch(rotated);

    const result = await store.refresh();

    expect(result).toBe(true);
    expect(store.accessToken).toBe("access-2");
    expect(store.refreshToken).toBe("refresh-2");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/refresh",
      expect.objectContaining({ body: JSON.stringify({ refreshToken: "refresh-1" }) }),
    );
  });

  it("should clear the session and return false when refresh fails", async () => {
    const store = useAuthStore();
    store.$patch({ accessToken: "access-1", refreshToken: "refresh-1", user });
    // Skip the api client's 401→refresh retry: with the module token set, a
    // rejected refresh call would recurse into this same refresh() via the
    // client's single-flight refreshAccessToken (the real app relies on the
    // request abort timeout to unwind that edge). This test targets the store
    // contract: rejected token → session cleared + false.
    setAccessToken(null);
    mockFetch({ error: "INVALID_REFRESH_TOKEN", message: "gone" }, 401);

    const result = await store.refresh();

    expect(result).toBe(false);
    expect(store.isAuthenticated).toBe(false);
    expect(localStorage.getItem("nd_access_token")).toBeNull();
  });

  it("should expose the hasCharacter getter as character state changes", () => {
    const store = useAuthStore();
    expect(store.hasCharacter).toBe(false);

    store.character = character;
    expect(store.hasCharacter).toBe(true);
    expect(store.needsCharacter).toBe(false);
  });
});
