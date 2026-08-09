import { useAuthStore } from "@/stores/auth";

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "";

/** Base URL for API calls — also used by EventSource (SSE) URLs. */
export const API_BASE_URL = BASE_URL;

// Abort requests that hang longer than this (e.g. a cold-start DB query).
const REQUEST_TIMEOUT_MS = 15_000;

// Access token for the Authorization header. Set by the auth store whenever
// tokens change; kept here so this module has no hard dependency on React.
let accessToken: string | null = null;

/** Update the bearer token used by the api client (call from the auth store). */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// In-flight GET deduplication — multiple components mounting simultaneously
// shouldn't fire identical requests.
const _inFlight = new Map<string, Promise<unknown>>();

// Single in-flight refresh so concurrent 401s trigger one refresh call.
// Zustand stores are singletons; getState() reads state outside React, so the
// client → store → client cycle resolves at call time, not import time.
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      return useAuthStore.getState().refresh();
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request<T>(method: string, path: string, body?: unknown, isRetry = false): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include",
      signal: controller.signal,
    });

    // Some error responses carry no JSON body; treat that as an opaque failure.
    const data: unknown = await response.json().catch(() => null);

    // Access token expired: try one refresh + retry before giving up.
    if (response.status === 401 && !isRetry && accessToken) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request<T>(method, path, body, true);
      }
    }

    if (!response.ok) {
      const errBody = data as { error?: string; message?: string; details?: unknown } | null;
      const code = errBody?.error || "UNKNOWN_ERROR";
      const rawMessage = errBody?.message || "Erro inesperado.";
      throw new ApiError(
        response.status,
        code,
        ptBrError(code, rawMessage),
        errBody?.details,
      );
    }

    return data as T;
  } catch (err) {
    // AbortError from the AbortController timeout — the server may have already
    // counted this request. Don't retry; surface as a distinct error code.
    if ((err instanceof Error && err.name === 'AbortError') || (err instanceof DOMException && err.name === 'AbortError')) {
      throw new ApiError(408, 'TIMEOUT', ptBrError('TIMEOUT', 'Requisição expirou. O servidor pode já ter processado.'));
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/** Human-readable PT-BR messages for server error codes. */
const PT_BR_ERRORS: Record<string, string> = {
  // Auth
  UNAUTHORIZED: "Sessão expirada. Faça login novamente.",
  INVALID_CREDENTIALS: "E-mail ou senha inválidos.",
  INVALID_REFRESH_TOKEN: "Sessão expirada. Faça login novamente.",
  FORBIDDEN: "Acesso negado.",
  EMAIL_TAKEN: "Este e-mail já está cadastrado.",

  // Validation
  VALIDATION_ERROR: "Dados inválidos. Verifique os campos.",

  // Character
  NO_CHARACTER: "Nenhum personagem vinculado a esta conta.",
  CHARACTER_NOT_FOUND: "Personagem não encontrado.",
  CHARACTER_EXISTS: "Você já possui um personagem.",
  NAME_TAKEN: "Este codinome já está em uso.",
  INVALID_ATTRIBUTES: "Distribuição de atributos inválida.",

  // Economy
  INSUFFICIENT_FUNDS: "Eds insuficientes.",
  OUT_OF_STOCK: "Item fora de estoque.",
  VENDOR_NOT_FOUND: "Vendedor não encontrado.",
  ITEM_NOT_FOUND: "Item não encontrado.",
  INVALID_QUANTITY: "Quantidade inválida.",
  WALLET_CREATE_FAILED: "Erro ao criar carteira.",

  // NIL
  INSUFFICIENT_NIL: "NIL insuficiente.",
  NIL_STIM_COOLDOWN: "Syn-café em cooldown. Aguarde.",
  NIL_FULL: "NIL já está cheio.",
  NIL_CONCURRENT_MODIFICATION: "NIL foi modificado por outra ação. Tente novamente.",

  // Chrome
  CHROME_NOT_FOUND: "Implante não encontrado.",
  ALREADY_INSTALLED: "Este implante já está instalado.",
  SLOT_FULL: "Slot de chrome ocupado.",
  HUMANITY_TOO_LOW: "Humanidade insuficiente para este implante.",
  INSTALLED_CHROME_NOT_FOUND: "Implante instalado não encontrado.",

  // Gigs
  GIG_NOT_FOUND: "Gig não encontrado.",
  NO_ACTIVE_GIG: "Você não tem gig ativo.",
  ALREADY_ACTIVE_GIG: "Você já tem um gig ativo.",
  INSUFFICIENT_STATS: "Atributos insuficientes para este gig.",
  GIG_COOLDOWN: "Este gig está em cooldown.",
  DAILY_GIG_LIMIT: "Limite diário de gigs atingido.",
  INVALID_PHASE_TRANSITION: "Transição de fase inválida.",
  GIG_MISMATCH: "Este gig não pertence a você.",

  // PvP
  CANNOT_ATTACK_SELF: "Você não pode atacar a si mesmo.",
  TARGET_NOT_FOUND: "Alvo não encontrado.",
  TARGET_IMMUNE: "Alvo está imune a PvP.",
  PVP_COOLDOWN: "Cooldown de PvP ativo. Aguarde.",
  POWER_RANGE_EXCEEDED: "Poder do alvo fora do alcance.",

  // Anti-cheat
  RATE_LIMITED: "Muitas requisições. Aguarde.",
  COOLDOWN_ACTIVE: "Ação em cooldown. Aguarde.",
  CIRCUIT_BREAK: "Sistema neural sobrecarregado. Retorne em algumas horas.",

  // Concurrency
  CONCURRENCY_CONFLICT: "Conflito de concorrência. Tente novamente.",

  // Request
  TIMEOUT: "Requisição expirou. O servidor pode já ter processado.",

  // Round
  NO_ACTIVE_ROUND: "Não há rodada ativa.",

  // Crew
  CREW_NOT_FOUND: "Crew não encontrada.",
  ALREADY_IN_CREW: "Você já está em uma crew.",

  // Infra
  INTERNAL_ERROR: "Erro interno. Tente novamente.",
  SERVICE_UNAVAILABLE: "Serviço temporariamente indisponível.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  NOT_FOUND: "Não encontrado.",
  INVALID_CREW_STATE: "Estado inválido da crew.",
  LEADER_CANNOT_LEAVE: "Líder não pode sair da crew. Dissolva-a primeiro.",
  ADMIN_RATE_LIMITED: "Muitas requisições. Aguarde.",
};

/** Translate an error code to a PT-BR message. Falls back to the original message. */
export function ptBrError(code: string, originalMessage: string): string {
  return PT_BR_ERRORS[code] ?? originalMessage;
}

export const api = {
  get: <T>(path: string) => {
    const key = `GET:${path}`;
    const existing = _inFlight.get(key);
    if (existing) return existing as Promise<T>;
    const promise = request<T>("GET", path).finally(() => {
      _inFlight.delete(key);
    });
    _inFlight.set(key, promise);
    return promise;
  },
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
