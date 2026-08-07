import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json } from "./helpers";
import { db } from "../db";
import { gameEvents } from "../db/schema";
import type { AdminMetricsResponse } from "@neon-dusk/shared";

// ND-007 — admin telemetry digest endpoint. Real HTTP against the app.
// Dedicated redis db (8) so rate-limit counters never leak across files.

const REDIS_TEST_DB = "redis://localhost:56379/8";
const ADMIN_KEY = process.env.ADMIN_API_KEY!; // set in setup.ts
const WRONG_KEY = "a".repeat(40);

interface ErrorBody {
  error: string;
  message: string;
}

describe("GET /api/admin/metrics (admin telemetry digest)", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
  });

  beforeEach(async () => {
    // resetDb() doesn't truncate the append-only event log — clear it here so
    // counts never leak from other files or prior tests in this file.
    await db.execute(sql`TRUNCATE TABLE game_events`);
  });

  afterAll(async () => {
    await app.close();
  });

  function adminGet(path: string, key?: string): Promise<Response> {
    return fetch(`${base()}${path}`, {
      headers: key === undefined ? {} : { "x-api-key": key },
    });
  }

  it("should return 401 when the x-api-key header is missing", async () => {
    const res = await adminGet("/api/admin/metrics");

    expect(res.status).toBe(401);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("should return 401 when the x-api-key header is wrong", async () => {
    const res = await adminGet("/api/admin/metrics", WRONG_KEY);

    expect(res.status).toBe(401);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("should return 200 with a valid x-api-key", async () => {
    const res = await adminGet("/api/admin/metrics", ADMIN_KEY);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
  });

  it("should return the AdminMetricsResponse shape with expected keys", async () => {
    const res = await adminGet("/api/admin/metrics", ADMIN_KEY);
    const body = await json<AdminMetricsResponse>(res);

    expect(typeof body.timestamp).toBe("string");
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();

    expect(body.events).toHaveProperty("last24h");
    expect(body.events).toHaveProperty("last1h");
    expect(body.events.last24h).toEqual({});
    expect(body.events.last1h).toEqual({});

    expect(body.economy).toMatchObject({
      eddiesEarned24h: 0,
      eddiesSpent24h: 0,
      nilSpent24h: 0,
    });
    expect(body.activity).toMatchObject({
      activeCharacters24h: 0,
      gigsCompleted24h: 0,
      gigsFailed24h: 0,
      pvpAttacks24h: 0,
    });
  });

  it("should aggregate seeded game events into the digest", async () => {
    await db.insert(gameEvents).values([
      { eventType: "GIG_COMPLETED", actorId: "11111111-1111-4111-8111-111111111111", payload: {} },
      { eventType: "GIG_COMPLETED", actorId: "22222222-2222-4222-8222-222222222222", payload: {} },
      { eventType: "EDDIES_EARNED", actorId: "11111111-1111-4111-8111-111111111111", payload: {} },
      { eventType: "NIL_SPENT", actorId: "22222222-2222-4222-8222-222222222222", payload: {} },
      { eventType: "PVP_ATTACK", actorId: "11111111-1111-4111-8111-111111111111", payload: {} },
    ]);

    const res = await adminGet("/api/admin/metrics", ADMIN_KEY);
    const body = await json<AdminMetricsResponse>(res);

    // All events are fresh (createdAt defaults to now) → same counts in both windows.
    expect(body.events.last24h).toEqual({
      GIG_COMPLETED: 2,
      EDDIES_EARNED: 1,
      NIL_SPENT: 1,
      PVP_ATTACK: 1,
    });
    expect(body.events.last1h).toEqual(body.events.last24h);

    expect(body.economy).toMatchObject({
      eddiesEarned24h: 1,
      eddiesSpent24h: 0,
      nilSpent24h: 1,
    });
    expect(body.activity).toMatchObject({
      activeCharacters24h: 2, // distinct actors
      gigsCompleted24h: 2,
      gigsFailed24h: 0,
      pvpAttacks24h: 1,
    });
  });
});
