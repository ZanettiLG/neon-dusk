import { useAuthStore } from "@/stores/auth";

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "";

/** Base URL for API calls — also used by EventSource (SSE) URLs. */
export const API_BASE_URL = BASE_URL;

// Abort requests that hang longer than this (e.g. a dead API with no RST).
const REQUEST_TIMEOUT_MS = 5000;

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

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  isRetry = false,
): Promise<T> {
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
      throw new ApiError(response.status, code, ptBrError(code, rawMessage), errBody?.details);
    }

    return data as T;
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
  INSUFFICIENT_FUNDS: "Grana insuficiente.",
  OUT_OF_STOCK: "Item fora de estoque.",
  VENDOR_NOT_FOUND: "Vendedor não encontrado.",
  ITEM_NOT_FOUND: "Item não encontrado.",
  INVALID_QUANTITY: "Quantidade inválida.",
  WALLET_CREATE_FAILED: "Erro ao criar carteira.",

  // NIL
  INSUFFICIENT_NIL: "NIL insuficiente.",
  NIL_FULL: "NIL já está cheio.",
  NIL_CONCURRENT_MODIFICATION: "NIL foi modificado por outra ação. Tente novamente.",

  // Cromo
  CHROME_NOT_FOUND: "Implante não encontrado.",
  ALREADY_INSTALLED: "Este implante já está instalado.",
  SLOT_FULL: "Slot de cromo ocupado.",
  HUMANITY_TOO_LOW: "Humanidade insuficiente para este implante.",
  INSTALLED_CHROME_NOT_FOUND: "Implante instalado não encontrado.",
  OS_ALREADY_INSTALLED: "Você já tem um SO instalado nesta rodada.",
  OS_PERMANENT: "O SO é permanente por rodada. Troque no reset.",

  // OS / Humanidade / Terapia (issue #28)
  NO_OS_INSTALLED: "Nenhum SO instalado. Visite um ferrageiro.",
  OS_INERT: "Este SO não tem habilidade ativa nesta rodada.",
  OS_ALREADY_ACTIVE: "O efeito do SO já está ativo.",
  OS_NO_USES_LEFT: "Sem ativações restantes hoje. Reset à meia-noite UTC.",
  FLATLINED: "Personagem apagado. Sem ações permitidas.",
  INSUFFICIENT_EDDIES: "Grana insuficiente.",

  // Itens anti-insanidade (issue #28)
  CONSUMABLE_NOT_FOUND: "Item não encontrado.",
  NOT_OWNED: "Você não tem este item no inventário.",
  BAND_TOO_HIGH: "Sua humanidade está alta demais para isso (máx. 70).",
  DIMINISHING_RETURNS_EXHAUSTED: "Máximo de 3 usos por 24h atingido.",

  // Trampos
  GIG_NOT_FOUND: "Trampo não encontrado.",
  NO_ACTIVE_GIG: "Você não tem trampo ativo.",
  ALREADY_ACTIVE_GIG: "Você já tem um trampo ativo.",
  INSUFFICIENT_STATS: "Atributos insuficientes para este trampo.",
  GIG_COOLDOWN: "Este trampo está em cooldown.",
  INVALID_PHASE_TRANSITION: "Transição de fase inválida.",
  GIG_MISMATCH: "Este trampo não pertence a você.",

  // PvP
  CANNOT_ATTACK_SELF: "Você não pode atacar a si mesmo.",
  TARGET_NOT_FOUND: "Alvo não encontrado.",
  TARGET_IMMUNE: "Alvo está imune a PvP.",
  POWER_RANGE_EXCEEDED: "Poder do alvo fora do alcance.",

  // Anti-cheat
  RATE_LIMITED: "Muitas requisições. Aguarde.",
  COOLDOWN_ACTIVE: "Ação em cooldown. Aguarde.",
  CIRCUIT_BREAK: "Sistema neural sobrecarregado. Retorne em algumas horas.",

  // Concurrency
  CONCURRENCY_CONFLICT: "Conflito de concorrência. Tente novamente.",

  // Round
  NO_ACTIVE_ROUND: "Não há rodada ativa.",

  // Crew
  CREW_NOT_FOUND: "Bonde não encontrado.",
  ALREADY_IN_CREW: "Você já está em um bonde.",

  // Infra
  INTERNAL_ERROR: "Erro interno. Tente novamente.",
  SERVICE_UNAVAILABLE: "Serviço temporariamente indisponível.",
  USER_NOT_FOUND: "Usuário não encontrado.",
  NOT_FOUND: "Não encontrado.",
  INVALID_CREW_STATE: "Estado inválido do bonde.",
  LEADER_CANNOT_LEAVE: "Líder não pode sair do bonde. Dissolva-o primeiro.",
  ADMIN_RATE_LIMITED: "Muitas requisições. Aguarde.",
};

/** Translate an error code to a PT-BR message. Falls back to the original message. */
export function ptBrError(code: string, originalMessage: string): string {
  return PT_BR_ERRORS[code] ?? originalMessage;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
