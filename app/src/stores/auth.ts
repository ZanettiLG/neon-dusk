import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api, ApiError, setAccessToken } from "@/api/client";
import type {
  AuthResponse,
  Character,
  CreateCharacterRequest,
  LoginRequest,
  NilStatus,
  NilStimResponse,
  RegisterRequest,
  User,
  UserWithCharacter,
} from "@neon-dusk/shared";

interface AuthState {
  // State
  user: User | null;
  character: Character | null;
  accessToken: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
  /** Set when bootstrap can't reach the backend (e.g. Redis down) — UI shows degraded state instead of dead-ends. */
  initializationError: string | null;
  nilStatus: NilStatus | null;
  nilLoading: boolean;
  nilError: string | null;

  // Actions
  applyAuth: (res: AuthResponse) => void;
  clearAuth: () => void;
  login: (input: LoginRequest) => Promise<void>;
  register: (input: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  fetchMe: () => Promise<void>;
  bootstrap: () => Promise<void>;
  createCharacter: (input: CreateCharacterRequest) => Promise<Character>;
  fetchNil: () => Promise<void>;
  useStim: () => Promise<NilStimResponse>;
}

/**
 * Global auth store (Zustand singleton). Tokens persist across reloads via the
 * persist middleware (partialized to tokens only) so a refresh keeps the
 * session alive; user/character are re-fetched on bootstrap.
 *
 * Selectors used by components (no getters in Zustand):
 * - isAuthenticated = !!accessToken
 * - hasCharacter = !!character
 * - needsCharacter = !!accessToken && !character
 * - nilPercent = nilStatus && nilStatus.max > 0
 *     ? Math.round((nilStatus.current / nilStatus.max) * 100) : 0
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      character: null,
      accessToken: null,
      refreshToken: null,
      loading: false,
      error: null,
      initializationError: null,
      nilStatus: null,
      nilLoading: false,
      nilError: null,

      applyAuth: (res) => {
        set({
          user: res.user,
          character: res.character,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
        });
        setAccessToken(res.accessToken);
      },

      clearAuth: () => {
        set({
          user: null,
          character: null,
          accessToken: null,
          refreshToken: null,
          initializationError: null,
          nilStatus: null,
          nilError: null,
        });
        setAccessToken(null);
        useAuthStore.persist.clearStorage();
      },

      login: async (input) => {
        set({ loading: true, error: null });
        try {
          get().applyAuth(await api.post<AuthResponse>("/api/auth/login", input));
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "Falha na conexão" });
          throw err;
        } finally {
          set({ loading: false });
        }
      },

      register: async (input) => {
        set({ loading: true, error: null });
        try {
          get().applyAuth(await api.post<AuthResponse>("/api/auth/register", input));
        } catch (err) {
          set({ error: err instanceof Error ? err.message : "Falha na conexão" });
          throw err;
        } finally {
          set({ loading: false });
        }
      },

      logout: async () => {
        const rt = get().refreshToken;
        try {
          // Revoke server-side; ignore failures so local logout always completes.
          if (rt) await api.post("/api/auth/logout", { refreshToken: rt });
        } catch {
          // no-op: session is being torn down anyway
        } finally {
          get().clearAuth();
        }
      },

      /** Rotate tokens. Returns false (and clears state) when the session is dead. */
      refresh: async () => {
        const rt = get().refreshToken;
        if (!rt) return false;
        try {
          get().applyAuth(await api.post<AuthResponse>("/api/auth/refresh", { refreshToken: rt }));
          return true;
        } catch {
          get().clearAuth();
          return false;
        }
      },

      fetchMe: async () => {
        const res = await api.get<UserWithCharacter>("/api/auth/me");
        set({ user: res.user, character: res.character, initializationError: null });
      },

      /** Restore tokens from localStorage and refresh the session on app start. */
      bootstrap: async () => {
        const { accessToken: at, refreshToken: rt } = get();
        if (!at || !rt) return;

        setAccessToken(at);

        try {
          await get().fetchMe();
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            get().clearAuth();
          } else {
            // Redis down or other transient failure — keep tokens but flag degradation.
            set({ initializationError: err instanceof Error ? err.message : "Serviço indisponível" });
          }
        }
      },

      createCharacter: async (input) => {
        // POST /api/characters returns the Character directly (see server route).
        const created = await api.post<Character>("/api/characters", input);
        set({ character: created });
        return created;
      },

      /** Fetch the live NIL readout (regen computed server-side, never writes). */
      fetchNil: async () => {
        if (!get().character) return;
        set({ nilLoading: true, nilError: null });
        try {
          set({ nilStatus: await api.get<NilStatus>("/api/characters/me/nil") });
        } catch (err) {
          set({ nilError: err instanceof ApiError ? err.message : "Falha ao carregar NIL" });
        } finally {
          set({ nilLoading: false });
        }
      },

      /** Drink a syn-café: +20 NIL with a 1h cooldown. Throws on cooldown/full. */
      useStim: async () => {
        set({ nilLoading: true, nilError: null });
        try {
          const res = await api.post<NilStimResponse>("/api/characters/me/nil/use-stim", {});
          set({ nilStatus: res.status });
          return res;
        } catch (err) {
          set({ nilError: err instanceof ApiError ? err.message : "Falha ao usar syn-café" });
          throw err;
        } finally {
          set({ nilLoading: false });
        }
      },
    }),
    {
      name: "nd_auth",
      // Only tokens persist — user/character are re-fetched on bootstrap.
      partialize: (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken }),
    },
  ),
);
