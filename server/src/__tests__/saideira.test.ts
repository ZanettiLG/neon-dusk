import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import { buildApp } from "../app";
import { envSchema } from "../env";
import { startTestServer, json, authHeader, resetDb, type TestServer } from "./helpers";
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
const CHAT_RATE_KEY_PREFIX = "auth:rl:saideira:ratelimit:";

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

    app = await buildApp({ env: envSchema.parse({ ...process.env, REDIS_URL: REDIS_TEST_DB }) });
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
        role: "solo",
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

  // ─── GET /api/saideira ─────────────────────────────────────────────────────

  describe("GET /api/saideira", () => {
    it("should return hub info with onlineCount, lastReset and currentRound", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira`, { headers: authHeader(accessToken) });

      expect(res.status).toBe(200);
      const body = await json<SaideiraHubInfo>(res);
      expect(body.onlineCount).toBeTypeOf("number");
      expect(body.lastReset).toBe("2026-08-01T00:00:00.000Z");
      expect(body.currentRound).toBe(1);
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

    it("should rate-limit the second message within 5s with 429 RATE_LIMITED", async () => {
      const { accessToken } = await registerApiUser();

      const first = await postChat(accessToken, "primeira");
      expect(first.status).toBe(201);

      const second = await postChat(accessToken, "segunda");
      expect(second.status).toBe(429);
      expect((second.body as ErrorBody).error).toBe("RATE_LIMITED");
    });

    it("should allow a message after the rate-limit window expires", async () => {
      const { accessToken, characterId } = await registerApiUser();

      const first = await postChat(accessToken, "primeira");
      expect(first.status).toBe(201);
      // Simulate the 5s window passing (test seam — real clock would be slow).
      await redis.del(`${CHAT_RATE_KEY_PREFIX}${characterId}`);

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
      // Second send within the same window — clear the per-character counter.
      await redis.del(`${CHAT_RATE_KEY_PREFIX}${characterId}`);
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
      const years = body.legends.map((l) => new Date(l.achievedAt).getUTCFullYear());
      expect(years[0]).toBe(2087); // Mão Fria — newest
      expect(years[years.length - 1]).toBe(2085); // Razorback/Ghostwire — oldest
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
    it("should return an empty crews array (placeholder until ND-016)", async () => {
      const { accessToken } = await registerApiUser();

      const res = await fetch(`${base()}/api/saideira/leaderboard/crews`, {
        headers: authHeader(accessToken),
      });

      expect(res.status).toBe(200);
      const body = await json<CrewLeaderboardResponse>(res);
      expect(body.crews).toEqual([]);
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
