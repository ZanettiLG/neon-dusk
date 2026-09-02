import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, type TestServer } from "./helpers";
import { seedGigs } from "../seed/content-seeds";
import { db } from "../db";
import type { AuthResponse, MetroMapResponse } from "@neon-dusk/shared";
import { ORIGINS, originFromDistrictString } from "@neon-dusk/shared";

// Issue #18 — Metro map API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack). Dedicated redis db
// (13) so rate-limit counters never leak across files.

const REDIS_TEST_DB = "redis://localhost:56379/13";
const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `metro-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Metro-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
}

interface MetroUser {
  accessToken: string;
  characterId: string;
}

describe("Issue #18 — Metro map API", () => {
  let app: FastifyInstance;
  let server: TestServer;
  let redis: Redis;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    await resetDb();

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({
      env: envSchema.parse({
        ...process.env,
        REDIS_URL: REDIS_TEST_DB,
        RATE_LIMIT_MAX: "1000",
      }),
    });
    server = await startTestServer(app);
    await seedGigs(db);
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    await redis.flushdb();
  });

  /** Register a user + character over HTTP; returns token and character id. */
  async function registerApiUser(origin: string = "a_paraiso"): Promise<MetroUser> {
    const res = await server.post("/api/auth/register", {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);
    const created = await server.post(
      "/api/characters",
      {
        name: uniqueName(),
        origin,
        role: "bicho",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      },
      authHeader(accessToken),
    );
    expect(created.status).toBe(201);
    const character = await json<{ id: string }>(created);
    return { accessToken, characterId: character.id };
  }

  it("should return 401 without an access token", async () => {
    const res = await server.get("/api/metro");
    expect(res.status).toBe(401);
    expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
  });

  it("should return 404 NO_CHARACTER for a user without a character", async () => {
    const res = await server.post("/api/auth/register", {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);

    const metro = await fetch(`${base()}/api/metro`, { headers: authHeader(accessToken) });
    expect(metro.status).toBe(404);
    expect((await json<ErrorBody>(metro)).error).toBe("NO_CHARACTER");
  });

  it("should return 7 districts in canonical ORIGINS order, zero-filled by default", async () => {
    const user = await registerApiUser();

    const res = await fetch(`${base()}/api/metro`, { headers: authHeader(user.accessToken) });
    expect(res.status).toBe(200);
    const body = await json<MetroMapResponse>(res);

    expect(body.districts.map((d) => d.origin)).toEqual([...ORIGINS]);
    for (const district of body.districts) {
      expect(district.gigsAvailable).toBeGreaterThan(0);
      expect(district.heat).toBe(0);
      expect(district.territoryCrewTag).toBeNull();
    }
  });

  it("should count gigsAvailable per district from the static catalog", async () => {
    const user = await registerApiUser();

    // Expected counts straight from the catalog (district may be the origin
    // key or the display label — same normalization the service applies).
    const rows = await db("gigs").select("district");
    const expected = new Map<string, number>();
    for (const row of rows as Array<{ district: string }>) {
      const origin = originFromDistrictString(row.district);
      if (origin) expected.set(origin, (expected.get(origin) ?? 0) + 1);
    }

    const res = await fetch(`${base()}/api/metro`, { headers: authHeader(user.accessToken) });
    const body = await json<MetroMapResponse>(res);
    for (const district of body.districts) {
      expect(district.gigsAvailable).toBe(expected.get(district.origin) ?? 0);
    }
  });

  it("should never surface negative heat (DB constraint backstops the clamp)", async () => {
    const user = await registerApiUser();

    // The heat table carries a CHECK constraint (heat_amount_non_negative) —
    // negative amounts are rejected at the schema level, so the API can never
    // read a negative value. (The defensive clamp in applyHeatDecay for
    // currentHeat <= 0 is covered by `gigs-game.test.ts`.)
    await expect(
      db("heat").insert({
        character_id: user.characterId,
        district: "o_fervo",
        amount: -40,
        updated_at: new Date(),
      }),
    ).rejects.toThrow(/heat_amount_non_negative/);

    const res = await fetch(`${base()}/api/metro`, { headers: authHeader(user.accessToken) });
    expect(res.status).toBe(200);
    const body = await json<MetroMapResponse>(res);

    const fervo = body.districts.find((d) => d.origin === "o_fervo");
    expect(fervo!.heat).toBe(0);
  });

  it("should apply heat decay on read and NOT write it back", async () => {
    const user = await registerApiUser();

    // 100 heat, 10 days old → lazy decay -5/day → 50 on read.
    await db("heat").insert({
      character_id: user.characterId,
      district: "o_fervo",
      amount: 100,
      updated_at: new Date(Date.now() - 10 * 86_400_000),
    });

    const res = await fetch(`${base()}/api/metro`, { headers: authHeader(user.accessToken) });
    expect(res.status).toBe(200);
    const body = await json<MetroMapResponse>(res);

    const fervo = body.districts.find((d) => d.origin === "o_fervo");
    expect(fervo!.heat).toBe(50);

    // A GET must never persist — the row keeps its raw amount.
    const [row] = await db("heat").select("amount").where("character_id", user.characterId);
    expect(Number(row!.amount)).toBe(100);
  });

  it("should surface the territoryCrewTag of the crew claiming a district", async () => {
    const user = await registerApiUser();

    // Direct insert (the claim-at-creation rule is covered by crews-api tests).
    await db("crews").insert({
      name: `Bonde-${Date.now()}`,
      tag: "NDS",
      leader_id: user.characterId,
      territory_district: "babilonia",
    });

    const res = await fetch(`${base()}/api/metro`, { headers: authHeader(user.accessToken) });
    const body = await json<MetroMapResponse>(res);

    const babilonia = body.districts.find((d) => d.origin === "babilonia");
    expect(babilonia!.territoryCrewTag).toBe("NDS");
    // Unclaimed districts stay null.
    expect(body.districts.find((d) => d.origin === "o_ponto")!.territoryCrewTag).toBeNull();
  });
});
