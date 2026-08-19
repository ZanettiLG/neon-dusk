import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb } from "./helpers";
import { db } from "../db";
import type {
  AuthResponse,
  ChromeDefinition,
  ChromeInstallResponse,
  ChromeUninstallResponse,
  CreateCharacterRequest,
  InstalledChromeResponse,
} from "@neon-dusk/shared";

// Feature #4 — chrome API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack). Dedicated redis db
// (6) so rate-limit counters never leak across files.
//
// resetDb() truncates `vendors CASCADE`, which wipes the migration-seeded
// ferrageiro "Doc Fios", so beforeAll re-seeds it (same fixed id) plus its
// inventory of the 5 starter implants. The chrome_definitions seed rows
// survive (not truncated).

const REDIS_TEST_DB = "redis://localhost:56379/6";

// Fixed id from migration 0004 (Doc Fios, Babilônia).
const DOC_FIOS_ID = "00000000-0000-4000-8000-000000000001";
const ZERO_ID = "00000000-0000-0000-0000-000000000000";

// Preços de vendedor são fixtures de teste calibrados para a carteira-semente
// de 500 grana pagar os implantes iniciais (preços reais de mercado vivem em
// content/*). stock -1 = ilimitado.
const INVENTORY: { itemId: string; price: number }[] = [
  { itemId: "neural-booster", price: 300 },
  { itemId: "reflex-tuner", price: 300 },
  { itemId: "kiroshi-optics", price: 400 },
  { itemId: "gorilla-arms", price: 2500 },
  { itemId: "subdermal-armor", price: 2000 },
];

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `chrome-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Bicho-${Date.now()}-${seq++}`;
}

function validAttributes(): CreateCharacterRequest["attributes"] {
  return { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 };
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("Feature #4 — chrome API", () => {
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

    // Re-seed Doc Fios (wiped by resetDb) with its fixed id + chrome inventory.
    await db("vendors").insert({
      id: DOC_FIOS_ID,
      name: "Doc Fios",
      type: "RIPPERDOC",
      district: "babilonia",
      description: "Ferrageiro veterano da Babilônia.",
      is_active: true,
    });
    await db("vendor_inventory").insert(
      INVENTORY.map(({ itemId, price }) => ({
        vendor_id: DOC_FIOS_ID,
        item_type: "CHROME",
        item_id: itemId,
        price,
        stock: -1,
      })),
    );

    // Sync chrome definitions to match the content seed (migration rows may be stale).
    await db("chrome_definitions")
      .where("slug", "neural-booster")
      .update({ bonuses: { intelligence: 2, nil_max: 10 } });
    await db("chrome_definitions")
      .where("slug", "reflex-tuner")
      .update({ bonuses: { reflexes: 2 } });
    await db("chrome_definitions")
      .where("slug", "kiroshi-optics")
      .update({ bonuses: { reflexes: 2, gig_success_rate: 5 } });
    await db("chrome_definitions")
      .where("slug", "gorilla-arms")
      .update({ bonuses: { body: 3 } });
    await db("chrome_definitions")
      .where("slug", "subdermal-armor")
      .update({ bonuses: { max_hp: 10 } });
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
        role: "solo",
        attributes: validAttributes(),
      }),
    });
    expect(created.status).toBe(201);

    const [character] = await db("characters")
      .select("id")
      .where("user_id", user.id)
      .limit(1);
    return { accessToken, characterId: character!.id };
  }

  /** DB id of a seeded chrome definition, by slug. */
  async function defId(slug: string): Promise<string> {
    const [row] = await db("chrome_definitions")
      .select("id")
      .where("slug", slug)
      .limit(1);
    return row!.id;
  }

  /** A ferrageiro that stocks no chrome at all. */
  async function seedEmptyRipperdoc(): Promise<string> {
    const [vendor] = await db("vendors")
      .insert({
        name: `Ripper-${Date.now()}-${seq++}`,
        type: "RIPPERDOC",
        district: "o_fluxo",
        is_active: true,
      })
      .returning("*");
    return vendor.id;
  }

  async function installChrome(
    accessToken: string,
    chromeDefinitionId: string,
    vendorId = DOC_FIOS_ID,
  ): Promise<Response> {
    return server.post(
      "/api/chrome/install",
      { chromeDefinitionId, vendorId },
      authHeader(accessToken),
    );
  }

  describe("GET /api/chrome", () => {
    it("should return all 5 active chrome definitions", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await fetch(`${base()}/api/chrome`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<ChromeDefinition[]>(res);
      expect(body).toHaveLength(5);
      expect(body.map((d) => d.slug).sort()).toEqual([
        "gorilla-arms",
        "kiroshi-optics",
        "neural-booster",
        "reflex-tuner",
        "subdermal-armor",
      ]);
      // Ordered by tier (T1 first) then name.
      expect(body[0].tier).toBe(1);
      expect(body[4].tier).toBe(2);
      expect(body[0]).not.toHaveProperty("isActive"); // internals stripped
    });

    it("should filter by tier=1", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await fetch(`${base()}/api/chrome?tier=1`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<ChromeDefinition[]>(res);
      expect(body).toHaveLength(3);
      expect(body.every((d) => d.tier === 1)).toBe(true);
    });

    it("should filter by slot=arms", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await fetch(`${base()}/api/chrome?slot=arms`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<ChromeDefinition[]>(res);
      expect(body).toHaveLength(1);
      expect(body[0].slug).toBe("gorilla-arms");
    });

    it("should filter by tier=2 AND slot=integumentary", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await fetch(`${base()}/api/chrome?tier=2&slot=integumentary`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<ChromeDefinition[]>(res);
      expect(body).toHaveLength(1);
      expect(body[0].slug).toBe("subdermal-armor");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/chrome");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/chrome/installed", () => {
    it("should return an empty loadout for a fresh character", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await fetch(`${base()}/api/chrome/installed`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<InstalledChromeResponse>(res);
      expect(body).toEqual({
        installed: [],
        effectiveHumanity: 100,
        humanitySpent: 0,
        statBonus: { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 },
        hpBonus: 0,
        gigSuccessBonus: 0,
        nilMaxBonus: 0,
      });
    });

    it("should return the installed loadout with computed bonuses after an install", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      await installChrome(accessToken, await defId("neural-booster"));

      const res = await fetch(`${base()}/api/chrome/installed`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<InstalledChromeResponse>(res);
      expect(body.installed).toHaveLength(1);
      expect(body.installed[0].definition.slug).toBe("neural-booster");
      expect(body.installed[0].installedAt).toBeTruthy();
      expect(body.statBonus).toEqual({
        body: 0,
        reflexes: 0,
        intelligence: 2, // neural-booster grants +2 INT (content/chrome-definitions.ts)
        technical: 0,
        cool: 0,
      });
      expect(body.effectiveHumanity).toBe(97);
      expect(body.humanitySpent).toBe(3);
      expect(body.hpBonus).toBe(0);
      expect(body.gigSuccessBonus).toBe(0);
      expect(body.nilMaxBonus).toBe(10); // frontal_cortex: +10/tier
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/chrome/installed");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/chrome/install", () => {
    it("should install chrome, deduct Grana and reduce humanity", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const neural = await defId("neural-booster");

      const res = await installChrome(accessToken, neural);

      expect(res.status).toBe(201);
      const body = await json<ChromeInstallResponse>(res);
      expect(body.installedChrome.definition.slug).toBe("neural-booster");
      expect(body.installedChrome.installedId).toBeTruthy();
      expect(body.effectiveHumanity).toBe(97); // 100 - 3
      expect(body.walletBalance).toBe(200); // 500 - 300
    });

    it("should reject a second install of the same chrome with 409", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const neural = await defId("neural-booster");
      await installChrome(accessToken, neural);

      const res = await installChrome(accessToken, neural);

      expect(res.status).toBe(409);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("ALREADY_INSTALLED");
    });

    it("should return 404 for an unknown chrome definition", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await installChrome(accessToken, ZERO_ID);

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("CHROME_NOT_FOUND");
    });

    it("should return 404 for an unknown vendor", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await installChrome(accessToken, await defId("neural-booster"), ZERO_ID);

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("ITEM_NOT_FOUND");
    });

    it("should return 404 when the vendor does not stock the chrome", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const vendorId = await seedEmptyRipperdoc();

      const res = await installChrome(accessToken, await defId("neural-booster"), vendorId);

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("ITEM_NOT_FOUND");
    });

    it("should return 400 INSUFFICIENT_FUNDS when the wallet cannot cover the price", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      // Braço de Ferro = 2500 de Grana > 500 seed balance.
      const res = await installChrome(accessToken, await defId("gorilla-arms"));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INSUFFICIENT_FUNDS");
      // Message format aligned with economy-service (#145 review): "disponível" + final period.
      expect(body.message).toBe("Precisa de G$ 2500 disponível, tem G$ 500.");
    });

    it("should return 400 HUMANITY_TOO_LOW when humanity would drop below 0", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      // Reflex Tuner costs 3 humanity and 300 de Grana. At 2 humanity it would go to -1.
      await db("characters")
        .where("id", characterId)
        .update({ humanity: 2 });

      const res = await installChrome(accessToken, await defId("reflex-tuner"));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("HUMANITY_TOO_LOW");
    });

    it("should allow an install that brings humanity to exactly 0 (flatline boundary)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      // Reflex Tuner costs 3 humanity; at 3 humanity the result is exactly 0,
      // which the game contract allows (cyberpsychosis handles flatline).
      await db("characters")
        .where("id", characterId)
        .update({ humanity: 3 });

      const res = await installChrome(accessToken, await defId("reflex-tuner"));

      expect(res.status).toBe(201);
      const body = await json<ChromeInstallResponse>(res);
      expect(body.effectiveHumanity).toBe(0);
    });

    it("should return 400 for a missing body", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await server.post("/api/chrome/install", {}, authHeader(accessToken));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 for non-uuid ids", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await installChrome(accessToken, "not-a-uuid", DOC_FIOS_ID);

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/chrome/install", {
        chromeDefinitionId: ZERO_ID,
        vendorId: DOC_FIOS_ID,
      });
      expect(res.status).toBe(401);
    });

    it("should increase NIL max by 10 when installing Neural Booster (frontal_cortex)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();

      const res = await installChrome(accessToken, await defId("neural-booster"));
      expect(res.status).toBe(201);

      const [char] = await db("characters")
        .select("max_nil")
        .where("id", characterId)
        .limit(1);
      expect(char!.max_nil).toBe(110); // 100 base + 10 from Neural Booster
    });

    it("should NOT increase NIL max when installing Braço de Ferro (non-neural)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();

      // Fetch balance to trigger wallet creation, then top up for Braço de Ferro (2500 de Grana).
      await fetch(`${base()}/api/economy/balance`, { headers: authHeader(accessToken) });
      await db("character_wallets")
        .where("character_id", characterId)
        .update({ balance: 3000 });

      const res = await installChrome(accessToken, await defId("gorilla-arms"));
      expect(res.status).toBe(201);

      const [char] = await db("characters")
        .select("max_nil")
        .where("id", characterId)
        .limit(1);
      expect(char!.max_nil).toBe(100); // unchanged
    });
  });

  describe("POST /api/chrome/uninstall", () => {
    it("should uninstall chrome: free the slot, no refund, no humanity recovery", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const install = await json<ChromeInstallResponse>(
        await installChrome(accessToken, await defId("neural-booster")),
      );

      const res = await server.post(
        "/api/chrome/uninstall",
        { installedChromeId: install.installedChrome.installedId },
        authHeader(accessToken),
      );

      expect(res.status).toBe(200);
      const body = await json<ChromeUninstallResponse>(res);
      expect(body.freedSlot).toBe("frontal_cortex");
      expect(body.effectiveHumanity).toBe(97); // no recovery

      // Slot freed — loadout is empty again.
      const loadout = await db("installed_chrome")
        .select("*")
        .where("character_id", characterId);
      expect(loadout).toHaveLength(0);

      // NIL max restored to base (100) after uninstalling frontal cortex chrome.
      const [char] = await db("characters")
        .select("max_nil")
        .where("id", characterId)
        .limit(1);
      expect(char!.max_nil).toBe(100);

      // Sem reembolso — carteira fica em 200 (o saldo após a compra de 300 grana).
      const balance = await fetch(`${base()}/api/economy/balance`, {
        headers: authHeader(accessToken),
      });
      expect((await json<{ balance: number }>(balance)).balance).toBe(200);

      // Audit entry with amount 0.
      const [log] = await db("transaction_log")
        .select("*")
        .where("character_id", characterId)
        .andWhere("type", "CHROME_UNINSTALL");
      expect(log).toMatchObject({
        amount: 0,
        balance_before: 200,
        balance_after: 200,
      });
    });

    it("should return 404 when the installed chrome belongs to another character", async () => {
      const { accessToken: ownerToken } = await registerAndCreateCharacter();
      const install = await json<ChromeInstallResponse>(
        await installChrome(ownerToken, await defId("neural-booster")),
      );
      const { accessToken: otherToken } = await registerAndCreateCharacter();

      const res = await server.post(
        "/api/chrome/uninstall",
        { installedChromeId: install.installedChrome.installedId },
        authHeader(otherToken),
      );

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INSTALLED_CHROME_NOT_FOUND");
    });

    it("should return 404 for a non-existent installed chrome id", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await server.post(
        "/api/chrome/uninstall",
        { installedChromeId: ZERO_ID },
        authHeader(accessToken),
      );

      expect(res.status).toBe(404);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("INSTALLED_CHROME_NOT_FOUND");
    });

    it("should return 400 for a non-uuid installed chrome id", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await server.post(
        "/api/chrome/uninstall",
        { installedChromeId: "not-a-uuid" },
        authHeader(accessToken),
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("VALIDATION_ERROR");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/chrome/uninstall", { installedChromeId: ZERO_ID });
      expect(res.status).toBe(401);
    });

    it("should restore NIL max to 100 after uninstalling the only Neural Booster", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const install = await json<ChromeInstallResponse>(
        await installChrome(accessToken, await defId("neural-booster")),
      );

      // Verify max went up.
      let [char] = await db("characters")
        .select("max_nil")
        .where("id", characterId)
        .limit(1);
      expect(char!.max_nil).toBe(110);

      await server.post(
        "/api/chrome/uninstall",
        { installedChromeId: install.installedChrome.installedId },
        authHeader(accessToken),
      );

      [char] = await db("characters")
        .select("max_nil")
        .where("id", characterId)
        .limit(1);
      expect(char!.max_nil).toBe(100);
    });
  });

  describe("wallet integrity", () => {
    it("should record balance_before and balance_after on the CHROME_PURCHASE entry", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();

      await installChrome(accessToken, await defId("neural-booster"));

      const [log] = await db("transaction_log")
        .select("*")
        .where("character_id", characterId)
        .andWhere("type", "CHROME_PURCHASE");
      expect(log).toMatchObject({
        amount: -300,
        balance_before: 500,
        balance_after: 200,
      });
    });

    it("should roll back atomically — a failed install leaves no wallet or humanity trace", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const neural = await defId("neural-booster");
      // Simulate the race where the loadout row already exists (concurrent
      // install committed between the loadout read and the insert).
      await db("installed_chrome").insert({
        character_id: characterId,
        chrome_definition_id: neural,
      });

      const res = await installChrome(accessToken, neural);

      expect(res.status).toBe(409);
      // Nothing persisted: no purchase entry, humanity untouched, wallet untouched.
      const purchases = await db("transaction_log")
        .select("*")
        .where("character_id", characterId)
        .andWhere("type", "CHROME_PURCHASE");
      expect(purchases).toHaveLength(0);

      const [character] = await db("characters")
        .select("humanity")
        .where("id", characterId);
      expect(character!.humanity).toBe(100);

      const balance = await fetch(`${base()}/api/economy/balance`, {
        headers: authHeader(accessToken),
      });
      expect((await json<{ balance: number }>(balance)).balance).toBe(500);
    });

    it("should let exactly one of two concurrent installs win, with a single debit", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      const neural = await defId("neural-booster");

      const [a, b] = await Promise.all([
        installChrome(accessToken, neural),
        installChrome(accessToken, neural),
      ]);

      // Exactly one install wins (201). The loser legitimately fails with
      // either 409 ALREADY_INSTALLED (it sees the winner's row) or 400
      // INSUFFICIENT_FUNDS (the winner's debit lands between its reads) —
      // both prove only one purchase happened.
      const ok = [a, b].filter((r) => r.status === 201);
      const rejected = [a, b].filter((r) => r.status !== 201);
      expect(ok).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect([400, 409]).toContain(rejected[0].status);

      // Exactly one installed row and one debit.
      const loadout = await db("installed_chrome")
        .select("*")
        .where("character_id", characterId);
      expect(loadout).toHaveLength(1);

      const purchases = await db("transaction_log")
        .select("*")
        .where("character_id", characterId)
        .andWhere("type", "CHROME_PURCHASE");
      expect(purchases).toHaveLength(1);
      expect(purchases[0].amount).toBe(-300);

      const [character] = await db("characters")
        .select("humanity")
        .where("id", characterId);
      expect(character!.humanity).toBe(97); // 100 - 3, applied exactly once
    });
  });
});
