import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb } from "./helpers";
import { db } from "../db";
import type { AuthResponse, CharacterEventsResponse, GameEventType } from "@neon-dusk/shared";

// ND-139 — GET /api/characters/me/events integration tests: auth guard,
// character guard, query validation, actor isolation and cursor pagination
// end-to-end over real HTTP. Dedicated redis db (16) so rate-limit counters
// never leak across files.

const REDIS_TEST_DB = "redis://localhost:56379/16";
const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `events-${Date.now()}-${seq++}@neondusk.test`;
}

/** Valid attribute spread: 3 base × 5 + 7 free points = 22. */
function validAttributes() {
  return { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 };
}

interface ErrorBody {
  error: string;
  message: string;
  details?: unknown;
}

describe("GET /api/characters/me/events (player event feed)", () => {
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

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await resetDb();
    // game_events is FK-less on actor_id, so resetDb's TRUNCATE CASCADE does
    // not clear it — wipe it here so counts never leak across tests.
    await db.raw("TRUNCATE TABLE game_events");
  });

  /** Register a fresh account, returning the access token + user id. */
  async function registerUser(email: string): Promise<{ accessToken: string; userId: string }> {
    const res = await server.post("/api/auth/register", { email, password: PASSWORD });
    expect(res.status).toBe(201);
    const body = await json<AuthResponse>(res);
    return { accessToken: body.accessToken, userId: body.user.id };
  }

  /** Register + create a character via HTTP, returning token + character id. */
  async function registerAndCreateCharacter(
    email: string,
  ): Promise<{ accessToken: string; characterId: string }> {
    const { accessToken, userId } = await registerUser(email);
    const created = await fetch(`${base()}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify({
        name: `Corredor-${Date.now().toString(36)}-${seq++}`,
        origin: "a_paraiso",
        role: "bicho",
        attributes: validAttributes(),
      }),
    });
    expect(created.status).toBe(201);
    const [character] = await db("characters").select("id").where("user_id", userId);
    return { accessToken, characterId: character.id };
  }

  async function seedEvent(
    characterId: string,
    eventType: GameEventType,
    createdAt: string,
    payload: Record<string, unknown> = {},
  ): Promise<void> {
    await db("game_events").insert({
      event_type: eventType,
      actor_id: characterId,
      payload,
      created_at: new Date(createdAt),
    });
  }

  function getEvents(accessToken: string, query = ""): Promise<Response> {
    return fetch(`${base()}/api/characters/me/events${query}`, {
      headers: authHeader(accessToken),
    });
  }

  it("should return 401 without an access token", async () => {
    const res = await server.get("/api/characters/me/events");

    expect(res.status).toBe(401);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("UNAUTHORIZED");
  });

  it("should return 404 NO_CHARACTER when the user has no character", async () => {
    const { accessToken } = await registerUser(uniqueEmail());

    const res = await getEvents(accessToken);

    expect(res.status).toBe(404);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("NO_CHARACTER");
  });

  it("should return 400 VALIDATION_ERROR when limit is out of 1..50", async () => {
    const { accessToken } = await registerUser(uniqueEmail());

    for (const bad of ["0", "51", "-1", "1.5", "abc"]) {
      const res = await getEvents(accessToken, `?limit=${bad}`);
      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    }
  });

  it("should return 400 VALIDATION_ERROR for a malformed cursor", async () => {
    const { accessToken } = await registerUser(uniqueEmail());

    const res = await getEvents(accessToken, "?cursor=not-an-iso-timestamp");

    expect(res.status).toBe(400);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("should return 400 VALIDATION_ERROR (not 500) for an impossible calendar date cursor", async () => {
    const { accessToken } = await registerUser(uniqueEmail());

    // 2026-99-99 passes a naive prefix regex but is not a real date — semantic
    // validation must reject it before `new Date(cursor)` can throw.
    const res = await getEvents(accessToken, `?cursor=${encodeURIComponent("2026-99-99T12:00:00Z")}`);

    expect(res.status).toBe(400);
    const body = await json<ErrorBody>(res);
    expect(body.error).toBe("VALIDATION_ERROR");
  });

  it("should return only the character's own events, newest first, with mapped severity", async () => {
    const a = await registerAndCreateCharacter(uniqueEmail());
    const b = await registerAndCreateCharacter(uniqueEmail());
    await seedEvent(a.characterId, "GIG_COMPLETED", "2026-08-01T10:00:00.000Z", {
      gigName: "Corre da Farmácia",
      payout: 550,
    });
    await seedEvent(a.characterId, "NIL_SPENT", "2026-08-02T10:00:00.000Z", { amount: 20 });
    await seedEvent(a.characterId, "GIG_FAILED", "2026-08-03T10:00:00.000Z", {});
    // B's event is newer than all of A's — it must never leak into A's feed.
    await seedEvent(b.characterId, "EDDIES_EARNED", "2026-08-04T10:00:00.000Z", { amount: 999 });

    const res = await getEvents(a.accessToken);

    expect(res.status).toBe(200);
    const body = await json<CharacterEventsResponse>(res);
    expect(body.events).toHaveLength(3);
    expect(body.nextCursor).toBeNull(); // 3 rows < default limit 20

    // Newest first.
    expect(body.events.map((e) => e.eventType)).toEqual(["GIG_FAILED", "NIL_SPENT", "GIG_COMPLETED"]);

    // Full CharacterEvent shape + severity per the source-of-truth mapping.
    expect(body.events[0]).toMatchObject({
      eventType: "GIG_FAILED",
      severity: "danger",
      payload: {},
    });
    expect(body.events[1]).toMatchObject({ eventType: "NIL_SPENT", severity: "warning" });
    expect(body.events[2]).toMatchObject({
      eventType: "GIG_COMPLETED",
      severity: "success",
      payload: { gigName: "Corre da Farmácia", payout: 550 },
    });
    for (const event of body.events) {
      expect(typeof event.id).toBe("string");
      expect(typeof event.createdAt).toBe("string");
      expect(new Date(event.createdAt).getTime()).not.toBeNaN();
    }
    // No cross-character leakage.
    expect(body.events.some((e) => e.eventType === "EDDIES_EARNED")).toBe(false);
  });

  it("should paginate with the cursor end-to-end (two pages, no overlap)", async () => {
    const { accessToken, characterId } = await registerAndCreateCharacter(uniqueEmail());
    const times = [
      "2026-08-01T10:00:00.000Z",
      "2026-08-02T10:00:00.000Z",
      "2026-08-03T10:00:00.000Z",
      "2026-08-04T10:00:00.000Z",
      "2026-08-05T10:00:00.000Z",
    ];
    for (const t of times) {
      await seedEvent(characterId, "EDDIES_EARNED", t, { amount: 100 });
    }

    const page1 = await getEvents(accessToken, "?limit=2");
    expect(page1.status).toBe(200);
    const body1 = await json<CharacterEventsResponse>(page1);
    expect(body1.events.map((e) => e.createdAt)).toEqual([times[4], times[3]]);
    expect(body1.nextCursor).toBe(times[3]);
    expect(typeof body1.nextCursor).toBe("string");

    const page2 = await getEvents(accessToken, `?limit=2&cursor=${encodeURIComponent(body1.nextCursor!)}`);
    expect(page2.status).toBe(200);
    const body2 = await json<CharacterEventsResponse>(page2);
    expect(body2.events.map((e) => e.createdAt)).toEqual([times[2], times[1]]);
    expect(body2.nextCursor).toBe(times[1]);

    const page3 = await getEvents(accessToken, `?limit=2&cursor=${encodeURIComponent(body2.nextCursor!)}`);
    expect(page3.status).toBe(200);
    const body3 = await json<CharacterEventsResponse>(page3);
    expect(body3.events.map((e) => e.createdAt)).toEqual([times[0]]);
    expect(body3.nextCursor).toBeNull();

    // All 5 events seen exactly once across the walk.
    const seen = [...body1.events, ...body2.events, ...body3.events];
    expect(seen).toHaveLength(5);
    expect(new Set(seen.map((e) => e.id)).size).toBe(5);
  });

  it("should default to a limit of 20 when no limit is given", async () => {
    const { accessToken, characterId } = await registerAndCreateCharacter(uniqueEmail());
    await seedEvent(characterId, "GIG_STARTED", "2026-08-01T10:00:00.000Z", {});

    const res = await getEvents(accessToken);

    expect(res.status).toBe(200);
    const body = await json<CharacterEventsResponse>(res);
    expect(body.events).toHaveLength(1);
    expect(body.nextCursor).toBeNull();
  });
});
