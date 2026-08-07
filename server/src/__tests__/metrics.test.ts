import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer } from "./helpers";

// ND-007 — Prometheus scrape endpoint tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack). Dedicated redis db
// (7) so rate-limit counters never leak across files.

const REDIS_TEST_DB = "redis://localhost:56379/7";

describe("GET /metrics (Prometheus scrape)", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    // The active_characters gauge scans the env redis (db 0, from setup.ts).
    // Wipe leftover auth:active:* keys so the gauge deterministically reports 0
    // regardless of which test files ran before this one in the shared fork.
    const envRedis = new Redis(process.env.REDIS_URL!, { lazyConnect: true });
    await envRedis.connect();
    const stale = await envRedis.keys("auth:active:*");
    if (stale.length > 0) await envRedis.del(...stale);
    envRedis.disconnect();

    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it("should return 200 with text/plain content-type when scraped", async () => {
    const res = await server.get("/metrics");

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
  });

  it("should return valid Prometheus text format (HELP/TYPE + sample lines)", async () => {
    const body = await (await server.get("/metrics")).text();

    expect(body).toMatch(/# HELP neondusk_active_characters .+/);
    expect(body).toMatch(/# TYPE neondusk_active_characters gauge/);
    expect(body).toMatch(/^neondusk_active_characters\s+\d+(\.\d+)?$/m);
  });

  it("should expose all required telemetry metrics", async () => {
    const body = await (await server.get("/metrics")).text();

    for (const name of [
      "neondusk_nil_spent_total",
      "neondusk_eddies_earned_total",
      "neondusk_eddies_spent_total",
      "neondusk_gigs_completed_total",
      "neondusk_pvp_attacks_total",
    ]) {
      expect(body).toContain(`# HELP ${name} `);
      expect(body).toContain(`# TYPE ${name} counter`);
    }
  });

  it("should report the active_characters gauge even when no users are active", async () => {
    const body = await (await server.get("/metrics")).text();

    // 0 active users → gauge line present with value 0, not absent.
    expect(body).toMatch(/^neondusk_active_characters\s+0(\.0)?$/m);
  });

  it("should not require authentication (public scrape endpoint)", async () => {
    const res = await server.get("/metrics");

    expect(res.status).toBe(200);
  });
});
