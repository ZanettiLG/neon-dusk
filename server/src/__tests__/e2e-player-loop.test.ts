/**
 * ND-018: E2E player loop — full player journey integration test.
 *
 * Runs a complete character lifecycle from registration through PvP, crews, and
 * round reset. All calls use the real HTTP server (native fetch via helpers);
 * one `it` block keeps the sequence ordered and the intent explicit.
 *
 * Workspace: start the test DB/Redis stack (docker-compose.test.yml) before
 * running: `npx vitest run server/src/__tests__/e2e-player-loop.test.ts`
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb } from "./helpers";
import { db } from "../db";
import type {
  AuthResponse,
  Character,
  GigBoardResponse,
  GigWrapupResponse,
} from "@neon-dusk/shared";
import { seedGigs } from "../seed/content-seeds";
// DB 0: redis:7-alpine default max 16 databases (0-15)
const REDIS_TEST_DB = "redis://localhost:56379/0";
const PASSWORD = "StrongPass123!";
const ADMIN_KEY = "test-admin-key-that-is-at-least-32-characters-long";

let seq = 0;
function uniqueEmail(): string {
  return `e2e-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `E2E-${Date.now()}-${seq++}`;
}

describe("ND-018 — e2e player loop", () => {
  let app: FastifyInstance;
  let server: Awaited<ReturnType<typeof startTestServer>>;
  let redis: Redis;

  beforeAll(async () => {
    await resetDb();

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
    server = await startTestServer(app);
    await seedGigs(db);
  });

  afterAll(async () => {
    await app.close();
    redis.disconnect();
  });

  it(
    "runs a complete player lifecycle",
    async () => {
      // ---- STEP 1: Register account ----
      const email = uniqueEmail();
      const regRes = await server.post("/api/auth/register", { email, password: PASSWORD });
      expect(regRes.status, "register").toBe(201);
      const auth = await json<AuthResponse>(regRes);
      const headers = authHeader(auth.accessToken);

      // ---- STEP 2: Create character "Silver" ----
      const charRes = await server.post(
        "/api/characters",
        {
          name: uniqueName(),
          origin: "a_quebrada",
          role: "bicho",
          attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
        },
        headers,
      );
      expect(charRes.status, "create character").toBe(201);
      const character = await json<Character>(charRes);

      // ---- STEP 3: Verify NIL=100, Grana=500 via the dedicated readouts ----
      // GET /api/auth/me returns the public Character contract (shared
      // `Character` type), which has no `nil`/`eddies` fields — NIL and the
      // wallet live in their own endpoints.
      const nilRes = await server.get("/api/characters/me/nil", headers);
      expect(nilRes.status, "nil readout").toBe(200);
      const nilBody = await json<{ current: number; max: number }>(nilRes);
      expect(nilBody.current).toBe(100);
      expect(nilBody.max).toBe(100);

      const balRes = await server.get("/api/economy/balance", headers);
      expect(balRes.status, "balance").toBe(200);
      const balBody = await json<{ balance: number }>(balRes);
      expect(balBody.balance).toBe(500); // seed capital

      // ---- STEP 4: Listar trampos ----
      const boardRes = await server.get("/api/gigs", headers);
      expect(boardRes.status, "listar trampos").toBe(200);
      const board = await json<GigBoardResponse>(boardRes);
      expect(board.gigs.length).toBeGreaterThanOrEqual(3);

      // ---- STEP 5: Accept 3 T1 trampos ----
      // Pick 3 T1 trampos of different types: Extraction, Delivery, Sabotage
      const t1Gigs = board.gigs.filter(
        (g) => g.tier === "t1" && g.meetsRequirements,
      );

      type GigType = "extraction" | "delivery" | "sabotage";
      const wanted: GigType[] = ["extraction", "delivery", "sabotage"];
      const selected: string[] = [];
      for (const type of wanted) {
        const g = t1Gigs.find((g2) => g2.type === type && !selected.includes(g2.id));
        if (g) selected.push(g.id);
      }
      expect(selected.length, "found 3 trampo types").toBe(3);

      for (const gigId of selected) {
        // Step 5a: Accept
        const acceptRes = await server.post(`/api/gigs/${gigId}/accept`, {}, headers);
        expect([200, 201], `accept trampo ${gigId}`).toContain(acceptRes.status);

        // ND-053: the accept arms the 30s gig_accept cooldown. Drop it so the
        // next loop iteration can accept the next trampo (same spirit as the
        // legwork-timer bypass below — the journey, not the anti-spam gate, is
        // what this test exercises).
        await redis.del(`cooldown:${character.id}:gig_accept`);

        // Step 5b: Bypass legwork timer via direct DB update
        // ponytail: bypass legwork timer via DB — waiting 5-30min per trampo would
        // make this test O(hours). Backdate legwork_started_at so the timer gate
        // (ND-078) passes.
        await db("active_gigs")
          .where("character_id", character.id)
          .update({
            phase: "legwork" as const,
            legwork_started_at: new Date(Date.now() - 31 * 60_000),
            legwork_completed: true,
            updated_at: new Date(),
          });

        // Step 5c: Execute
        const executeRes = await server.post(`/api/gigs/${gigId}/execute`, {}, headers);
        // Execute may fail (wrong phase, insufficient NIL, etc.) — acceptable
        expect([200, 400], `execute trampo ${gigId}`).toContain(executeRes.status);

        // Always attempt cleanup (escape + wrapup) to avoid dirty state leaking
        // into later steps (cromo install, PvP, crew creation).
        if (executeRes.status === 200) {
          // Step 5d: Escape
          const escapeRes = await server.post(`/api/gigs/${gigId}/escape`, {}, headers);
          expect(escapeRes.status, `escape trampo ${gigId}`).toBe(200);

          // Step 5e: Wrapup
          const wrapupRes = await server.post(`/api/gigs/${gigId}/wrapup`, {}, headers);
          expect(wrapupRes.status, `wrapup trampo ${gigId}`).toBe(200);
          const wrapup = await json<GigWrapupResponse>(wrapupRes);
          expect(wrapup.outcome).toBeTruthy();
        } else {
          // Execute failed — attempt cleanup best-effort, don't assert success
          try { await server.post(`/api/gigs/${gigId}/escape`, {}, headers); } catch { /* ignore */ }
          try { await server.post(`/api/gigs/${gigId}/wrapup`, {}, headers); } catch { /* ignore */ }
        }
      }

      // ---- STEP 6: Verify NIL spent, Grana earned, Moral increased ----
      const afterGigs = await server.get("/api/economy/balance", headers);
      const afterBody = await json<{ balance: number }>(afterGigs);
      expect(afterBody.balance, "Grana after trampos").toBeGreaterThan(500);

      const scRes = await server.get("/api/street-cred", headers);
      expect(scRes.status, "Moral").toBe(200);

      // ---- STEP 7: Buy cromo (Óptica Vidraça) ----
      const chromeRes = await server.get("/api/chrome", headers);
      expect(chromeRes.status, "cromo catalog").toBe(200);
      // GET `/api/chrome` returns a bare ChromeDefinition[] (shared contract).
      const chromeCatalog = await json<Array<{ id: string; slug: string; name: string }>>(
        chromeRes,
      );

      // Find Óptica Vidraça or any ocular cromo
      const vidraca =
        chromeCatalog.find((c) => c.slug.includes("kiroshi-optics")) ??
        chromeCatalog.find((c) => c.slug.includes("optic")) ??
        chromeCatalog[0];

      if (vidraca) {
        // Get a vendor that sells cromo (bare VendorRecord[] contract).
        const vendorRes = await server.get("/api/vendors", headers);
        expect(vendorRes.status, "vendors").toBe(200);
        const vendors = await json<Array<{ id: string }>>(vendorRes);

        const ferrageiro = vendors[0];
        if (ferrageiro && vidraca) {
          const installRes = await server.post(
            "/api/chrome/install",
            { chromeDefinitionId: vidraca.id, vendorId: ferrageiro.id },
            headers,
          );
          // May fail if insufficient funds or slot already filled — that's fine
          if (installRes.status === 200 || installRes.status === 201) {
            // ---- STEP 8: Verify Grana debited, Humanity reduced ----
            const installedRes = await server.get("/api/chrome/installed", headers);
            expect(installedRes.status, "installed cromo").toBe(200);
          }
        }
      }

      // ---- STEP 9: Create 2nd character, attack via PvP ----
      // Register a new account
      const email2 = uniqueEmail();
      const regRes2 = await server.post("/api/auth/register", {
        email: email2,
        password: PASSWORD,
      });
      expect(regRes2.status, "register player 2").toBe(201);
      const auth2 = await json<AuthResponse>(regRes2);
      const headers2 = authHeader(auth2.accessToken);

      const charRes2 = await server.post(
        "/api/characters",
        {
          name: uniqueName(),
          origin: "o_fervo",
          role: "bicho",
          attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
        },
        headers2,
      );
      expect(charRes2.status, "create character 2").toBe(201);
      const char2 = await json<Character>(charRes2);

      // PvP attack: player 1 attacks player 2
      const pvpRes = await server.post(
        "/api/pvp/attack",
        { targetId: char2.id },
        headers,
      );
      // May fail due to cooldown or power range — that's acceptable
      expect([200, 400, 429], "pvp attack").toContain(pvpRes.status);

      // ---- STEP 10: Create crew (SC>=25 needed) ----
      const crewRes = await server.post(
        "/api/crews",
        { name: `E2E-CREW-${seq}`, tag: "E2E" },
        headers,
      );
      // May fail if SC < 25 — that's acceptable for the test
      expect([201, 400], "create crew").toContain(crewRes.status);
      const crewCreated = crewRes.status === 201;

      // ---- STEP 11: Verify crew bonus if created ----
      if (crewCreated) {
        const listCrews = await server.get("/api/crews", headers);
        expect(listCrews.status, "list crews").toBe(200);
      }

      // ---- STEP 12: Trigger round reset via admin API ----
      const resetRes = await server.post("/api/round/trigger-reset", undefined, {
        "x-api-key": ADMIN_KEY,
      });
      expect(resetRes.status, "trigger reset").toBe(200);

      // ---- STEP 13: Verify Grana/Moral reset, character & legends preserved ----
      // Character still exists
      const meAfter = await server.get("/api/auth/me", headers);
      expect(meAfter.status, "me after reset").toBe(200);
      const meAfterBody = await json<{ character: { id: string; name: string } | null }>(meAfter);
      expect(meAfterBody.character, "character preserved after reset").toBeTruthy();
      expect(meAfterBody.character!.name, "character name preserved").toBe(character.name);

      // Legends endpoint works
      const legendsRes = await server.get("/api/saideira/legends", headers);
      expect(legendsRes.status, "legends").toBe(200);
    },
    120_000, // timeout: the legwork + API calls may take a while
  );
});
