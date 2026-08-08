import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { env } from "../env";
import { startTestServer, json, type HealthBody } from "./helpers";

describe("GET /api/health", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    app = await buildApp({ env });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 200 with the documented response shape", async () => {
    const res = await server.get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);

    const body = await json<HealthBody>(res);
    expect(body.status).toBe("ok");
    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
    expect(typeof body.uptime).toBe("number");
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.version).toBe("0.1.0");
    expect(body.services).toEqual({
      database: "connected",
      redis: "connected",
    });
  });

  it("should stay reachable when hammered (health bypasses the rate limiter)", async () => {
    // ND-053: /api/health is registered BEFORE the rate-limit plugin so it
    // stays reachable when Redis is down — it must never return 429.
    for (let i = 0; i < 20; i++) {
      const res = await server.get("/api/health");
      expect(res.status).toBe(200);
    }
  });

  it("should return 404 JSON for unknown routes", async () => {
    const res = await server.get("/api/nonexistent-route");

    expect(res.status).toBe(404);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    const body = await json<{ message: string }>(res);
    expect(body).toHaveProperty("message");
    expect(body.message).toContain("Route");
  });
});
