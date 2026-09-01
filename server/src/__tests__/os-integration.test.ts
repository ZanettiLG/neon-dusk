import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, clearAuthIpRateLimits } from "./helpers";
import { db } from "../db";
import type {
  AuthResponse,
  ChromeInstallResponse,
  OsActivateResponse,
  OsStatus,
} from "@neon-dusk/shared";

// Issue #28 — OS API integration tests. Real HTTP against the app (Fastify +
// Postgres + Redis on the isolated test stack). Dedicated redis db (7) so
// rate-limit counters never leak across files.
//
// resetDb() truncates `vendors CASCADE`, which wipes the migration-seeded
// ferrageiro "Doc Fios", so beforeAll re-seeds it (same fixed id) plus its
// inventory of the 3 OS implants at test prices (the seed wallet of 500 grana
// cannot afford the real 12k-15k prices). The chrome_definitions seed rows
// survive (not truncated).

const REDIS_TEST_DB = "redis://localhost:56379/7";

// Fixed id from migration 0004 (Doc Fios, Babilônia).
const DOC_FIOS_ID = "00000000-0000-4000-8000-000000000001";

const OS_INVENTORY: { itemId: string; price: number }[] = [
  { itemId: "os-fury", price: 300 },
  { itemId: "os-surge", price: 300 },
  { itemId: "os-gazuah", price: 300 },
];

const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `os-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Bicho-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

describe("Issue #28 — OS API", () => {
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

    // Re-seed Doc Fios (wiped by resetDb) with its fixed id + OS inventory.
    await db("vendors").insert({
      id: DOC_FIOS_ID,
      name: "Doc Fios",
      type: "RIPPERDOC",
      district: "babilonia",
      description: "Ferrageiro veterano da Babilônia.",
      is_active: true,
    });
    await db("vendor_inventory").insert(
      OS_INVENTORY.map(({ itemId, price }) => ({
        vendor_id: DOC_FIOS_ID,
        item_type: "CHROME",
        item_id: itemId,
        price,
        stock: -1,
      })),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  // ND-053: the per-IP register/login budget (10 req/60s) must not be
  // exhausted by the many registrations from 127.0.0.1.
  beforeEach(async () => {
    const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await clearAuthIpRateLimits(redis);
    redis.disconnect();
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

  /** DB id of a seeded cromo definition, by slug. */
  async function defId(slug: string): Promise<string> {
    const [row] = await db("chrome_definitions").select("id").where("slug", slug).limit(1);
    return row!.id;
  }

  async function installOs(accessToken: string, slug: string): Promise<Response> {
    return server.post(
      "/api/chrome/install",
      { chromeDefinitionId: await defId(slug), vendorId: DOC_FIOS_ID },
      authHeader(accessToken),
    );
  }

  describe("GET /api/os/status", () => {
    it("should return installed:false for a fresh character", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await fetch(`${base()}/api/os/status`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<OsStatus>(res);
      expect(body).toEqual({ installed: false, os: null, ability: null });
    });

    it("should return the installed OS definition + activation readout", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");

      const res = await fetch(`${base()}/api/os/status`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<OsStatus>(res);
      expect(body.installed).toBe(true);
      expect(body.os).toEqual({ slug: "os-fury", name: "SO Fúria" });
      expect(body.ability).toMatchObject({
        isActive: false,
        activeUntil: null,
        usesRemaining: 3,
        usedToday: 0,
        maxUsesPerDay: 3,
        durationSeconds: 60,
        inert: false,
      });
      expect(body.ability!.resetsAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    });

    it("should expose Gazuá as inert with zero uses and duration", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-gazuah");

      const res = await fetch(`${base()}/api/os/status`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<OsStatus>(res);
      expect(body.installed).toBe(true);
      expect(body.os!.slug).toBe("os-gazuah");
      expect(body.ability).toMatchObject({
        usesRemaining: 0,
        maxUsesPerDay: 0,
        durationSeconds: 0,
        inert: true,
      });
    });

    it("should reset the daily counter when the last use was on a previous UTC day", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");
      // Simulate 3 uses yesterday — the counter must reset at UTC midnight.
      await db("characters")
        .where("id", characterId)
        .update({
          os_ability_uses_today: 3,
          os_ability_used_date: new Date(Date.now() - 86_400_000),
        });

      const res = await fetch(`${base()}/api/os/status`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<OsStatus>(res);
      expect(body.ability!.usesRemaining).toBe(3);
      expect(body.ability!.usedToday).toBe(0);
    });

    it("should return 401 without an access token", async () => {
      const res = await server.get("/api/os/status");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/os/activate", () => {
    it("should activate the OS and decrement the daily counter", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");

      const res = await server.post("/api/os/activate", {}, authHeader(accessToken));

      expect(res.status).toBe(200);
      const body = await json<OsActivateResponse>(res);
      expect(body.success).toBe(true);
      expect(body.usesRemaining).toBe(2);
      expect(body.message).toBe("SO Fúria ativado.");
      // activeUntil = now + 60s.
      const activeUntil = new Date(body.activeUntil).getTime();
      expect(Math.abs(activeUntil - Date.now() - 60_000)).toBeLessThan(5_000);

      // The readout reflects the activation.
      const status = await json<OsStatus>(
        await fetch(`${base()}/api/os/status`, { headers: authHeader(accessToken) }),
      );
      expect(status.ability!.isActive).toBe(true);
      expect(status.ability!.usedToday).toBe(1);
      expect(status.ability!.usesRemaining).toBe(2);
    });

    it("should reject a second activation while the window is running", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");
      await server.post("/api/os/activate", {}, authHeader(accessToken));

      const res = await server.post("/api/os/activate", {}, authHeader(accessToken));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("OS_ALREADY_ACTIVE");
    });

    it("should exhaust the daily charges after 3 activations (4th → 400)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");

      // 3 activations succeed (usesRemaining 2 → 1 → 0). The 60s window is
      // still running between calls, so expire it via DB before each retry.
      for (const expected of [2, 1, 0]) {
        const ok = await server.post("/api/os/activate", {}, authHeader(accessToken));
        expect(ok.status).toBe(200);
        expect((await json<OsActivateResponse>(ok)).usesRemaining).toBe(expected);
        await db("characters")
          .where("id", characterId)
          .update({ os_ability_active_until: new Date(Date.now() - 1_000) });
      }

      // 4th activation is blocked.
      const res = await server.post("/api/os/activate", {}, authHeader(accessToken));
      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("OS_NO_USES_LEFT");
    });

    it("should return 400 NO_OS_INSTALLED when no OS is installed", async () => {
      const { accessToken } = await registerAndCreateCharacter();

      const res = await server.post("/api/os/activate", {}, authHeader(accessToken));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("NO_OS_INSTALLED");
    });

    it("should return 400 OS_INERT for Gazuá", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-gazuah");

      const res = await server.post("/api/os/activate", {}, authHeader(accessToken));

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("OS_INERT");
    });

    it("should return 403 FLATLINED for an apagado character", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");
      await db("characters")
        .where("id", characterId)
        .update({ is_flatlined: true, flatlined_at: new Date() });

      const res = await server.post("/api/os/activate", {}, authHeader(accessToken));

      expect(res.status).toBe(403);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("FLATLINED");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/os/activate", {});
      expect(res.status).toBe(401);
    });
  });

  describe("OS permanence (install/uninstall gates)", () => {
    it("should reject a second OS install with 409 OS_ALREADY_INSTALLED", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await installOs(accessToken, "os-fury");

      // ND-053: the first install arms the 60s chrome_install cooldown. Drop
      // it so the second install reaches the permanence guard.
      const redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
      await redis.connect();
      await redis.del(`cooldown:${characterId}:chrome_install`);
      redis.disconnect();

      const res = await installOs(accessToken, "os-surge");

      expect(res.status).toBe(409);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("OS_ALREADY_INSTALLED");
    });

    it("should reject uninstalling the OS with 400 OS_PERMANENT", async () => {
      const { accessToken } = await registerAndCreateCharacter();
      const install = await json<ChromeInstallResponse>(await installOs(accessToken, "os-fury"));

      const res = await server.post(
        "/api/chrome/uninstall",
        { installedChromeId: install.installedChrome.installedId },
        authHeader(accessToken),
      );

      expect(res.status).toBe(400);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("OS_PERMANENT");
    });

    it("should reject installing any cromo on a flatlined character (403)", async () => {
      const { accessToken, characterId } = await registerAndCreateCharacter();
      await db("characters")
        .where("id", characterId)
        .update({ is_flatlined: true, flatlined_at: new Date() });

      const res = await installOs(accessToken, "os-fury");

      expect(res.status).toBe(403);
      const body = await json<ErrorBody>(res);
      expect(body.error).toBe("FLATLINED");
    });
  });
});
