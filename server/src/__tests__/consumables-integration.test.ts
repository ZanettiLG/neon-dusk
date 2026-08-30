import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb } from "./helpers";
import { db } from "../db";
import { seedConsumables, seedVendors } from "../seed/content-seeds";
import type {
  AuthResponse,
  ConsumablesResponse,
  ConsumableUseResponse,
} from "@neon-dusk/shared";

// Issue #28 — Itens anti-insanidade API integration tests. Real HTTP against
// the app (Fastify + Postgres + Redis on the isolated test stack). Dedicated
// redis db (10) so rate-limit counters never leak across files.
//
// resetDb() truncates `vendors CASCADE`, so beforeAll re-seeds the canonical
// vendors (real prices) + the consumables catalog. The seed wallet (500 grana)
// cannot afford the items (7.5k-30k), so tests top up the wallet in the DB.
//
// NOTE: the per-item cooldown error surfaces as HTTP 429 (not 400) — the
// global error-handler maps COOLDOWN_ACTIVE to 429 (ND-053 convention).

const REDIS_TEST_DB = "redis://localhost:56379/10";

// Fixed vendor ids from the content seed.
const ZE_DO_PO_ID = "00000000-0000-4000-8000-000000000003"; // STIM_DEALER — estabilizador
const DOC_FIOS_ID = "00000000-0000-4000-8000-000000000001"; // RIPPERDOC — freio
const MADAME_K_ID = "00000000-0000-4000-8000-000000000004"; // BLACK_MARKET — choque

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `con-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Bicho-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("Issue #28 — Itens anti-insanidade API", () => {
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

    // Re-seed the canonical vendors (wiped by resetDb) + the consumables catalog.
    await seedVendors(db);
    await seedConsumables(db);
  });

  afterAll(async () => {
    await app.close();
  });

  /** Register a fresh user + character via HTTP; returns token + character id. */
  async function registerAndCreateCharacter(): Promise<{ accessToken: string; characterId: string }> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
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

    const [character] = await db("characters")
      .select("id")
      .where("user_id", user.id)
      .limit(1);
    return { accessToken, characterId: character!.id };
  }

  /** Create the wallet (500 seed) and top it up so purchases are affordable. */
  async function topUpWallet(accessToken: string, characterId: string, amount = 200_000): Promise<void> {
    await fetch(`${base()}/api/economy/balance`, { headers: authHeader(accessToken) });
    await db("character_wallets")
      .where("character_id", characterId)
      .update({ balance: amount, lifetime_earned: amount });
  }

  /** DB id of a seeded consumable, by slug. */
  async function consumableId(slug: string): Promise<string> {
    const [row] = await db("consumables")
      .select("id")
      .where("slug", slug)
      .limit(1);
    return row!.id;
  }

  async function buyItem(
    accessToken: string,
    vendorId: string,
    itemId: string,
    quantity = 1,
  ): Promise<Response> {
    return server.post(
      `/api/vendors/${vendorId}/buy`,
      { itemType: "CONSUMABLE", itemId, quantity },
      authHeader(accessToken),
    );
  }

  async function useItem(accessToken: string, itemId: string): Promise<Response> {
    return server.post("/api/consumables/use", { itemId }, authHeader(accessToken));
  }

  async function listConsumables(accessToken: string): Promise<ConsumablesResponse> {
    const res = await fetch(`${base()}/api/consumables`, { headers: authHeader(accessToken) });
    expect(res.status).toBe(200);
    return json<ConsumablesResponse>(res);
  }

  describe("GET /api/consumables", () => {
    it("should return the 3-item catalog with zero owned quantities", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const body = await listConsumables(accessToken);

      expect(body.items).toHaveLength(3);
      const bySlug = Object.fromEntries(body.items.map((i) => [i.slug, i]));
      expect(bySlug.estabilizador).toMatchObject({ tier: 1, restoreAmount: 5, cooldownHours: 0, ownedQuantity: 0 });
      expect(bySlug.freio).toMatchObject({ tier: 2, restoreAmount: 10, cooldownHours: 12, ownedQuantity: 0 });
      expect(bySlug.choque).toMatchObject({ tier: 3, restoreAmount: 15, cooldownHours: 24, ownedQuantity: 0 });
      for (const item of body.items) {
        expect(item.nextAvailableAt).toBeNull();
      }
    });

    it("should reflect owned quantities after a vendor purchase", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);

      const buy = await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador", 2);
      expect(buy.status).toBe(200);

      const body = await listConsumables(accessToken);
      const estabilizador = body.items.find((i) => i.slug === "estabilizador");
      expect(estabilizador!.ownedQuantity).toBe(2);
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/consumables");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/consumables/use", () => {
    it("should restore 100% on the first use, 60% on the second, 30% on the third", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador", 3);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      // 1st use: 100% of 5 = 5 → 55.
      const first = await json<ConsumableUseResponse>(await useItem(accessToken, await consumableId("estabilizador")));
      expect(first).toMatchObject({ humanityBefore: 50, humanityAfter: 55, restored: 5, costEddies: 0 });

      // 2nd use: 60% of 5 = 3 → 58.
      const second = await json<ConsumableUseResponse>(await useItem(accessToken, await consumableId("estabilizador")));
      expect(second).toMatchObject({ humanityBefore: 55, humanityAfter: 58, restored: 3 });

      // 3rd use: 30% of 5 = 1.5 → round 2 → 60.
      const third = await json<ConsumableUseResponse>(await useItem(accessToken, await consumableId("estabilizador")));
      expect(third).toMatchObject({ humanityBefore: 58, humanityAfter: 60, restored: 2 });

      // Each use consumed exactly one unit.
      const body = await listConsumables(accessToken);
      expect(body.items.find((i) => i.slug === "estabilizador")!.ownedQuantity).toBe(0);
    });

    it("should block the 4th use in the rolling 24h window", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador", 4);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      for (let i = 0; i < 3; i++) {
        const ok = await useItem(accessToken, await consumableId("estabilizador"));
        expect(ok.status).toBe(200);
      }

      const res = await useItem(accessToken, await consumableId("estabilizador"));
      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("DIMINISHING_RETURNS_EXHAUSTED");
    });

    it("should return 400 BAND_TOO_HIGH when humanity is above 70", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador");
      await db("characters").where("id", characterId).update({ humanity: 80 });

      const res = await useItem(accessToken, await consumableId("estabilizador"));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("BAND_TOO_HIGH");
    });

    it("should allow a use in Cyberpsycho (1-20) — the safety net", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador");
      await db("characters").where("id", characterId).update({ humanity: 10 });

      const res = await useItem(accessToken, await consumableId("estabilizador"));

      expect(res.status).toBe(200);
      const body = await json<ConsumableUseResponse>(res);
      expect(body.humanityAfter).toBe(15);
    });

    it("should return 400 NOT_OWNED when the character has no stock", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await useItem(accessToken, await consumableId("estabilizador"));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NOT_OWNED");
    });

    it("should return 429 COOLDOWN_ACTIVE for a T2 item used twice within its 12h cooldown", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, DOC_FIOS_ID, "freio", 2);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      const first = await useItem(accessToken, await consumableId("freio"));
      expect(first.status).toBe(200);

      const res = await useItem(accessToken, await consumableId("freio"));

      // ND-053: the global error-handler maps COOLDOWN_ACTIVE to 429.
      expect(res.status).toBe(429);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("COOLDOWN_ACTIVE");
      expect(body.message).toContain("cooldown");
    });

    it("should return 429 COOLDOWN_ACTIVE for a T3 item used twice within its 24h cooldown", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, MADAME_K_ID, "choque", 2);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      const first = await useItem(accessToken, await consumableId("choque"));
      expect(first.status).toBe(200);

      const res = await useItem(accessToken, await consumableId("choque"));

      expect(res.status).toBe(429);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("COOLDOWN_ACTIVE");
    });

    it("should return 403 FLATLINED for an apagado character", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador");
      await db("characters")
        .where("id", characterId)
        .update({ is_flatlined: true, flatlined_at: new Date() });

      const res = await useItem(accessToken, await consumableId("estabilizador"));

      expect(res.status).toBe(403);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("FLATLINED");
    });

    it("should return 404 CONSUMABLE_NOT_FOUND for an unknown item id", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await useItem(accessToken, "00000000-0000-0000-0000-000000000000");

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("CONSUMABLE_NOT_FOUND");
    });

    it("should return 400 VALIDATION_ERROR for a non-uuid item id", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await useItem(accessToken, "not-a-uuid");

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/consumables/use", { itemId: "00000000-0000-0000-0000-000000000000" });
      expect(res.status).toBe(401);
    });

    it("should serialize concurrent uses via the row lock (no lost diminishing-returns update)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);
      await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador", 2);
      await db("characters").where("id", characterId).update({ humanity: 50 });
      const id = await consumableId("estabilizador");

      // Two concurrent uses: the character row lock serializes them, so the
      // second use sees the first's consumable_uses row (60% multiplier).
      const [a, b] = await Promise.all([useItem(accessToken, id), useItem(accessToken, id)]);

      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      const restored = [await json<ConsumableUseResponse>(a), await json<ConsumableUseResponse>(b)]
        .map((r) => r.restored)
        .sort((x, y) => y - x);
      expect(restored).toEqual([5, 3]); // 100% then 60% — never both 100%

      const [char] = await db("characters")
        .select("humanity")
        .where("id", characterId);
      expect(char!.humanity).toBe(58); // 50 + 5 + 3, applied exactly once each
    });
  });

  describe("vendor purchase lifecycle (delta criterion 3)", () => {
    it("should increment inventory on buy and never go negative on use", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await topUpWallet(accessToken, characterId);

      // Buy 1, use 1 → inventory back to 0 (row deleted, never negative).
      const buy = await buyItem(accessToken, ZE_DO_PO_ID, "estabilizador");
      expect(buy.status).toBe(200);
      await db("characters").where("id", characterId).update({ humanity: 50 });

      const use = await useItem(accessToken, await consumableId("estabilizador"));
      expect(use.status).toBe(200);

      const body = await listConsumables(accessToken);
      expect(body.items.find((i) => i.slug === "estabilizador")!.ownedQuantity).toBe(0);

      // A second use without stock is NOT_OWNED (never a negative quantity).
      const res = await useItem(accessToken, await consumableId("estabilizador"));
      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("NOT_OWNED");
    });
  });
});