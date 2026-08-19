import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, type TestServer } from "./helpers";
import { db } from "../db";
import type {
  AuthResponse,
  SaideiraHubInfo,
  ChatMessage,
  ChatHistoryResponse,
  LegendsResponse,
  CrewLeaderboardResponse,
} from "@neon-dusk/shared";

// ND-015 — Saideira Hub API integration tests. Real HTTP against the app
// (Fastify + Postgres + Redis on the isolated test stack), native fetch
// (supertest is incompatible with Fastify 5 + rate-limit). Dedicated redis
// db (13) so chat history, pub/sub and rate-limit counters never leak across
// files. The legends table + seed come from migration 0009 (applied to the
// test DB); resetDb does NOT touch legends, so the seed rows persist.

const REDIS_TEST_DB = "redis://localhost:56379/13";
const PASSWORD = "StrongPass123!";

let seq = 0;
function uniqueEmail(): string {
  return `saideira-${Date.now()}-${seq++}@neondusk.test`;
}
function uniqueName(): string {
  return `Runner-${Date.now()}-${seq++}`;
}

interface ErrorBody {
  error: string;
  message: string;
  details?: { path: (string | number)[]; message: string }[];
}

interface ApiUser {
  accessToken: string;
  characterId: string;
  characterName: string;
}

describe("ND-015 — Saideira Hub API", () => {
  let app: FastifyInstance;
  let server: TestServer;
  let redis: Redis;
  const base = () => `http://127.0.0.1:${server.port}`;

  beforeAll(async () => {
    await resetDb();

    redis = new Redis(REDIS_TEST_DB, { lazyConnect: true });
    await redis.connect();
    await redis.flushdb();

    // RATE_LIMIT_MAX headroom: this suite makes ~100+ HTTP requests from
    // 127.0.0.1 within the global limiter's 60s window — the IP limiter has
    // its own dedicated suite, so it must not trip mid-suite here.
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
    await app.close();
    redis.disconnect();
  });

  beforeEach(async () => {
    await resetDb();
    await redis.flushdb();
  });

  // ─── Test seams ────────────────────────────────────────────────────────────

  /** Register a user over HTTP but do NOT create a character. */
  async function registerUserOnly(): Promise<string> {
    const res = await server.post("/api/auth/register", { email: uniqueEmail(), password: PASSWORD });
    expect(res.status).toBe(201);
    const { accessToken } = await json<AuthResponse>(res);
    return accessToken;
  }

  /** Register a user + character over HTTP; returns token, ids and name. */
  async function registerApiUser(): Promise<ApiUser> {
    const accessToken = await registerUserOnly();
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

  /** POST a chat message; returns status + parsed body. */
  async function postChat(token: string, message: string) {
    const res = await server.post("/api/saideira/chat", { message }, authHeader(token));
    return { status: res.status, body: await json<ChatMessage | ErrorBody>(res) };
  }

  /** Open the SSE stream, assert the handshake, then abort the connection. */
  async function openSseThenAbort(
    path: string,
    headers?: Record<string, string>,
  ): Promise<{
    status: number;
    contentType: string | null;
    handshake: string;
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
    };
  }

  /**
   * Seed a crew directly in the DB (bypasses the ND-016 create flow — that is
   * covered in crews-api.test.ts). The first member is the leader; every
   * member gets `street_cred` and their characters.crew_id set.
   */
  async function seedCrew(
    name: string,
    tag: string,
    members: { characterId: string; streetCred: number }[],
  ): Promise<void> {
    const [crew] = await db("crews")
      .insert({ name, tag, leader_id: members[0].characterId })
      .returning("id");
    await db("crew_members").insert(
      members.map((m) => ({ crew_id: crew.id, character_id: m.characterId })),
    );
    for (const m of members) {
      await db("characters")
        .where("id", m.characterId)
        .update({ street_cred: m.streetCred, max_street_cred_achieved: m.streetCred, crew_id: crew.id });
    }
  }

  // ─── GET /api/saideira ─────────────────────────────────────────────────────

  describe("GET /api/saideira", () => {
    it("should return hub info with onlineCount, lastReset and currentRound (ND-017 real data)", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<SaideiraHubInfo>(res);
      expect(body.onlineCount).toBeTypeOf("number");
      // Round data is real (ND-017): lastReset is null until a round has ended.
      expect(body.lastReset === null || typeof body.lastReset === "string").toBe(true);
      expect(body.currentRound).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(body.roundEndsAt))).toBe(false);
    });

    it("should return 401 without an access token", async () => {
      const res = await fetch(`${base()}/api/saideira`);
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });

    it("should count auth:active:* keys as onlineCount", async () => {
      const { accessToken } = await registerApiUser();
      // Two other "online" users tracked by telemetry (ND-007).
      await redis.set("auth:active:user-a", "1", "EX", 60);
      await redis.set("auth:active:user-b", "1", "EX", 60);

      const res = await fetch(`${base()}/api/saideira`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<SaideiraHubInfo>(res);
      // 2 seeded keys + the authenticated user's own active key (authenticate
      // fires trackActiveUser on the same Redis connection before the scan).
      expect(body.onlineCount).toBe(3);
    });
  });

  // ─── POST /api/saideira/chat ───────────────────────────────────────────────

  describe("POST /api/saideira/chat", () => {
    it("should send a message and return 201 with the ChatMessage", async () => {
      const { accessToken, characterName } = await registerApiUser();

      const { status, body } = await postChat(accessToken, "alguém viu o Carcará?");

      expect(status).toBe(201);
      const msg = body as ChatMessage;
      expect(msg.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(msg.characterName).toBe(characterName);
      expect(msg.crewTag).toBeNull();
      expect(msg.message).toBe("alguém viu o Carcará?");
      expect(new Date(msg.createdAt).toISOString()).toBe(msg.createdAt);
    });

    it("should reject an empty message with 400 VALIDATION_ERROR", async () => {
      const { accessToken } = await registerApiUser();

      const { status, body } = await postChat(accessToken, "");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toBe("Mensagem não pode estar vazia");
    });

    it("should reject a message longer than 500 chars with 400 VALIDATION_ERROR", async () => {
      const { accessToken } = await registerApiUser();

      const { status, body } = await postChat(accessToken, "x".repeat(501));

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toBe("Mensagem muito longa (máx. 500 caracteres)");
    });

    it("should reject a spaces-only message with 400 VALIDATION_ERROR", async () => {
      const { accessToken } = await registerApiUser();

      const { status, body } = await postChat(accessToken, "   ");

      expect(status).toBe(400);
      const err = body as ErrorBody;
      expect(err.error).toBe("VALIDATION_ERROR");
      expect(err.details?.[0].message).toBe("Mensagem não pode estar vazia");
    });

    it("should reject unauthenticated requests with 401", async () => {
      const res = await server.post("/api/saideira/chat", { message: "oi" });
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });

    it("should reject a user without a character with 404 NO_CHARACTER", async () => {
      const accessToken = await registerUserOnly();

      const { status, body } = await postChat(accessToken, "sem personagem");

      expect(status).toBe(404);
      const err = body as ErrorBody;
      expect(err.error).toBe("NO_CHARACTER");
    });

    it("should reject the second message within 5s with 429 COOLDOWN_ACTIVE", async () => {
      const { accessToken } = await registerApiUser();

      const first = await postChat(accessToken, "primeira");
      expect(first.status).toBe(201);

      // ND-053: the 5s chat cooldown gate fires before the rate limiter.
      const second = await postChat(accessToken, "segunda");
      expect(second.status).toBe(429);
      expect((second.body as ErrorBody).error).toBe("COOLDOWN_ACTIVE");
    });

    it("should allow a message after the rate-limit window expires", async () => {
      const { accessToken, characterId } = await registerApiUser();

      const first = await postChat(accessToken, "primeira");
      expect(first.status).toBe(201);
      // Simulate the 5s window passing (test seam — real clock would be slow):
      // clear the cooldown gate + the per-character rate counter.
      await redis.del(`cooldown:${characterId}:chat_message`);
      await redis.del(`rate:${characterId}:saideira_chat`);

      const second = await postChat(accessToken, "segunda");
      expect(second.status).toBe(201);
    });

    it("should HTML-escape special characters in the message", async () => {
      const { accessToken } = await registerApiUser();

      const { status, body } = await postChat(accessToken, `<script>alert("x")&'`);

      expect(status).toBe(201);
      const msg = body as ChatMessage;
      expect(msg.message).toBe("&lt;script&gt;alert(&quot;x&quot;)&amp;&#039;");
    });

    it("should attach the crew tag (ND-016) when the character belongs to a crew", async () => {
      const { accessToken, characterId } = await registerApiUser();
      await seedCrew("Filhos do Fluxo", "FLX", [{ characterId, streetCred: 30 }]);

      const { status, body } = await postChat(accessToken, "o Fluxo manda lembranças");

      expect(status).toBe(201);
      const msg = body as ChatMessage;
      expect(msg.crewTag).toBe("FLX");

      // The tag is persisted in the history payload too.
      const history = await fetch(`${base()}/api/saideira/chat/history`, {
        headers: authHeader(accessToken),
      });
      const historyBody = await json<ChatHistoryResponse>(history);
      expect(historyBody.messages[0].crewTag).toBe("FLX");
    });

    it("should keep crewTag null when the character has no crew (ND-016)", async () => {
      const { accessToken } = await registerApiUser();
      // A crew exists — but this character is NOT a member.
      const other = await registerApiUser();
      await seedCrew("Filhos do Fluxo", "FLX", [{ characterId: other.characterId, streetCred: 30 }]);

      const { status, body } = await postChat(accessToken, "sou um coringa");

      expect(status).toBe(201);
      expect((body as ChatMessage).crewTag).toBeNull();
    });
  });

  // ─── GET /api/saideira/chat/stream ─────────────────────────────────────────

  describe("GET /api/saideira/chat/stream", () => {
    it("should return 401 without a token", async () => {
      const res = await fetch(`${base()}/api/saideira/chat/stream`);
      expect(res.status).toBe(401);
    });

    it("should return 401 with an invalid token", async () => {
      const res = await fetch(`${base()}/api/saideira/chat/stream`, {
        headers: authHeader("not-a-real-token"),
      });
      expect(res.status).toBe(401);
    });

    it("should open a text/event-stream connection with the :ok handshake", async () => {
      const { accessToken } = await registerApiUser();

      const sse = await openSseThenAbort("/api/saideira/chat/stream", authHeader(accessToken));
      expect(sse.status).toBe(200);
      expect(sse.contentType).toContain("text/event-stream");
      expect(sse.handshake).toContain(":ok");
    });

    it("should accept the access token as a query param (EventSource has no headers)", async () => {
      const { accessToken } = await registerApiUser();

      const sse = await openSseThenAbort(
        `/api/saideira/chat/stream?token=${encodeURIComponent(accessToken)}`,
      );
      expect(sse.status).toBe(200);
      expect(sse.handshake).toContain(":ok");
    });
  });

  // ─── GET /api/saideira/chat/history ────────────────────────────────────────

  describe("GET /api/saideira/chat/history", () => {
    it("should return an empty messages array initially", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/chat/history`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<ChatHistoryResponse>(res);
      expect(body.messages).toEqual([]);
    });

    it("should return sent messages in chronological order (oldest first)", async () => {
      const { accessToken, characterId } = await registerApiUser();

      expect((await postChat(accessToken, "primeira")).status).toBe(201);
      // Second send within the same window — clear the cooldown gate + the
      // per-character rate counter (ND-053 keys).
      await redis.del(`cooldown:${characterId}:chat_message`);
      await redis.del(`rate:${characterId}:saideira_chat`);
      expect((await postChat(accessToken, "segunda")).status).toBe(201);

      const res = await fetch(`${base()}/api/saideira/chat/history`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<ChatHistoryResponse>(res);
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].message).toBe("primeira");
      expect(body.messages[1].message).toBe("segunda");
    });

    it("should return 401 without an access token", async () => {
      const res = await fetch(`${base()}/api/saideira/chat/history`);
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });
  });

  // ─── GET /api/saideira/legends ─────────────────────────────────────────────

  describe("GET /api/saideira/legends", () => {
    it("should return the seeded legends (at least 5) with full shape", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/legends`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<LegendsResponse>(res);
      expect(body.legends.length).toBeGreaterThanOrEqual(5);

      const names = body.legends.map((l) => l.characterName);
      expect(names).toContain("Razorback");
      expect(names).toContain("Ghostwire");
      expect(names).toContain("Dama de Paus");
      expect(names).toContain("Zé do Gatilho");
      expect(names).toContain("Mão Fria");

      for (const legend of body.legends) {
        expect(legend.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(legend.drinkName).toBeTypeOf("string");
        expect(new Date(legend.achievedAt).toISOString()).toBe(legend.achievedAt);
        // crew_name is nullable — Mão Fria and Dama de Paus have crews.
        expect(legend.crewName === null || typeof legend.crewName === "string").toBe(true);
      }
    });

    it("should order legends by achievedAt descending (newest first)", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/legends`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<LegendsResponse>(res);

      // Order property: the ENTIRE list is sorted newest-first. Other suites
      // may leave induction artifacts (legends with the current year, 2026) in
      // the shared DB — the sort must still hold over the full list.
      const timestamps = body.legends.map((l) => new Date(l.achievedAt).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i]);
      }

      // Seed legends keep their canonical relative order (migration 0009):
      // Mão Fria (2087) → Zé do Gatilho (2086) → Dama de Paus (2086) →
      // Ghostwire (2085) → Razorback (2085).
      const seedNames = ["Mão Fria", "Zé do Gatilho", "Dama de Paus", "Ghostwire", "Razorback"];
      const seedOrder = body.legends
        .filter((l) => seedNames.includes(l.characterName))
        .map((l) => l.characterName);
      expect(seedOrder).toEqual(seedNames);
    });

    it("should return crew names for legends that have one", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/legends`, {
        headers: authHeader(accessToken),
      });

      const body = await json<LegendsResponse>(res);
      const maoFria = body.legends.find((l) => l.characterName === "Mão Fria");
      const razorback = body.legends.find((l) => l.characterName === "Razorback");
      expect(maoFria?.crewName).toBe("Filhos do Fluxo");
      expect(razorback?.crewName).toBeNull();
    });

    it("should return 401 without an access token", async () => {
      const res = await fetch(`${base()}/api/saideira/legends`);
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });
  });

  // ─── GET /api/saideira/leaderboard/crews ───────────────────────────────────

  describe("GET /api/saideira/leaderboard/crews", () => {
    it("should return an empty crews array when no crews exist", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/leaderboard/crews`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<CrewLeaderboardResponse>(res);
      expect(body.crews).toEqual([]);
    });

    it("should rank crews by total member Moral (ND-016)", async () => {
      const a = await registerApiUser();
      const b = await registerApiUser();
      const c = await registerApiUser();
      const d = await registerApiUser();
      const e = await registerApiUser();
      // Crew 1: 3 members, 60 SC → total 90 (position 1).
      await seedCrew("Filhos do Fluxo", "FLX", [
        { characterId: a.characterId, streetCred: 40 },
        { characterId: b.characterId, streetCred: 30 },
        { characterId: c.characterId, streetCred: 20 },
      ]);
      // Crew 2: 2 members, 100 SC → total 100 (position 1 beats crew 1's 90).
      await seedCrew("Mãos de Ferro", "FER", [
        { characterId: d.characterId, streetCred: 60 },
        { characterId: e.characterId, streetCred: 40 },
      ]);
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/leaderboard/crews`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<CrewLeaderboardResponse>(res);
      expect(body.crews).toHaveLength(2);
      expect(body.crews[0]).toEqual({
        position: 1,
        crewName: "Mãos de Ferro",
        totalSC: 100,
        memberCount: 2,
      });
      expect(body.crews[1]).toEqual({
        position: 2,
        crewName: "Filhos do Fluxo",
        totalSC: 90,
        memberCount: 3,
      });
    });

    it("should cap the crew leaderboard at 5 entries", async () => {
      const { accessToken } = await registerApiUser();
      for (let i = 0; i < 6; i++) {
        const member = await registerApiUser();
        await seedCrew(`Crew ${i}`, `C${i}${i}`, [
          { characterId: member.characterId, streetCred: 10 + i },
        ]);
      }

      const res = await fetch(`${base()}/api/saideira/leaderboard/crews`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<CrewLeaderboardResponse>(res);
      expect(body.crews).toHaveLength(5);
      expect(body.crews.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5]);
    });

    it("should return 401 without an access token", async () => {
      const res = await fetch(`${base()}/api/saideira/leaderboard/crews`);
      expect(res.status).toBe(401);
      expect((await json<ErrorBody>(res)).error).toBe("UNAUTHORIZED");
    });
  });

  // ─── Shared types compile check ────────────────────────────────────────────

  describe("shared Saideira types", () => {
    it("should describe the ChatMessage contract the API returns", () => {
      const msg: ChatMessage = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        characterName: "Razorback",
        crewTag: null,
        message: "&lt;script&gt;",
        createdAt: "2085-03-15T02:47:00.000Z",
      };
      expect(msg.crewTag).toBeNull();
      expect(msg.message).toContain("&lt;");
    });
  });
});
