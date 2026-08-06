import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { env } from "../env";
import { startTestServer, json, type HealthBody } from "./helpers";

// Mock the DB module BEFORE importing the app — the health route imports `db`
// from "../db" and calls `db.execute(...)`. Forcing it to throw simulates a
// disconnected database so the endpoint reports "degraded".
vi.mock("../db", () => ({
  db: {
    execute: vi.fn().mockRejectedValue(new Error("connection refused")),
  },
}));

describe("GET /api/health — degraded services", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    app = await buildApp({ env });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 503 with status 'degraded' when the database is unreachable", async () => {
    const res = await server.get("/api/health");

    expect(res.status).toBe(503);
    const body = await json<HealthBody>(res);
    expect(body.status).toBe("degraded");
    expect(body.services.database).toBe("disconnected");
    expect(["connected", "disconnected"]).toContain(body.services.redis);
    // Shape is still the documented health response
    expect(typeof body.timestamp).toBe("string");
    expect(body.version).toBe("0.1.0");
  });
});
