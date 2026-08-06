const BASE_URL: string = import.meta.env.VITE_API_BASE_URL || "";

// Abort requests that hang longer than this (e.g. a dead API with no RST).
const REQUEST_TIMEOUT_MS = 5000;

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BASE_URL}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

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
