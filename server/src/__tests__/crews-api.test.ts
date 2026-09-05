import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, type TestServer } from "./helpers";
import { db } from "../db";
import { cooldownConfig } from "../middleware/cooldown";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { crewRepository } from "../repositories/crew-repository";
import type {
  AuthResponse,
  ChatHistoryResponse,
  ChatMessage,
  CreateCrewResponse,
  CrewDetailResponse,
  CrewInvite,
  CrewMember,
} from "@neon-dusk/shared";

// ND-016 — Crews Básicas API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack), native fetch
// (supertest is incompatible with Fastify 5 + rate-limit). Dedicated redis
// db (14) so chat history, pub/sub, rate-limit counters and the global
// per-IP limiter never leak across files.
//
// Status-code notes vs the ND-016 spec: "crew full" is 409 CREW_FULL (the
// route uses 409, not 400), "target already in a crew" is 409 ALREADY_IN_CREW,
// "duplicate invite" is 409 ALREADY_INVITED and "kick a non-member" is 403
// NOT_CREW_MEMBER — the tests assert the implemented contract.

const REDIS_TEST_DB = "redis://localhost:56379/14";
const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `crew-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Ghost-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

interface CrewUser {
  accessToken: string;
  characterId: string;
  characterName: string;
}

describe("ND-016 — Crews Básicas API", () => {
  let app: FastifyInstance;
  let server: TestServer;
  let redis: Redis;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    await resetDb();

    // #187: chat/invite anti-spam is 500ms — widen to 5s so back-to-back
    // chat/invite tests deterministically trip the gate (same mutation
    // pattern as the circuitBreakerConfig overrides elsewhere).
    cooldownConfig.chat_message.durationMs = 5_000;
    cooldownConfig.crew_invite.durationMs = 5_000;

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    // RATE_LIMIT_MAX headroom: this suite makes ~200+ HTTP requests from
    // 127.0.0.1 within the global limiter's 60s window (and the limiter is
    // in-memory, so redis.flushdb() no longer resets it). The IP limiter has
    // its own dedicated suite — it must not trip mid-suite here.
    app = await buildApp({
      env: envSchema.parse({
        ...process.env,
        REDIS_URL: REDIS_TEST_DB,
        RATE_LIMIT_MAX: "1000",
      }),
    });
    server = await startTestServer(app);
  });

  afterAll(async () => {
    cooldownConfig.chat_message.durationMs = 500; // #187 defaults
    cooldownConfig.crew_invite.durationMs = 500;
    await app.close();
    redis.disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    await redis.flushdb();
  });

  // ─── Test seams ────────────────────────────────────────────────────────────

  /** Register a user + character over HTTP; returns token, ids and name. */
  async function registerApiUser(): Promise<CrewUser> {
    const res = await server.post("/api/auth/register", {
      email: uniqueEmail(),
      password: PASSWORD,
    });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);
    const characterName = uniqueName();
    const created = await server.post(
      "/api/characters",
      {
        name: characterName,
        origin: "a_paraiso",
        role: "bicho",
        attributes: { body: 5, reflexes: 4, intelligence: 4, technical: 4, cool: 5 },
      },
      authHeader(accessToken),
    );
    expect(created.status).toBe(201);
    const character = await json<{ id: string }>(created);
    return { accessToken, characterId: character.id, characterName };
  }

  /** Seed a wallet with the given balance (wallets.ensure creates it with 500). */
  async function seedWallet(characterId: string, balance: number): Promise<void> {
    await db.transaction(async (trx) => {
      await wallets.ensure(characterId, trx);
    });
    await db("character_wallets").where("character_id", characterId).update({ balance });
  }

  /** Set a character's Moral (direct DB — the API awards cap at 100/request). */
  async function setStreetCred(characterId: string, sc: number): Promise<void> {
    await db("characters")
      .where("id", characterId)
      .update({ street_cred: sc, max_street_cred_achieved: sc });
  }

  /** Make a character eligible to found a crew (SC >= 25, wallet >= 5000). */
  async function makeFounder(
    user: CrewUser,
    opts?: { balance?: number; sc?: number },
  ): Promise<void> {
    await setStreetCred(user.characterId, opts?.sc ?? 30);
    await seedWallet(user.characterId, opts?.balance ?? 6000);
  }

  /** POST /api/crews; returns status + parsed body. */
  async function createCrew(user: CrewUser, name: string, tag: string) {
    const res = await server.post("/api/crews", { name, tag }, authHeader(user.accessToken));
    return { status: res.status, body: await json<CreateCrewResponse | ErrorBody>(res) };
  }

  /** POST an invite; returns status + parsed body. */
  async function invite(leader: CrewUser, crewId: string, targetId: string) {
    const res = await server.post(
      `/api/crews/${crewId}/invite`,
      { characterId: targetId },
      authHeader(leader.accessToken),
    );
    return { status: res.status, body: await json<CrewInvite | ErrorBody>(res) };
  }

  /** POST join; returns status + parsed body. */
  async function join(user: CrewUser, crewId: string) {
    const res = await server.post(
      `/api/crews/${crewId}/join`,
      undefined,
      authHeader(user.accessToken),
    );
    return { status: res.status, body: await json<CrewMember | ErrorBody>(res) };
  }

  /**
   * Found a crew and recruit members until the desired size: the leader plus
   * every `recruits` entry (each invited then joined via the API).
   */
  async function buildCrew(
    leader: CrewUser,
    name: string,
    tag: string,
    recruits: CrewUser[] = [],
  ): Promise<string> {
    await makeFounder(leader);
    const created = await createCrew(leader, name, tag);
    expect(created.status).toBe(201);
    const { crew } = created.body as CreateCrewResponse;
    for (const recruit of recruits) {
      // ND-053: clear the invite anti-spam cooldown so a single leader can invite
      // several recruits in one test (this helper is setup, not the gate).
      await redis.del(`cooldown:${leader.characterId}:crew_invite`);
      expect((await invite(leader, crew.id, recruit.characterId)).status).toBe(201);
      expect((await join(recruit, crew.id)).status).toBe(201);
    }
    return crew.id;
  }

  /** Open the SSE stream, assert the handshake, then abort the connection. */
  async function openSseThenAbort(
    path: string,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    contentType: string | null;
    handshake: string;
    cors: {
      allowOrigin: string | null;
      vary: string | null;
      allowCredentials: string | null;
    };
  }> {
    const controller = new AbortController();
    const res = await fetch(`${base()}${path}`, { signal: controller.signal, headers });
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    controller.abort();
    await reader.cancel().catch(() => {});
    return {
      status: res.status,
      contentType: res.headers.get("content-type"),
      handshake: new TextDecoder().decode(value),
      cors: {
        allowOrigin: res.headers.get("access-control-allow-origin"),
        vary: res.headers.get("vary"),
        allowCredentials: res.headers.get("access-control-allow-credentials"),
      },
    };
  }

  /** Read a character's current crewId straight from the DB. */
  async function crewIdOf(characterId: string): Promise<string | null> {
    const [row] = await db("characters").select("crew_id").where("id", characterId);
    return row?.crew_id ?? null;
  }

  /** Clear the per-member crew chat rate-limit counter (test seam for the 5s window). */
  async function clearChatRateLimit(crewId: string, characterId: string): Promise<void> {
    await redis.del(`cooldown:${characterId}:chat_message`);
  }

  // ─── POST /api/crews — creation ────────────────────────────────────────────

  describe("POST /api/crews", () => {
    it("should create a crew when SC >= 25 and balance >= 5000", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "BLD");

      expect(status).toBe(201);
      const res = body as CreateCrewResponse;
      expect(res.crew.name).toBe("Blade Runners");
      expect(res.crew.tag).toBe("BLD");
      expect(res.crew.leaderId).toBe(leader.characterId);
      expect(res.crew.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.member.characterId).toBe(leader.characterId);
      expect(res.member.characterName).toBe(leader.characterName);
    });

    it("should debit exactly 5000 de Grana from the founder wallet", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader, { balance: 6000 });

      const { status } = await createCrew(leader, "Blade Runners", "BLD");
      expect(status).toBe(201);

      const [wallet] = await db("character_wallets")
        .select("*")
        .where("character_id", leader.characterId);
      expect(wallet!.balance).toBe(1000);
      expect(wallet!.lifetime_spent).toBe(5000);

      const [log] = await db("transaction_log")
        .select("*")
        .where("character_id", leader.characterId)
        .andWhere("type", "CREW_CREATION");
      expect(log).toMatchObject({
        type: "CREW_CREATION",
        amount: -5000,
        balance_before: 6000,
        balance_after: 1000,
      });
    });

    it("should add the founder as the first member (crew_id + crew_members row)", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "BLD");
      expect(status).toBe(201);
      const crewId = (body as CreateCrewResponse).crew.id;

      expect(await crewIdOf(leader.characterId)).toBe(crewId);
      const [member] = await db("crew_members")
        .select("*")
        .where("crew_id", crewId)
        .andWhere("character_id", leader.characterId);
      expect(member).toBeDefined();
    });

    it("should reject with 400 SC_TOO_LOW when SC < 25", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader, { sc: 24 });

      const { status, body } = await createCrew(leader, "Blade Runners", "BLD");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("SC_TOO_LOW");
      expect(err.message).toContain("25");
    });

    it("should reject with 400 INSUFFICIENT_FUNDS when balance < 5000", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader, { balance: 4999 });

      const { status, body } = await createCrew(leader, "Blade Runners", "BLD");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("INSUFFICIENT_FUNDS");
      expect(err.message).toContain("5000");
    });

    it("should allow creation with exactly 5000 de Grana (balance ends at 0)", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader, { balance: 5000 });

      const { status } = await createCrew(leader, "Blade Runners", "BLD");
      expect(status).toBe(201);

      const [wallet] = await db("character_wallets")
        .select("*")
        .where("character_id", leader.characterId);
      expect(wallet!.balance).toBe(0);
    });

    it("should reject a name shorter than 3 chars with 400 VALIDATION_ERROR", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "AB", "BLD");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toContain("3 e 20");
    });

    it("should reject a name longer than 20 chars with 400 VALIDATION_ERROR", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "A".repeat(21), "BLD");

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should reject a tag shorter than 3 chars with 400 VALIDATION_ERROR", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "BL");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toBe("Tag deve ter exatamente 3 letras ou números");
    });

    it("should reject a tag with special characters with 400 VALIDATION_ERROR", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "B!D");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("VALIDATION_ERROR");
    });

    it("should reject a tag longer than 3 chars with 400 VALIDATION_ERROR", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "BLDX");

      expect(status).toBe(400);
      expect((body as ErrorBody).error).toBe("VALIDATION_ERROR");
    });

    it("should normalize a lowercase tag to uppercase (accepted)", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "bld");

      expect(status).toBe(201);
      expect((body as CreateCrewResponse).crew.tag).toBe("BLD");
    });

    it("should claim the leader's origin district as territory (issue #18)", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      const { status, body } = await createCrew(leader, "Blade Runners", "BLD");
      expect(status).toBe(201);
      const crewId = (body as CreateCrewResponse).crew.id;

      const [row] = await db("crews").select("territory_district").where("id", crewId);
      expect(row!.territory_district).toBe("a_paraiso");
    });

    it("should silently skip the territory claim when the origin is occupied (issue #18)", async () => {
      const leaderA = await registerApiUser(); // origin a_paraiso
      const leaderB = await registerApiUser(); // origin a_paraiso
      await makeFounder(leaderA);
      await makeFounder(leaderB);

      expect((await createCrew(leaderA, "Blade Runners", "BLD")).status).toBe(201);
      const { status, body } = await createCrew(leaderB, "Other Crew", "OTH");

      expect(status).toBe(201); // no error — the district just stays unclaimed
      const crewBId = (body as CreateCrewResponse).crew.id;
      const [row] = await db("crews").select("territory_district").where("id", crewBId);
      expect(row!.territory_district).toBeNull();
    });

    it("should retry the territory claim via the savepoint when the district is claimed concurrently (issue #18)", async () => {
      const leaderA = await registerApiUser(); // origin a_paraiso
      const leaderB = await registerApiUser(); // origin a_paraiso
      await makeFounder(leaderA);
      await makeFounder(leaderB);

      // Force the race deterministically: findByTerritory always reports the
      // district free, so BOTH founders pass the pre-check and try to claim
      // a_paraiso. The second insert hits idx_crews_territory_district
      // (23505) → savepoint rollback → retry with territory_district: null
      // (ADR-0004 silent skip). Without the mock this catch branch only fires
      // when two real transactions overlap at the insert — timing-dependent,
      // never guaranteed by a Promise.all race.
      const spy = vi.spyOn(crewRepository, "findByTerritory").mockResolvedValue(null);
      try {
        const a = await createCrew(leaderA, "Blade Runners", "BLD");
        expect(a.status).toBe(201);
        const crewAId = (a.body as CreateCrewResponse).crew.id;

        const b = await createCrew(leaderB, "Other Crew", "OTH");
        expect(b.status).toBe(201);
        const crewBId = (b.body as CreateCrewResponse).crew.id;

        // Winner claimed the district; the loser's crew exists with null
        // territory (silent skip — no error surfaced to the client).
        const [crewA] = await db("crews").select("territory_district").where("id", crewAId);
        const [crewB] = await db("crews").select("territory_district").where("id", crewBId);
        expect(crewA!.territory_district).toBe("a_paraiso");
        expect(crewB!.territory_district).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it("should retry the territory claim once when two founders race the same district (issue #18)", async () => {
      const leaderA = await registerApiUser(); // origin a_paraiso
      const leaderB = await registerApiUser(); // origin a_paraiso
      await makeFounder(leaderA);
      await makeFounder(leaderB);

      // Real race (no mocks): both requests pass findByTerritory before either
      // commits, and distinct wallets mean no optimistic-lock serialization.
      // One insert wins idx_crews_territory_district; the loser hits the 23505
      // → savepoint rollback → retry with territory_district: null (ADR-0004).
      const [a, b] = await Promise.all([
        createCrew(leaderA, "Blade Runners", "BLD"),
        createCrew(leaderB, "Other Crew", "OTH"),
      ]);

      expect(a.status).toBe(201);
      expect(b.status).toBe(201);

      // Both crews exist, but exactly one claimed the district.
      const rows = await db("crews").select("territory_district");
      expect(rows).toHaveLength(2);
      expect(rows.filter((r) => r.territory_district === "a_paraiso")).toHaveLength(1);
      expect(rows.filter((r) => r.territory_district === null)).toHaveLength(1);
    });

    it("should default territory_district to null for crews inserted without it (pre-migration rows, issue #18)", async () => {
      const leader = await registerApiUser();

      // Direct insert omitting territory_district — simulates a crew row
      // created before migration 0035 (nullable column, no default). Such
      // rows must read back as NULL, not a bogus district.
      const [crew] = await db("crews")
        .insert({
          name: `Legacy-${Date.now()}`,
          tag: "LEG",
          leader_id: leader.characterId,
        })
        .returning("territory_district");

      expect(crew!.territory_district).toBeNull();
    });

    it("should reject a duplicate crew name with 409 DUPLICATE_NAME", async () => {
      const leaderA = await registerApiUser();
      const leaderB = await registerApiUser();
      await makeFounder(leaderA);
      await makeFounder(leaderB);

      expect((await createCrew(leaderA, "Blade Runners", "BLD")).status).toBe(201);
      const { status, body } = await createCrew(leaderB, "Blade Runners", "XXX");

      expect(status).toBe(409);
      const err = body as ErrorBody;
      expect(err.error).toBe("DUPLICATE_NAME");
    });

    it("should reject a duplicate tag with 409 DUPLICATE_TAG", async () => {
      const leaderA = await registerApiUser();
      const leaderB = await registerApiUser();
      await makeFounder(leaderA);
      await makeFounder(leaderB);

      expect((await createCrew(leaderA, "Blade Runners", "BLD")).status).toBe(201);
      const { status, body } = await createCrew(leaderB, "Other Crew", "BLD");

      expect(status).toBe(409);
      const err = body as ErrorBody;
      expect(err.error).toBe("DUPLICATE_TAG");
    });

    it("should reject with 409 ALREADY_IN_CREW when the founder is already affiliated", async () => {
      const leader = await registerApiUser();
      const other = await registerApiUser();
      await makeFounder(leader);
      await makeFounder(other);

      expect((await createCrew(leader, "Blade Runners", "BLD")).status).toBe(201);
      const { status, body } = await createCrew(leader, "Second Crew", "SEC");

      expect(status).toBe(409);
      expect((body as ErrorBody).error).toBe("ALREADY_IN_CREW");
    });

    it("should return 401 without an access token", async () => {
      const res = await server.post("/api/crews", { name: "Blade Runners", tag: "BLD" });
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });

    it("should let only one of two concurrent creates win (optimistic wallet lock)", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);

      // Both requests race the same wallet. Only one may win (201); the loser
      // trips whichever guard it reaches first after the winner commits: the
      // version-guarded debit (409 CONCURRENCY_CONFLICT), the affiliation
      // guard (409 ALREADY_IN_CREW), the name/tag uniqueness guard (409
      // DUPLICATE_*) or its own funds check seeing the winner's debit (400
      // INSUFFICIENT_FUNDS).
      const [a, b] = await Promise.all([
        createCrew(leader, "Blade Runners", "BLD"),
        createCrew(leader, "Blade Runners", "BLD"),
      ]);

      const statuses = [a.status, b.status].sort();
      expect(statuses[0]).toBe(201);
      expect([400, 409]).toContain(statuses[1]);
      const loser = a.status === 201 ? b : a;
      expect([
        "CONCURRENCY_CONFLICT",
        "ALREADY_IN_CREW",
        "DUPLICATE_NAME",
        "DUPLICATE_TAG",
        "INSUFFICIENT_FUNDS",
      ]).toContain((loser.body as ErrorBody).error);
      // Exactly one crew + one CREW_CREATION audit entry exist.
      const crewRows = await db("crews").select("*").where("name", "Blade Runners");
      expect(crewRows).toHaveLength(1);
      const logs = await db("transaction_log").select("*").where("type", "CREW_CREATION");
      expect(logs).toHaveLength(1);
    });
  });

  // ─── GET /api/crews/:id — details ──────────────────────────────────────────

  describe("GET /api/crews/:id", () => {
    it("should return the crew with members and no bonuses for a single-member crew", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await fetch(`${base()}/api/crews/${crewId}`, {
        headers: authHeader(leader.accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<CrewDetailResponse>(res);
      expect(body.crew.name).toBe("Blade Runners");
      expect(body.crew.tag).toBe("BLD");
      expect(body.members).toHaveLength(1);
      expect(body.members[0].characterId).toBe(leader.characterId);
      expect(body.bonuses).toEqual([]);
      expect(body.leaderboardPosition).toBe(1);
    });

    it("should reflect the gig_success bonus with 2 members", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [recruit]);

      const res = await fetch(`${base()}/api/crews/${crewId}`, {
        headers: authHeader(leader.accessToken),
      });
      const body = await json<CrewDetailResponse>(res);

      expect(body.members).toHaveLength(2);
      expect(body.bonuses).toEqual([
        { type: "gig_success", description: "+5% de chance de sucesso em trampos", value: 5 },
      ]);
    });

    it("should reflect all three bonuses with 4 members", async () => {
      const leader = await registerApiUser();
      const recruits = [await registerApiUser(), await registerApiUser(), await registerApiUser()];
      for (const r of recruits) await setStreetCred(r.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", recruits);

      const res = await fetch(`${base()}/api/crews/${crewId}`, {
        headers: authHeader(leader.accessToken),
      });
      const body = await json<CrewDetailResponse>(res);

      expect(body.members).toHaveLength(4);
      expect(body.bonuses.map((b) => b.type)).toEqual(["gig_success", "eddies", "street_cred"]);
    });

    it("should return 404 CREW_NOT_FOUND for a non-existent crew", async () => {
      const leader = await registerApiUser();

      const res = await fetch(`${base()}/api/crews/00000000-0000-0000-0000-000000000000`, {
        headers: authHeader(leader.accessToken),
      });

      expect(res.status).toBe(404);
      expect((await json<ErrorBody>(res)).error).toBe("CREW_NOT_FOUND");
    });
  });

  // ─── POST /api/crews/:id/invite — invites ──────────────────────────────────

  describe("POST /api/crews/:id/invite", () => {
    it("should let the leader invite an eligible recruit (SC >= 10)", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 10);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const { status, body } = await invite(leader, crewId, recruit.characterId);

      expect(status).toBe(201);
      const inv = body as CrewInvite;
      expect(inv.crewId).toBe(crewId);
      expect(inv.characterId).toBe(recruit.characterId);
      expect(inv.invitedBy).toBe(leader.characterId);
      expect(new Date(inv.expiresAt).getTime()).toBeGreaterThan(Date.now());
    });

    it("should reject a non-leader with 403 NOT_CREW_LEADER", async () => {
      const leader = await registerApiUser();
      const member = await registerApiUser();
      await setStreetCred(member.characterId, 20);
      const target = await registerApiUser();
      await setStreetCred(target.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [member]);

      const { status, body } = await invite(member, crewId, target.characterId);

      expect(status).toBe(403);
      expect((body as ErrorBody).error).toBe("NOT_CREW_LEADER");
    });

    it("should reject with 409 CREW_FULL when the crew already has 4 members", async () => {
      const leader = await registerApiUser();
      const recruits = [await registerApiUser(), await registerApiUser(), await registerApiUser()];
      for (const r of recruits) await setStreetCred(r.characterId, 20);
      const extra = await registerApiUser();
      await setStreetCred(extra.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", recruits);

      await redis.del(`cooldown:${leader.characterId}:crew_invite`);
      const { status, body } = await invite(leader, crewId, extra.characterId);

      expect(status).toBe(409);
      expect((body as ErrorBody).error).toBe("CREW_FULL");
    });

    it("should reject with 400 SC_TOO_LOW when the target has SC < 10", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 9);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const { status, body } = await invite(leader, crewId, recruit.characterId);

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("SC_TOO_LOW");
      expect(err.message).toContain("10");
    });

    it("should reject with 409 ALREADY_IN_CREW when the target belongs to another crew", async () => {
      const leader = await registerApiUser();
      const otherLeader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");
      await buildCrew(otherLeader, "Other Crew", "OTH", [recruit]);

      const { status, body } = await invite(leader, crewId, recruit.characterId);

      expect(status).toBe(409);
      expect((body as ErrorBody).error).toBe("ALREADY_IN_CREW");
    });

    it("should reject a duplicate live invite with 409 ALREADY_INVITED", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      // Clear the invite anti-spam cooldown so the second invite reaches the
      // business rule (ALREADY_INVITED) instead of the anti-cheat gate.
      await redis.del(`cooldown:${leader.characterId}:crew_invite`);
      expect((await invite(leader, crewId, recruit.characterId)).status).toBe(201);
      await redis.del(`cooldown:${leader.characterId}:crew_invite`);
      const { status, body } = await invite(leader, crewId, recruit.characterId);

      expect(status).toBe(409);
      expect((body as ErrorBody).error).toBe("ALREADY_INVITED");
    });

    it("should replace an expired invite with a fresh one", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const first = await invite(leader, crewId, recruit.characterId);
      expect(first.status).toBe(201);
      const { id: inviteId } = first.body as CrewInvite;
      // Backdate the invite so it is expired at the next invite attempt.
      await db("crew_invites")
        .where("id", inviteId)
        .update({ expires_at: new Date(Date.now() - 1000) });

      // Clear the invite anti-spam cooldown set by the first invite.
      await redis.del(`cooldown:${leader.characterId}:crew_invite`);
      const { status, body } = await invite(leader, crewId, recruit.characterId);

      expect(status).toBe(201);
      expect((body as CrewInvite).id).not.toBe(inviteId);
    });

    it("should return 404 NO_CHARACTER when the target does not exist", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const { status, body } = await invite(leader, crewId, "00000000-0000-0000-0000-000000000000");

      expect(status).toBe(404);
      expect((body as ErrorBody).error).toBe("NO_CHARACTER");
    });
  });

  // ─── POST /api/crews/:id/join — joining ────────────────────────────────────

  describe("POST /api/crews/:id/join", () => {
    it("should accept a valid invite: member added and characters.crew_id set", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");
      expect((await invite(leader, crewId, recruit.characterId)).status).toBe(201);

      const { status, body } = await join(recruit, crewId);

      expect(status).toBe(201);
      const member = body as CrewMember;
      expect(member.characterId).toBe(recruit.characterId);
      expect(member.characterName).toBe(recruit.characterName);
      expect(await crewIdOf(recruit.characterId)).toBe(crewId);

      const [row] = await db("crew_members")
        .select("*")
        .where("crew_id", crewId)
        .andWhere("character_id", recruit.characterId);
      expect(row).toBeDefined();
      // The invite is consumed on join.
      const [inviteRow] = await db("crew_invites")
        .select("*")
        .where("crew_id", crewId)
        .andWhere("character_id", recruit.characterId);
      expect(inviteRow).toBeUndefined();
    });

    it("should return 404 NO_INVITE when the character has no invite", async () => {
      const leader = await registerApiUser();
      const outsider = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const { status, body } = await join(outsider, crewId);

      expect(status).toBe(404);
      expect((body as ErrorBody).error).toBe("NO_INVITE");
    });

    it("should return 410 INVITE_EXPIRED for an expired invite", async () => {
      const leader = await registerApiUser();
      const recruit = await registerApiUser();
      await setStreetCred(recruit.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");
      expect((await invite(leader, crewId, recruit.characterId)).status).toBe(201);
      await db("crew_invites")
        .where("crew_id", crewId)
        .andWhere("character_id", recruit.characterId)
        .update({ expires_at: new Date(Date.now() - 1000) });

      const { status, body } = await join(recruit, crewId);

      expect(status).toBe(410);
      expect((body as ErrorBody).error).toBe("INVITE_EXPIRED");
    });

    it("should return 409 CREW_FULL when the crew fills up before the join", async () => {
      const leader = await registerApiUser();
      const late = await registerApiUser();
      const a = await registerApiUser();
      const b = await registerApiUser();
      const c = await registerApiUser();
      for (const r of [late, a, b, c]) await setStreetCred(r.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");
      // Invite everyone while there is room: crew 1 → invites for late/a/b/c.
      // (Clear the invite anti-spam cooldown between each so the anti-cheat gate
      // does not fire — this test targets CREW_FULL, not the cooldown.)
      for (const r of [late, a, b, c]) {
        await redis.del(`cooldown:${leader.characterId}:crew_invite`);
        expect((await invite(leader, crewId, r.characterId)).status).toBe(201);
      }
      // a, b, c join → crew full (4/4).
      for (const r of [a, b, c]) expect((await join(r, crewId)).status).toBe(201);

      const { status, body } = await join(late, crewId);

      expect(status).toBe(409);
      expect((body as ErrorBody).error).toBe("CREW_FULL");
    });
  });

  // ─── POST /api/crews/:id/leave ─────────────────────────────────────────────

  describe("POST /api/crews/:id/leave", () => {
    it("should remove a member and nullify characters.crew_id", async () => {
      const leader = await registerApiUser();
      const member = await registerApiUser();
      await setStreetCred(member.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [member]);

      const res = await server.post(
        `/api/crews/${crewId}/leave`,
        undefined,
        authHeader(member.accessToken),
      );

      expect(res.status).toBe(204);
      expect(await crewIdOf(member.characterId)).toBeNull();
      const [row] = await db("crew_members").select("*").where("character_id", member.characterId);
      expect(row).toBeUndefined();
      // Crew still exists with just the leader.
      const [crew] = await db("crews").select("*").where("id", crewId);
      expect(crew).toBeDefined();
    });

    it("should reject the leader with 400 LEADER_CANNOT_LEAVE", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await server.post(
        `/api/crews/${crewId}/leave`,
        undefined,
        authHeader(leader.accessToken),
      );

      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("LEADER_CANNOT_LEAVE");
    });

    it("should reject a non-member with 403 NOT_CREW_MEMBER", async () => {
      const leader = await registerApiUser();
      const outsider = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await server.post(
        `/api/crews/${crewId}/leave`,
        undefined,
        authHeader(outsider.accessToken),
      );

      expect(res.status).toBe(403);
      expect((await json<ErrorBody>(res)).error).toBe("NOT_CREW_MEMBER");
    });
  });

  // ─── DELETE /api/crews/:id/members/:characterId — kick ─────────────────────

  describe("DELETE /api/crews/:id/members/:characterId", () => {
    it("should let the leader kick a member", async () => {
      const leader = await registerApiUser();
      const member = await registerApiUser();
      await setStreetCred(member.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [member]);

      const res = await fetch(`${base()}/api/crews/${crewId}/members/${member.characterId}`, {
        method: "DELETE",
        headers: authHeader(leader.accessToken),
      });

      expect(res.status).toBe(204);
      expect(await crewIdOf(member.characterId)).toBeNull();
      const [row] = await db("crew_members").select("*").where("character_id", member.characterId);
      expect(row).toBeUndefined();
    });

    it("should reject a non-leader with 403 NOT_CREW_LEADER", async () => {
      const leader = await registerApiUser();
      const member = await registerApiUser();
      await setStreetCred(member.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [member]);

      const res = await fetch(`${base()}/api/crews/${crewId}/members/${member.characterId}`, {
        method: "DELETE",
        headers: authHeader(member.accessToken),
      });

      expect(res.status).toBe(403);
      expect((await json<ErrorBody>(res)).error).toBe("NOT_CREW_LEADER");
    });

    it("should reject kicking the leader with 400 CANNOT_KICK_LEADER", async () => {
      const leader = await registerApiUser();
      const member = await registerApiUser();
      await setStreetCred(member.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [member]);

      const res = await fetch(`${base()}/api/crews/${crewId}/members/${leader.characterId}`, {
        method: "DELETE",
        headers: authHeader(leader.accessToken),
      });

      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("CANNOT_KICK_LEADER");
    });

    it("should reject a target that is not a member with 403 NOT_CREW_MEMBER", async () => {
      const leader = await registerApiUser();
      const outsider = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await fetch(`${base()}/api/crews/${crewId}/members/${outsider.characterId}`, {
        method: "DELETE",
        headers: authHeader(leader.accessToken),
      });

      expect(res.status).toBe(403);
      expect((await json<ErrorBody>(res)).error).toBe("NOT_CREW_MEMBER");
    });
  });

  // ─── DELETE /api/crews/:id — dissolve ──────────────────────────────────────

  describe("DELETE /api/crews/:id", () => {
    it("should dissolve the crew: members' crew_id nullified and crew deleted", async () => {
      const leader = await registerApiUser();
      const members = [await registerApiUser(), await registerApiUser()];
      for (const m of members) await setStreetCred(m.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", members);

      const res = await fetch(`${base()}/api/crews/${crewId}`, {
        method: "DELETE",
        headers: authHeader(leader.accessToken),
      });

      expect(res.status).toBe(204);
      for (const user of [leader, ...members]) {
        expect(await crewIdOf(user.characterId)).toBeNull();
      }
      const [crew] = await db("crews").select("*").where("id", crewId);
      expect(crew).toBeUndefined();
      const memberRows = await db("crew_members").select("*").where("crew_id", crewId);
      expect(memberRows).toEqual([]);
      // The dissolved crew is no longer fetchable.
      const after = await fetch(`${base()}/api/crews/${crewId}`, {
        headers: authHeader(leader.accessToken),
      });
      expect(after.status).toBe(404);
    });

    it("should free the territory slot on dissolve (issue #18)", async () => {
      const leader = await registerApiUser(); // origin a_paraiso
      const nextLeader = await registerApiUser(); // origin a_paraiso
      await makeFounder(leader);
      await makeFounder(nextLeader);

      const crewId = await buildCrew(leader, "Blade Runners", "BLD");
      const [claimed] = await db("crews").select("territory_district").where("id", crewId);
      expect(claimed!.territory_district).toBe("a_paraiso");

      const res = await fetch(`${base()}/api/crews/${crewId}`, {
        method: "DELETE",
        headers: authHeader(leader.accessToken),
      });
      expect(res.status).toBe(204);

      // A new crew founded from the same origin reclaims the district.
      const { status, body } = await createCrew(nextLeader, "Next Crew", "NXT");
      expect(status).toBe(201);
      const nextCrewId = (body as CreateCrewResponse).crew.id;
      const [row] = await db("crews").select("territory_district").where("id", nextCrewId);
      expect(row!.territory_district).toBe("a_paraiso");
    });

    it("should reject a non-leader with 403 NOT_CREW_LEADER", async () => {
      const leader = await registerApiUser();
      const member = await registerApiUser();
      await setStreetCred(member.characterId, 20);
      const crewId = await buildCrew(leader, "Blade Runners", "BLD", [member]);

      const res = await fetch(`${base()}/api/crews/${crewId}`, {
        method: "DELETE",
        headers: authHeader(member.accessToken),
      });

      expect(res.status).toBe(403);
      expect((await json<ErrorBody>(res)).error).toBe("NOT_CREW_LEADER");
    });
  });

  // ─── Chat: POST /api/crews/:id/chat + GET history ──────────────────────────

  describe("crew chat", () => {
    it("should send a message with the crew tag and return it in history", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const send = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: "primeira ordem" },
        authHeader(leader.accessToken),
      );
      expect(send.status).toBe(201);
      const msg = (await json<ChatMessage | ErrorBody>(send)) as ChatMessage;
      expect(msg.characterName).toBe(leader.characterName);
      expect(msg.crewTag).toBe("BLD");
      expect(msg.message).toBe("primeira ordem");

      const history = await fetch(`${base()}/api/crews/${crewId}/chat/history`, {
        headers: authHeader(leader.accessToken),
      });
      expect(history.status).toBe(200);
      const historyBody = await json<ChatHistoryResponse>(history);
      expect(historyBody.messages).toHaveLength(1);
      expect(historyBody.messages[0].message).toBe("primeira ordem");
      expect(historyBody.messages[0].crewTag).toBe("BLD");
    });

    it("should return messages in chronological order (oldest first)", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      expect(
        (
          await server.post(
            `/api/crews/${crewId}/chat`,
            { message: "primeira" },
            authHeader(leader.accessToken),
          )
        ).status,
      ).toBe(201);
      await clearChatRateLimit(crewId, leader.characterId);
      expect(
        (
          await server.post(
            `/api/crews/${crewId}/chat`,
            { message: "segunda" },
            authHeader(leader.accessToken),
          )
        ).status,
      ).toBe(201);

      const history = await fetch(`${base()}/api/crews/${crewId}/chat/history`, {
        headers: authHeader(leader.accessToken),
      });
      const historyBody = await json<ChatHistoryResponse>(history);
      expect(historyBody.messages.map((m) => m.message)).toEqual(["primeira", "segunda"]);
    });

    it("should reject the second message within the anti-spam window with 429 COOLDOWN_ACTIVE", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const first = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: "primeira" },
        authHeader(leader.accessToken),
      );
      expect(first.status).toBe(201);

      // ND-053: the chat anti-spam gate fires on the second message (#187:
      // 500ms window, widened to 5s in this suite for stability).
      const second = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: "segunda" },
        authHeader(leader.accessToken),
      );
      expect(second.status).toBe(429);
      expect((await json<ErrorBody>(second)).error).toBe("COOLDOWN_ACTIVE");
    });

    it("should allow a message after the rate-limit window is cleared", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      expect(
        (
          await server.post(
            `/api/crews/${crewId}/chat`,
            { message: "primeira" },
            authHeader(leader.accessToken),
          )
        ).status,
      ).toBe(201);
      await clearChatRateLimit(crewId, leader.characterId);

      const second = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: "segunda" },
        authHeader(leader.accessToken),
      );
      expect(second.status).toBe(201);
    });

    it("should HTML-escape special characters in the message", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const send = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: `<script>alert("x")&'` },
        authHeader(leader.accessToken),
      );
      expect(send.status).toBe(201);
      const msg = (await json<ChatMessage | ErrorBody>(send)) as ChatMessage;
      expect(msg.message).toBe("&lt;script&gt;alert(&quot;x&quot;)&amp;&#039;");
    });

    it("should reject a non-member send with 403 NOT_CREW_MEMBER", async () => {
      const leader = await registerApiUser();
      const outsider = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const send = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: "invadindo" },
        authHeader(outsider.accessToken),
      );

      expect(send.status).toBe(403);
      expect((await json<ErrorBody>(send)).error).toBe("NOT_CREW_MEMBER");
    });

    it("should reject a non-member history read with 403 NOT_CREW_MEMBER", async () => {
      const leader = await registerApiUser();
      const outsider = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const history = await fetch(`${base()}/api/crews/${crewId}/chat/history`, {
        headers: authHeader(outsider.accessToken),
      });

      expect(history.status).toBe(403);
      expect((await json<ErrorBody>(history)).error).toBe("NOT_CREW_MEMBER");
    });

    it("should reject an empty message with 400 VALIDATION_ERROR", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const send = await server.post(
        `/api/crews/${crewId}/chat`,
        { message: " " },
        authHeader(leader.accessToken),
      );

      expect(send.status).toBe(400);
      const err = await json<ErrorBody>(send);
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toBe("Mensagem não pode estar vazia");
    });

    it("should return 401 for chat endpoints without a token", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const send = await server.post(`/api/crews/${crewId}/chat`, { message: "oi" });
      expect(send.status).toBe(401);

      const history = await fetch(`${base()}/api/crews/${crewId}/chat/history`);
      expect(history.status).toBe(401);
    });
  });

  // ─── GET /api/crews/:id/chat/stream — SSE ──────────────────────────────────

  describe("GET /api/crews/:id/chat/stream", () => {
    it("should let a member connect (text/event-stream + :ok handshake)", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const sse = await openSseThenAbort(
        `/api/crews/${crewId}/chat/stream`,
        authHeader(leader.accessToken),
      );

      expect(sse.status).toBe(200);
      expect(sse.contentType).toContain("text/event-stream");
      expect(sse.handshake).toContain(":ok");
    });

    it("should accept the access token as a query param (EventSource has no headers)", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const sse = await openSseThenAbort(
        `/api/crews/${crewId}/chat/stream?token=${encodeURIComponent(leader.accessToken)}`,
      );

      expect(sse.status).toBe(200);
      expect(sse.handshake).toContain(":ok");
    });

    it("should send CORS headers on the hijacked SSE response (ADR-1)", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const sse = await openSseThenAbort(
        `/api/crews/${crewId}/chat/stream`,
        authHeader(leader.accessToken),
      );

      expect(sse.status).toBe(200);
      expect(sse.cors.allowOrigin).toBe("http://localhost:5173");
      expect(sse.cors.vary).toContain("Origin");
      expect(sse.cors.allowCredentials).toBe("true");
    });

    it("should reject a non-member with 403 NOT_CREW_MEMBER", async () => {
      const leader = await registerApiUser();
      const outsider = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await fetch(`${base()}/api/crews/${crewId}/chat/stream`, {
        headers: authHeader(outsider.accessToken),
      });

      expect(res.status).toBe(403);
      expect((await json<ErrorBody>(res)).error).toBe("NOT_CREW_MEMBER");
    });

    it("should reject an invalid token with 401", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await fetch(`${base()}/api/crews/${crewId}/chat/stream`, {
        headers: authHeader("not-a-real-token"),
      });

      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });

    it("should reject a missing token with 401", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Blade Runners", "BLD");

      const res = await fetch(`${base()}/api/crews/${crewId}/chat/stream`);

      expect(res.status).toBe(401);
    });
  });

  // ─── Anti-cheat Middleware Chain Smoke Tests ─────────────────────────────

  describe("anti-cheat middleware chain", () => {
    it("should include X-RateLimit-Remaining on crew create", async () => {
      const leader = await registerApiUser();
      await makeFounder(leader);
      const res = await fetch(`${base()}/api/crews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(leader.accessToken) },
        body: JSON.stringify({ name: "Smoke Test Crew", tag: "SMK" }),
      });
      expect(res.status).toBeLessThan(400);
      expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    });

    it("should include X-RateLimit-Remaining on crew invite", async () => {
      const leader = await registerApiUser();
      const target = await registerApiUser();
      await setStreetCred(target.characterId, 10);
      const crewId = await buildCrew(leader, "Smoke Test Crew", "SMK");
      const res = await fetch(`${base()}/api/crews/${crewId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(leader.accessToken) },
        body: JSON.stringify({ characterId: target.characterId }),
      });
      expect(res.status).toBeLessThan(400);
      expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    });

    it("should include X-RateLimit-Remaining on crew chat", async () => {
      const leader = await registerApiUser();
      const crewId = await buildCrew(leader, "Smoke Test Crew", "SMK");
      const res = await fetch(`${base()}/api/crews/${crewId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader(leader.accessToken) },
        body: JSON.stringify({ message: "Smoke test message" }),
      });
      expect(res.headers.get("x-ratelimit-remaining")).toBeTruthy();
    });
  });

  // ─── Zod params validation (ND-053) ────────────────────────────────────────
  // join/leave/kick/dissolve parse `:id` (and kick's `:characterId`) with a
  // UUID schema. A non-UUID id must yield 400 VALIDATION_ERROR, not a 500.

  describe("Zod params validation (invalid UUID)", () => {
    /**
     * Register over HTTP + insert the character directly (bypasses the
     * POST /characters flow — this block targets Zod params, not creation).
     */
    async function userWithCharacter(): Promise<CrewUser> {
      const res = await server.post("/api/auth/register", {
        email: uniqueEmail(),
        password: PASSWORD,
      });
      expect(res.status).toBe(201);
      const { accessToken, user } = await json<AuthResponse>(res);
      const [character] = await db("characters")
        .insert({
          user_id: user.id,
          name: uniqueName(),
          origin: "a_paraiso",
          role: "bicho",
          body: 5,
          reflexes: 4,
          intelligence: 4,
          technical: 4,
          cool: 5,
        })
        .returning("id");
      return { accessToken, characterId: character.id, characterName: uniqueName() };
    }

    it("should return 400 VALIDATION_ERROR for a non-UUID crew id on join", async () => {
      const user = await userWithCharacter();
      const res = await server.post(
        "/api/crews/not-a-uuid/join",
        undefined,
        authHeader(user.accessToken),
      );
      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for a non-UUID crew id on leave", async () => {
      const user = await userWithCharacter();
      const res = await server.post(
        "/api/crews/not-a-uuid/leave",
        undefined,
        authHeader(user.accessToken),
      );
      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for a non-UUID crew id on dissolve", async () => {
      const user = await userWithCharacter();
      const res = await fetch(`${base()}/api/crews/not-a-uuid`, {
        method: "DELETE",
        headers: authHeader(user.accessToken),
      });
      expect(res.status).toBe(400);
      expect((await json<ErrorBody>(res)).error).toBe("VALIDATION_ERROR");
    });

    it("should return 400 VALIDATION_ERROR for a non-UUID crew id or character id on kick", async () => {
      const user = await userWithCharacter();
      // Non-UUID crew id.
      const badCrew = await fetch(`${base()}/api/crews/not-a-uuid/members/${user.characterId}`, {
        method: "DELETE",
        headers: authHeader(user.accessToken),
      });
      expect(badCrew.status).toBe(400);
      expect((await json<ErrorBody>(badCrew)).error).toBe("VALIDATION_ERROR");

      // Non-UUID character id.
      const badChar = await fetch(`${base()}/api/crews/${user.characterId}/members/not-a-uuid`, {
        method: "DELETE",
        headers: authHeader(user.accessToken),
      });
      expect(badChar.status).toBe(400);
      expect((await json<ErrorBody>(badChar)).error).toBe("VALIDATION_ERROR");
    });
  });
});
