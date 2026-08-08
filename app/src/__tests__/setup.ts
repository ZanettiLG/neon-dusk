// Shared test setup: guarantee a fetch stub exists so components/stores never
// hit a real network during tests. Individual tests override global.fetch.
import { vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";

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

// Stub localStorage at module scope, NOT in beforeEach: zustand's persist
// middleware captures the storage object when the store module is first
// imported (before any test's beforeEach runs), and jsdom 25's own
// localStorage is method-less in this Node combo. The Map is cleared per test.
vi.stubGlobal("localStorage", localStorageMock);

beforeEach(() => {
  storage.clear();
  // jsdom doesn't implement scrollIntoView; chat panels call it on mount.
  Element.prototype.scrollIntoView = vi.fn();
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

// vitest runs with globals:false, so @testing-library/react can't auto-register
// its afterEach cleanup. Unmount between tests to avoid leaked DOM/timers.
afterEach(() => {
  cleanup();
});
