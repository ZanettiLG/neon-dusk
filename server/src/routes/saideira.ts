import type { FastifyInstance, FastifyRequest } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type {
  SaideiraHubInfo,
  ChatMessage,
  ChatHistoryResponse,
  LegendsResponse,
  CrewLeaderboardResponse,
} from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { checkRateLimit } from "../lib/rate-limit";
import { requireCharacterId } from "../services/economy-service";
import type { AccessTokenPayload } from "../lib/auth";
import { trackActiveUser } from "../telemetry/active-tracker";
import { db } from "../db";
import { characters, legends } from "../db/schema";

// Neon Dusk — Saideira Hub routes (ND-015)
// ============================================================================
// The bar that never closes (Babilônia): hub info, ephemeral real-time chat
// (Redis pub/sub + list, ADR-2), the permanent Legends menu and the crew
// leaderboard placeholder (ADR-4). Chat requires SC >= 10 (gate enforced
// client-side; the endpoints themselves only require a character).

export interface SaideiraRoutesOptions {
  redis: Redis;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const chatSendSchema = z.object({
  // Trim BEFORE min/max: "   " must be rejected as empty, and the 500-char
  // limit applies to the trimmed value (design §9 — validated by tests).
  message: z
    .string()
    .trim()
    .min(1, "Mensagem não pode estar vazia")
    .max(500, "Mensagem muito longa (máx. 500 caracteres)"),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHAT_HISTORY_KEY = "saideira:chat:history";
const CHAT_CHANNEL = "saideira:chat";
const CHAT_HISTORY_MAX = 50;
const CHAT_RATE_LIMIT_MAX = 1; // 1 message...
const CHAT_RATE_LIMIT_WINDOW_MS = 5_000; // ...per 5 seconds
const SSE_KEEPALIVE_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** HTML-escape user input before storing/displaying (XSS mitigation). */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Count active users by scanning `auth:active:*` keys (ND-007 telemetry).
 * Best-effort: returns 0 on any Redis hiccup so hub info never fails.
 */
async function countOnline(redis: Redis): Promise<number> {
  try {
    let count = 0;
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "auth:active:*", "COUNT", 500);
      count += keys.length;
      cursor = nextCursor;
    } while (cursor !== "0");
    return count;
  } catch {
    return 0; // best-effort: hub info stays up when telemetry is down
  }
}

/**
 * Auth for the SSE stream. EventSource cannot set Authorization headers, so
 * this accepts the access token as a `?token=` query param for this route
 * only (ponytail: MVP — switch to an HTTP-only cookie when the auth system
 * supports it). Prefers the Bearer header when present.
 */
async function sseAuthenticate(request: FastifyRequest): Promise<void> {
  const header = request.headers.authorization;
  const queryToken = (request.query as { token?: unknown } | null)?.token;
  const token =
    header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : typeof queryToken === "string" && queryToken.length > 0
        ? queryToken
        : undefined;

  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Missing, invalid or expired access token");
  }

  try {
    request.user = await request.server.jwt.verify<AccessTokenPayload>(token);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Missing, invalid or expired access token");
  }

  // Telemetry (ND-007): mark the user active for 24h. Fire-and-forget — a
  // Redis hiccup must never fail an otherwise valid request.
  void trackActiveUser(request.server.redis, request.user.sub).catch(() => {
    // best-effort telemetry: intentionally silent
  });
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function saideiraRoutes(app: FastifyInstance, opts: SaideiraRoutesOptions) {
  const { redis } = opts;

  // GET /api/saideira — hub info (online count, round placeholders).
  app.get(
    "/saideira",
    { preHandler: [authenticate] },
    async (): Promise<SaideiraHubInfo> => {
      const onlineCount = await countOnline(redis);
      // ponytail: placeholder round data until ND-011 ships
      return {
        onlineCount,
        lastReset: "2026-08-01T00:00:00.000Z",
        currentRound: 1,
      };
    },
  );

  // POST /api/saideira/chat — send a message (1 msg / 5s per character).
  app.post(
    "/saideira/chat",
    { preHandler: [authenticate] },
    async (request, reply): Promise<ChatMessage> => {
      const { message } = chatSendSchema.parse(request.body);

      const characterId = await requireCharacterId(request.user.sub);
      await checkRateLimit(
        redis,
        `saideira:ratelimit:${characterId}`,
        CHAT_RATE_LIMIT_MAX,
        CHAT_RATE_LIMIT_WINDOW_MS,
      );

      // Resolve the character name (direct query — 1 row, no cache needed).
      const [char] = await db
        .select({ name: characters.name })
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      const chatMessage: ChatMessage = {
        id: randomUUID(),
        characterName: char.name,
        crewTag: null, // ponytail: NULL until ND-016 (crews)
        message: escapeHtml(message),
        createdAt: new Date().toISOString(),
      };

      const payload = JSON.stringify(chatMessage);

      // 1. Publish to live SSE subscribers.
      await redis.publish(CHAT_CHANNEL, payload);

      // 2. Push to the ephemeral history list, capped at 50.
      await redis.lpush(CHAT_HISTORY_KEY, payload);
      await redis.ltrim(CHAT_HISTORY_KEY, 0, CHAT_HISTORY_MAX - 1);

      return reply.status(201).send(chatMessage);
    },
  );

  // GET /api/saideira/chat/stream — SSE stream of new messages.
  // Uses reply.raw + reply.hijack() (ADR-1): Fastify serialization is bypassed.
  app.get("/saideira/chat/stream", { preHandler: [sseAuthenticate] }, async (request, reply) => {
    // Validate the character exists — no character means no balcony seat.
    await requireCharacterId(request.user.sub);

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: do not buffer
    });
    reply.raw.write(":ok\n\n"); // SSE handshake — client knows it connected

    // Headers are already sent, so a Redis failure here cannot 500 — fail
    // gracefully with a terminal SSE error event instead of leaving the
    // client on a silent half-open stream.
    let subscriber: Redis | null = null;
    try {
      subscriber = redis.duplicate();
      await subscriber.subscribe(CHAT_CHANNEL);
    } catch (err) {
      if (subscriber) void subscriber.quit();
      request.log.error(err, "saideira: SSE subscriber setup failed");
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ error: "Chat stream unavailable — tente novamente" })}\n\n`,
      );
      reply.raw.end();
      reply.hijack(); // Fastify must not touch the already-finished response
      return;
    }

    subscriber.on("message", (_channel, msg) => {
      reply.raw.write(`data: ${msg}\n\n`);
    });

    // Keep-alive ping every 30s to avoid proxy timeouts.
    const ping = setInterval(() => {
      reply.raw.write(":ping\n\n");
    }, SSE_KEEPALIVE_MS);

    // Cleanup on disconnect: stop pings, release the subscriber connection.
    request.raw.on("close", () => {
      clearInterval(ping);
      void subscriber.unsubscribe(CHAT_CHANNEL);
      void subscriber.quit();
    });

    // Fastify: do not send the automatic response.
    reply.hijack();
  });

  // GET /api/saideira/chat/history — last 50 messages, oldest first.
  app.get(
    "/saideira/chat/history",
    { preHandler: [authenticate] },
    async (): Promise<ChatHistoryResponse> => {
      const raw = await redis.lrange(CHAT_HISTORY_KEY, 0, CHAT_HISTORY_MAX - 1);
      // LRANGE returns newest-first; reverse for chronological order.
      const messages = raw.map((m) => JSON.parse(m) as ChatMessage).reverse();
      return { messages };
    },
  );

  // GET /api/saideira/legends — permanent hall of fame (drink menu).
  app.get(
    "/saideira/legends",
    { preHandler: [authenticate] },
    async (): Promise<LegendsResponse> => {
      const rows = await db.select().from(legends).orderBy(desc(legends.achievedAt));

      return {
        legends: rows.map((r) => ({
          id: r.id,
          characterName: r.characterName,
          drinkName: r.drinkName,
          achievedAt: r.achievedAt.toISOString(),
          crewName: r.crewName,
        })),
      };
    },
  );

  // GET /api/saideira/leaderboard/crews — placeholder until ND-016 (crews).
  app.get(
    "/saideira/leaderboard/crews",
    { preHandler: [authenticate] },
    async (): Promise<CrewLeaderboardResponse> => {
      // ponytail: placeholder until ND-016 ships. Real implementation:
      // GROUP BY crew_name → SUM(street_cred), COUNT(*) ordered desc.
      return { crews: [] };
    },
  );
}
