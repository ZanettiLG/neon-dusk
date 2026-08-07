import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type {
  SaideiraHubInfo,
  ChatMessage,
  ChatHistoryResponse,
  LegendsResponse,
  CrewLeaderboardResponse,
  NameDrinkResponse,
} from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { checkRateLimit } from "../lib/rate-limit";
import { escapeHtml } from "../lib/escape-html";
import { sseAuthenticate } from "../lib/sse-auth";
import { requireCharacterId } from "../services/economy-service";
import { db } from "../db";
import { characters, crewMembers, crews, legends, rounds } from "../db/schema";
import { env } from "../env";
import { UNNAMED_DRINK } from "../game/round-reset";

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

// ND-017: name a Legend's drink (3-30 chars after trim).
const nameDrinkSchema = z.object({
  drinkName: z
    .string()
    .trim()
    .min(3, "Nome da bebida muito curto")
    .max(30, "Nome da bebida muito longo"),
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
const DAY_MS = 86_400_000; // ROUND_DURATION_DAYS is expressed in days

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function saideiraRoutes(app: FastifyInstance, opts: SaideiraRoutesOptions) {
  const { redis } = opts;

  // GET /api/saideira — hub info (online count + real round data, ND-017).
  app.get("/saideira", { preHandler: [authenticate] }, async (): Promise<SaideiraHubInfo> => {
    const onlineCount = await countOnline(redis);

    // Round data comes from the rounds table (ND-017): the active round's
    // number + end time, and the last reset timestamp (most recent ended).
    const durationMs = env.ROUND_DURATION_DAYS * DAY_MS;
    const [active] = await db.select().from(rounds).where(eq(rounds.status, "active")).limit(1);
    const [lastEnded] = await db
      .select({ endedAt: rounds.endedAt })
      .from(rounds)
      .where(isNotNull(rounds.endedAt))
      .orderBy(desc(rounds.roundNumber))
      .limit(1);

    return {
      onlineCount,
      lastReset: lastEnded?.endedAt ? lastEnded.endedAt.toISOString() : null,
      currentRound: active?.roundNumber ?? 1,
      roundEndsAt: active
        ? new Date(active.startedAt.getTime() + durationMs).toISOString()
        : new Date(Date.now() + durationMs).toISOString(),
    };
  });

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

      // Resolve the character name + crew tag (direct query — 1 row).
      const [char] = await db
        .select({ name: characters.name, crewId: characters.crewId })
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      // ND-016: attach the crew tag when the character belongs to a crew.
      let crewTag: string | null = null;
      if (char.crewId) {
        const [crew] = await db
          .select({ tag: crews.tag })
          .from(crews)
          .where(eq(crews.id, char.crewId))
          .limit(1);
        crewTag = crew?.tag ?? null;
      }

      const chatMessage: ChatMessage = {
        id: randomUUID(),
        characterName: char.name,
        crewTag,
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

  // POST /api/legends/name-drink — name the drink of a Legend inducted this
  // round (ND-017). Matches the caller's character name against the
  // `__UNNAMED__` placeholder row; character names are unique per lower() so
  // at most one unnamed row can match (ADR-5 — no schema change).
  app.post(
    "/legends/name-drink",
    { preHandler: [authenticate] },
    async (request, reply): Promise<NameDrinkResponse> => {
      const { drinkName } = nameDrinkSchema.parse(request.body);
      const characterId = await requireCharacterId(request.user.sub);

      const [char] = await db
        .select({ name: characters.name })
        .from(characters)
        .where(eq(characters.id, characterId))
        .limit(1);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      const [legend] = await db
        .update(legends)
        .set({ drinkName })
        .where(and(eq(legends.characterName, char.name), eq(legends.drinkName, UNNAMED_DRINK)))
        .returning();
      if (!legend) {
        throw new AppError(
          404,
          "LEGEND_NOT_FOUND",
          "Nenhuma bebida sem nome encontrada para este personagem",
        );
      }

      return reply.status(200).send({
        legend: {
          id: legend.id,
          characterName: legend.characterName,
          drinkName: legend.drinkName,
          achievedAt: legend.achievedAt.toISOString(),
          crewName: legend.crewName,
        },
      });
    },
  );

  // GET /api/saideira/leaderboard/crews — top 5 crews by total member SC.
  app.get(
    "/saideira/leaderboard/crews",
    { preHandler: [authenticate] },
    async (): Promise<CrewLeaderboardResponse> => {
      const totalSC = sql<number>`COALESCE(SUM(${characters.streetCred}), 0)::int`;
      const rows = await db
        .select({
          name: crews.name,
          totalSC,
          memberCount: sql<number>`COUNT(${crewMembers.characterId})::int`,
        })
        .from(crews)
        .leftJoin(crewMembers, eq(crewMembers.crewId, crews.id))
        .leftJoin(characters, eq(characters.id, crewMembers.characterId))
        .groupBy(crews.id)
        .orderBy(desc(totalSC))
        .limit(5);

      return {
        crews: rows.map((row, index) => ({
          position: index + 1,
          crewName: row.name,
          totalSC: row.totalSC,
          memberCount: row.memberCount,
        })),
      };
    },
  );
}
