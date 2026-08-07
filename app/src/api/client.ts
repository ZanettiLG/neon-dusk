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
      throw new ApiError(
        response.status,
        errBody?.error || "UNKNOWN_ERROR",
        errBody?.message || "Request failed",
        errBody?.details,
      );
    }

    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};
