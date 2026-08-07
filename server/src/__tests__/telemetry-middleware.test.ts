import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import Redis from "ioredis";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json } from "./helpers";
import { db } from "../db";
import { gameEvents } from "../db/schema";

// ND-007 — telemetry onResponse middleware. The hook persists
// request.event_context into game_events fire-and-forget (setImmediate), so
// tests poll with a waitFor helper instead of asserting synchronously.
// Dedicated redis db (9) so rate-limit counters never leak across files.
// emitEvent is mocked with delegation so the "DB down" test can force a
// failure without breaking the persistence tests (mock restores to real calls).

vi.mock("../telemetry/emit-event", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../telemetry/emit-event")>();
  return {
    ...actual,
    emitEvent: vi.fn(actual.emitEvent),
  };
});

import { emitEvent } from "../telemetry/emit-event";

const REDIS_TEST_DB = "redis://localhost:56379/9";
const ACTOR_1 = "11111111-1111-4111-8111-111111111111";
const ACTOR_2 = "22222222-2222-4222-8222-222222222222";

async function waitFor(fn: () => Promise<boolean>, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("waitFor timed out");
}

describe("Telemetry middleware (fire-and-forget events)", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;

  beforeAll(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });

    // Test-only routes that attach event_context the way instrumented routes do.
    app.get("/api/_test/telemetry/t1", async (request, reply) => {
      request.event_context = {
        eventType: "GIG_COMPLETED",
        actorId: ACTOR_1,
        payload: { tier: "t1", outcome: "success" },
      };
      return reply.send({ ok: true });
    });
    app.get("/api/_test/telemetry/t2", async (request, reply) => {
      request.event_context = {
        eventType: "EDDIES_EARNED",
        actorId: ACTOR_2,
        payload: { amount: 500, source: "gig" },
      };
      return reply.send({ ok: true });
    });
    // Route with no event_context — the hook must be a no-op for it.
    app.get("/api/_test/telemetry/plain", async (_request, reply) => {
      return reply.send({ ok: true });
    });

    server = await startTestServer(app);
  });

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE game_events`);
  });

  afterAll(async () => {
    await app.close();
  });

  async function countEvents(): Promise<number> {
    const rows = await db.select({ id: gameEvents.id }).from(gameEvents);
    return rows.length;
  }

  it("should respond normally when event_context is set (fire-and-forget)", async () => {
    const res = await server.get("/api/_test/telemetry/t1");

    expect(res.status).toBe(200);
    expect(await json<{ ok: boolean }>(res)).toEqual({ ok: true });
  });

  it("should persist the event with type, actor and payload to game_events", async () => {
    await server.get("/api/_test/telemetry/t1");
    await waitFor(async () => (await countEvents()) === 1);

    const rows = await db.select().from(gameEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0].eventType).toBe("GIG_COMPLETED");
    expect(rows[0].actorId).toBe(ACTOR_1);
    expect(rows[0].payload).toEqual({ tier: "t1", outcome: "success" });
  });

  it("should persist multiple events with different types", async () => {
    await server.get("/api/_test/telemetry/t1");
    await server.get("/api/_test/telemetry/t2");
    await waitFor(async () => (await countEvents()) === 2);

    const rows = await db.select().from(gameEvents);
    expect(rows.map((r) => r.eventType).sort()).toEqual(["EDDIES_EARNED", "GIG_COMPLETED"]);
    const earned = rows.find((r) => r.eventType === "EDDIES_EARNED")!;
    expect(earned.actorId).toBe(ACTOR_2);
    expect(earned.payload).toEqual({ amount: 500, source: "gig" });
  });

  it("should not write an event when event_context is not set", async () => {
    const res = await server.get("/api/_test/telemetry/plain");

    expect(res.status).toBe(200);
    // Give any (incorrect) pending writes a chance to land, then assert none did.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(await countEvents()).toBe(0);
  });

  it("should not crash the response when DB is down during setImmediate", async () => {
    // Force emitEvent to fail — the onResponse hook must swallow the error
    // (fire-and-forget) and the response must already be 200 regardless.
    vi.mocked(emitEvent).mockRejectedValueOnce(new Error("connection refused"));
    try {
      const res = await server.get("/api/_test/telemetry/t1");
      expect(res.status).toBe(200);
      expect(await json<{ ok: boolean }>(res)).toEqual({ ok: true });
      expect(emitEvent).toHaveBeenCalled();
    } finally {
      vi.mocked(emitEvent).mockClear();
    }
    // No rows may have landed (the insert failed).
    expect(await countEvents()).toBe(0);
  });
});
