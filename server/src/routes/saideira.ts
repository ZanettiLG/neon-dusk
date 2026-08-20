import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
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
import { checkCircuitBreaker } from "../middleware/circuit-breaker";
import { checkCooldown } from "../middleware/cooldown";
import { validate } from "../middleware/validate";
import { setAuditContext } from "../middleware/audit-middleware";
import { checkActionRateLimit } from "../lib/rate-limit";
import { AppError } from "../middleware/error-handler";
import { escapeHtml } from "../lib/escape-html";
import { sseAuthenticate } from "../lib/sse-auth";
import { env } from "../env";
import { characterRepository as characters } from "../repositories/character-repository";
import { crewRepository as crews } from "../repositories/crew-repository";
import { legendRepository as legends } from "../repositories/legend-repository";
import { roundRepository as rounds } from "../repositories/round-repository";

// Neon Dusk — Saideira Hub routes (ND-015, ND-053)
// ============================================================================
// The bar that never closes (Babilônia): hub info, ephemeral real-time chat
// (Redis pub/sub + list, ADR-2), the permanent Legends menu and the crew
// leaderboard placeholder (ADR-4). Chat requires SC >= 10 (gate enforced
// client-side; the endpoints themselves only require a character).
//
// ND-053: Chat POST is guarded by circuit-break, 5s cooldown, validation,
// and per-action rate limiting. Name-drink is guarded by circuit-break and
// validation.

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

// ND-017: name a Lenda's drink (3-30 chars after trim).
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
    const active = await rounds.findActive();
    const lastEnded = await rounds.findLastEnded();

    return {
      onlineCount,
      lastReset: lastEnded?.endedAt ? new Date(lastEnded.endedAt).toISOString() : null,
      currentRound: active?.round_number ?? 1,
      roundEndsAt: active
        ? new Date(new Date(active.started_at).getTime() + durationMs).toISOString()
        : new Date(Date.now() + durationMs).toISOString(),
    };
  });

  // POST /api/saideira/chat — send a message (12/minute per character, 5s cooldown).
  app.post(
    "/saideira/chat",
    {
      preHandler: [
        authenticate,
        setAuditContext("saideira_chat"),
        checkCircuitBreaker(redis),
        checkCooldown(redis, "chat_message"),
        validate(chatSendSchema),
        checkActionRateLimit(redis, "saideira_chat"),
      ],
    },
    async (request, reply): Promise<ChatMessage> => {
      const { message } = request.body as z.infer<typeof chatSendSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { messageLength: message.length };

      // Resolve the character name + crew tag (direct query — 1 row).
      const char = await characters.findById(characterId);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      // ND-016: attach the crew tag when the character belongs to a crew.
      let crewTag: string | null = null;
      if (char.crew_id) {
        const crew = await crews.findTagById(char.crew_id);
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

      // Set cooldown AFTER success (ADR-2) — 5s.
      await redis.setex(`cooldown:${characterId}:chat_message`, 5, "1");

      return reply.status(201).send(chatMessage);
    },
  );

  // GET /api/saideira/chat/stream — SSE stream of new messages.
  // Uses reply.raw + reply.hijack() (ADR-1): Fastify serialization is bypassed.
  app.get("/saideira/chat/stream", { preHandler: [sseAuthenticate] }, async (request, reply) => {
    // Validate the character exists — no character means no balcony seat.
    await characters.requireByUserId(request.user.sub);

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
      const rows = await legends.listTop();

      return {
        legends: rows.map((r) => ({
          id: r.id,
          characterName: r.character_name,
          drinkName: r.drink_name,
          achievedAt: new Date(r.achieved_at).toISOString(),
          crewName: r.crew_name ?? null,
        })),
      };
    },
  );

  // POST /api/legends/name-drink — name the drink of a Lenda inducted this
  // round (ND-017). Matches the caller's character name against the
  // `__UNNAMED__` placeholder row; character names are unique per lower() so
  // at most one unnamed row can match (ADR-5 — no schema change).
  app.post(
    "/legends/name-drink",
    {
      preHandler: [
        authenticate,
        setAuditContext("name_drink"),
        checkCircuitBreaker(redis),
        validate(nameDrinkSchema),
      ],
    },
    async (request, reply): Promise<NameDrinkResponse> => {
      const { drinkName } = request.body as z.infer<typeof nameDrinkSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { drinkName };

      const char = await characters.findById(characterId);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      const legendRow = await legends.updateDrinkName(char.name, drinkName);
      if (!legendRow) {
        throw new AppError(
          404,
          "LEGEND_NOT_FOUND",
          "Nenhuma bebida sem nome encontrada para este personagem",
        );
      }

      return reply.status(200).send({
        legend: {
          id: legendRow.id,
          characterName: legendRow.character_name,
          drinkName: legendRow.drink_name,
          achievedAt: new Date(legendRow.achieved_at).toISOString(),
          crewName: legendRow.crew_name,
        },
      });
    },
  );

  // GET /api/saideira/leaderboard/crews — top 5 crews by total member SC.
  app.get(
    "/saideira/leaderboard/crews",
    { preHandler: [authenticate] },
    async (): Promise<CrewLeaderboardResponse> => {
      const rows = await crews.listLeaderboard(5);

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
