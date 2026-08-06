// Shared test setup: guarantee a fetch stub exists so components/stores never
// hit a real network during tests. Individual tests override global.fetch.
import { vi, beforeEach } from "vitest";

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(() => {
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
