// Shared test setup: guarantee a fetch stub exists so components/stores never
// hit a real network during tests. Individual tests override global.fetch.
import { vi, beforeEach } from "vitest";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

// jsdom exposes a method-less `localStorage` object in this Node 22 + jsdom 25
// combo, but the auth store (and its views) persist tokens there. Provide a
// clean in-memory Storage per test, mirroring the fetch stub above.
const storage = new Map<string, string>();
const localStorageMock: Storage = {
  get length() {
    return storage.size;
  },
  key: (index: number) => Array.from(storage.keys())[index] ?? null,
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, String(value));
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
};

beforeEach(() => {
  storage.clear();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      jsonResponse({
        status: "ok",
        timestamp: new Date().toISOString(),
        uptime: 1,
        version: "0.1.0",
        services: { database: "connected", redis: "connected" },
      }),
    ),
  );
});
