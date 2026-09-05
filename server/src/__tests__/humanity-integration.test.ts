import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb } from "./helpers";
import { db } from "../db";
import type { AuthResponse, HumanityInfo } from "@neon-dusk/shared";

// Issue #28 — Humanidade API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack). Dedicated redis db
// (8) so rate-limit counters never leak across files.
//
// resetDb() truncates `vendors CASCADE`, which wipes the migration-seeded
// ferrageiro "Doc Fios", so beforeAll re-seeds it (same fixed id) plus the
// Neural Scrubber at a test price. The chrome_definitions seed rows survive.

const REDIS_TEST_DB = "redis://localhost:56379/8";

// Fixed id from migration 0004 (Doc Fios, Babilônia).
const DOC_FIOS_ID = "00000000-0000-4000-8000-000000000001";

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `hum-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Bicho-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
}

describe("Issue #28 — Humanidade API", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    await resetDb();

    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();
    redis.disconnect();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);

    // Re-seed Doc Fios (wiped by resetDb) with its fixed id + scrubber stock.
    await db("vendors").insert({
      id: DOC_FIOS_ID,
      name: "Doc Fios",
      type: "RIPPERDOC",
      district: "babilonia",
      description: "Ferrageiro veterano da Babilônia.",
      is_active: true,
    });
    await db("vendor_inventory").insert({
      vendor_id: DOC_FIOS_ID,
      item_type: "CHROME",
      item_id: "neural-scrubber",
      price: 300,
      stock: -1,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Register a fresh user + character via HTTP; returns token + character id. */
  async function registerAndCreateCharacter(): Promise<{
    accessToken: string;
    characterId: string;
  }> {
    const res = await server.post("/api/auth/register", {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    const { accessToken, user } = await json<AuthResponse>(res);

    const created = await fetch(`${base()}/api/characters`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(accessToken) },
      body: JSON.stringify({
        name: uniqueName(),
        origin: "a_paraiso",
        role: "bicho",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      }),
    });
    expect(created.status).toBe(201);

    const [character] = await db("characters").select("id").where("user_id", user.id).limit(1);
    return { accessToken, characterId: character!.id };
  }

  async function getHumanity(accessToken: string): Promise<HumanityInfo> {
    const res = await fetch(`${base()}/api/humanity`, { headers: authHeader(accessToken) });
    expect(res.status).toBe(200);
    return json<HumanityInfo>(res);
  }

  describe("GET /api/humanity", () => {
    it("should return the fresh readout: 100 humanity, integro, no scrubber, no therapy", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const body = await getHumanity(accessToken);

      expect(body.humanity).toBe(100);
      expect(body.band).toBe("integro");
      expect(body.flatlined).toBe(false);
      expect(body.flatlinedAt).toBeNull();
      expect(body.scrubber).toEqual({
        installed: false,
        pendingRegen: 0,
        nextRegenAt: null,
        cap: 50,
      });
      expect(body.therapy.lastCompletedAt).toBeNull();
      expect(body.therapy.nextAvailableAt).toBeNull();
      expect(body.therapy.cooldownRemainingMs).toBe(0);
      expect(body.therapy.clinic).toEqual({
        therapyType: "clinic",
        costMin: 5000,
        costMax: 20000,
        restoreMin: 10,
        restoreMax: 20,
      });
      expect(body.therapy.attunement).toEqual({
        therapyType: "attunement",
        costMin: 2500,
        costMax: 10000,
        restoreMin: 5,
        restoreMax: 10,
      });
    });

    it("should map the band boundaries (70 instavel, 40 borderline, 20 cyberpsycho)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();

      await db("characters").where("id", characterId).update({ humanity: 70 });
      expect((await getHumanity(accessToken)).band).toBe("instavel");

      await db("characters").where("id", characterId).update({ humanity: 40 });
      expect((await getHumanity(accessToken)).band).toBe("borderline");

      await db("characters").where("id", characterId).update({ humanity: 20 });
      expect((await getHumanity(accessToken)).band).toBe("cyberpsycho");
    });

    it("should report apagado + flatlinedAt when humanity reaches 0", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const flatlinedAt = new Date("2026-08-29T10:00:00.000Z");
      await db("characters")
        .where("id", characterId)
        .update({ humanity: 0, is_flatlined: true, flatlined_at: flatlinedAt });

      const body = await getHumanity(accessToken);

      expect(body.humanity).toBe(0);
      expect(body.band).toBe("apagado");
      expect(body.flatlined).toBe(true);
      expect(body.flatlinedAt).toBe(flatlinedAt.toISOString());
    });

    it("should never regen humanity for a flatlined character, even with the scrubber installed", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const [scrubber] = await db("chrome_definitions")
        .select("id")
        .where("slug", "neural-scrubber")
        .limit(1);
      const install = await server.post(
        "/api/chrome/install",
        { chromeDefinitionId: scrubber!.id, vendorId: DOC_FIOS_ID },
        authHeader(accessToken),
      );
      expect(install.status).toBe(201);

      // Flatline with 3 full 24h windows elapsed — the scrubber would regen
      // +3 if the readout ignored the apagado state (the display bug under
      // review: humanity > 0 and band ≠ apagado for a flatlined character).
      await db("characters")
        .where("id", characterId)
        .update({
          humanity: 0,
          is_flatlined: true,
          flatlined_at: new Date(),
          humanity_updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        });

      const body = await getHumanity(accessToken);

      expect(body.humanity).toBe(0); // permanent loss — scrubber regen skipped
      expect(body.band).toBe("apagado");
      expect(body.flatlined).toBe(true);
      expect(body.scrubber.installed).toBe(true);
      expect(body.scrubber.pendingRegen).toBe(0);
      expect(body.scrubber.nextRegenAt).toBeNull();
    });

    it("should report the scrubber as installed with lazy regen pending", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      // Install the Neural Scrubber (test price 300, costs 15 humanity).
      const [scrubber] = await db("chrome_definitions")
        .select("id")
        .where("slug", "neural-scrubber")
        .limit(1);
      const install = await server.post(
        "/api/chrome/install",
        { chromeDefinitionId: scrubber!.id, vendorId: DOC_FIOS_ID },
        authHeader(accessToken),
      );
      expect(install.status).toBe(201);

      // 3 full 24h windows elapsed since the last humanity write.
      await db("characters")
        .where("id", characterId)
        .update({
          humanity: 40,
          humanity_updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        });

      const body = await getHumanity(accessToken);

      expect(body.scrubber.installed).toBe(true);
      expect(body.scrubber.cap).toBe(50);
      expect(body.scrubber.pendingRegen).toBe(3);
      expect(body.humanity).toBe(43); // lazy regen applied on read
      expect(body.scrubber.nextRegenAt).not.toBeNull();
    });

    it("should not regen past the scrubber cap (50)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const [scrubber] = await db("chrome_definitions")
        .select("id")
        .where("slug", "neural-scrubber")
        .limit(1);
      await server.post(
        "/api/chrome/install",
        { chromeDefinitionId: scrubber!.id, vendorId: DOC_FIOS_ID },
        authHeader(accessToken),
      );
      await db("characters")
        .where("id", characterId)
        .update({
          humanity: 50,
          humanity_updated_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        });

      const body = await getHumanity(accessToken);

      expect(body.humanity).toBe(50);
      expect(body.scrubber.pendingRegen).toBe(0);
      expect(body.scrubber.nextRegenAt).toBeNull();
    });

    it("should expose the therapy cooldown after a session", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      // Seed a therapy session just now — the 500ms anti-spam window (#187)
      // is deterministically still running.
      await db("therapy_sessions").insert({
        character_id: characterId,
        therapy_type: "clinic",
        cost: 5000,
        restored: 10,
        humanity_before: 50,
        humanity_after: 60,
        completed_at: new Date(),
      });

      const body = await getHumanity(accessToken);

      expect(body.therapy.lastCompletedAt).not.toBeNull();
      expect(body.therapy.nextAvailableAt).not.toBeNull();
      expect(body.therapy.cooldownRemainingMs).toBeGreaterThan(0);
      expect(body.therapy.cooldownRemainingMs).toBeLessThanOrEqual(500);
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/humanity");
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });
  });
});
