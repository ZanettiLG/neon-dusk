import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type {
  AuthResponse,
  Character,
  CreateCharacterRequest,
  LoginRequest,
  RegisterRequest,
  User,
  UserWithCharacter,
} from "@neon-dusk/shared";
import { api, ApiError, setAccessToken } from "@/api/client";

// Tokens persist across reloads so a refresh keeps the session alive.
const ACCESS_TOKEN_KEY = "nd_access_token";
const REFRESH_TOKEN_KEY = "nd_refresh_token";

export const useAuthStore = defineStore("auth", () => {
  const user = ref<User | null>(null);
  const character = ref<Character | null>(null);
  const accessToken = ref<string | null>(null);
  const refreshToken = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => accessToken.value !== null);
  const hasCharacter = computed(() => character.value !== null);
  const needsCharacter = computed(() => isAuthenticated.value && !hasCharacter.value);

  function applyAuth(res: AuthResponse): void {
    accessToken.value = res.accessToken;
    refreshToken.value = res.refreshToken;
    user.value = res.user;
    character.value = res.character;
    setAccessToken(res.accessToken);
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
  }

  function clearAuth(): void {
    accessToken.value = null;
    refreshToken.value = null;
    user.value = null;
    character.value = null;
    setAccessToken(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  async function login(input: LoginRequest): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      applyAuth(await api.post<AuthResponse>("/api/auth/login", input));
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Falha na conexão";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function register(input: RegisterRequest): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      applyAuth(await api.post<AuthResponse>("/api/auth/register", input));
    } catch (err) {
      error.value = err instanceof Error ? err.message : "Falha na conexão";
      throw err;
    } finally {
      loading.value = false;
    }
  }

  async function logout(): Promise<void> {
    const rt = refreshToken.value;
    try {
      // Revoke server-side; ignore failures so local logout always completes.
      if (rt) await api.post("/api/auth/logout", { refreshToken: rt });
    } catch {
      // no-op: session is being torn down anyway
    } finally {
      clearAuth();
    }
  }

  /** Rotate tokens. Returns false (and clears state) when the session is dead. */
  async function refresh(): Promise<boolean> {
    const rt = refreshToken.value ?? localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!rt) return false;
    try {
      applyAuth(await api.post<AuthResponse>("/api/auth/refresh", { refreshToken: rt }));
      return true;
    } catch {
      clearAuth();
      return false;
    }
  }

  async function fetchMe(): Promise<void> {
    const res = await api.get<UserWithCharacter>("/api/auth/me");
    user.value = res.user;
    character.value = res.character;
  }

  /** Restore tokens from localStorage and refresh the session on app start. */
  async function bootstrap(): Promise<void> {
    const at = localStorage.getItem(ACCESS_TOKEN_KEY);
    const rt = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!at || !rt) return;

    accessToken.value = at;
    refreshToken.value = rt;
    setAccessToken(at);

    try {
      await fetchMe();
    } catch (err) {
      // Only drop the session on auth failures (401); keep tokens on network errors.
      if (err instanceof ApiError && err.status === 401) clearAuth();
    }
  }

  async function createCharacter(input: CreateCharacterRequest): Promise<Character> {
    // POST /api/characters returns the Character directly (see server route).
    const created = await api.post<Character>("/api/characters", input);
    character.value = created;
    return created;
  }

  return {
    user,
    character,
    accessToken,
    refreshToken,
    loading,
    error,
    isAuthenticated,
    hasCharacter,
    needsCharacter,
    login,
    register,
    logout,
    refresh,
    fetchMe,
    bootstrap,
    createCharacter,
  };
});
