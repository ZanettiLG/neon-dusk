import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { env } from "../env";
import { startTestServer } from "./helpers";

describe("app factory", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    app = await buildApp({ env });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should boot without crashing", () => {
    expect(app).toBeDefined();
    expect(app.ready).toBeDefined();
  });

  it("should send CORS headers on API responses", async () => {
    // ND-018: CORS_ORIGIN é multi-origin — a whitelist ecoa a Origin da
    // request quando permitida (browser sempre envia Origin em cross-origin).
    const res = await server.get("/api/health", { Origin: "http://localhost:5173" });

    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("should not set allow-origin for a disallowed origin", async () => {
    const res = await server.get("/api/health", { Origin: "http://evil.example" });

    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("should respond with application/json content type", async () => {
    const res = await server.get("/api/health");

    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toBeTypeOf("object");
  });

  it("should shut down gracefully via close()", async () => {
    const testApp = await buildApp({ env });
    await expect(testApp.close()).resolves.toBeUndefined();
  });
});
