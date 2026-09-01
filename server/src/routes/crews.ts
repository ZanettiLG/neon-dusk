import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import type {
  ChatHistoryResponse,
  ChatMessage,
  CreateCrewResponse,
  CrewDetailResponse,
  CrewInvite,
} from "@neon-dusk/shared";
import {
  CREW_CREATE_COST,
  CREW_CREATE_SC,
  CREW_MAX_SIZE,
  CREW_RECRUIT_SC,
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
import { withTransaction } from "../db";
import { transferEddies } from "../game/economy";
import { calculateCrewBonuses } from "../game/crews";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { crewRepository as crews } from "../repositories/crew-repository";
import type { CrewRow } from "../repositories/crew-repository";

// Neon Dusk — Crew routes (ND-016: Crews Básicas, ND-053)
// ============================================================================
// Gang social system: found a crew (5.000 de Grana, SC >= 25), invite recruits
// (SC >= 10), join/leave/kick, dissolve, and a members-only real-time chat
// (Redis pub/sub + list, ADR-2 — same shape as the saideira chat, scoped per
// crew). Membership rules are mirrored in the DB (unique character_id, the
// 4-member trigger); the app-level checks are UX, the constraints are law.
//
// ND-053: All POST/DELETE endpoints are guarded by circuit-break, rate-limit,
// and audit logging. Invite also has a 60s cooldown.

export interface CrewRoutesOptions {
  redis: Redis;
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const createCrewSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "Nome deve ter entre 3 e 20 caracteres")
    .max(20, "Nome deve ter entre 3 e 20 caracteres"),
  tag: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{3}$/, "Tag deve ter exatamente 3 letras ou números"),
});

const inviteSchema = z.object({
  characterId: z.string().uuid("characterId deve ser um UUID válido"),
});

const chatSendSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Mensagem não pode estar vazia")
    .max(500, "Mensagem muito longa (máx. 500 caracteres)"),
});

const uuidParam = z.object({
  id: z.string().uuid("ID do bonde deve ser um UUID"),
});

const kickParams = z.object({
  id: z.string().uuid("ID do bonde deve ser um UUID"),
  characterId: z.string().uuid("ID do personagem deve ser um UUID"),
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // invites expire after 24h
const CHAT_HISTORY_MAX = 50;
const SSE_KEEPALIVE_MS = 30_000;

const chatChannel = (crewId: string) => `crew:${crewId}:chat`;
const chatHistoryKey = (crewId: string) => `crew:${crewId}:chat:history`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch a crew or throw AppError(404). */
async function getCrew(crewId: string): Promise<CrewRow> {
  const crew = await crews.findById(crewId);
  if (!crew) throw new AppError(404, "CREW_NOT_FOUND", "Bonde não encontrado");
  return crew;
}

/** Throw AppError(403) unless the character is a crew member. */
async function requireMember(crewId: string, characterId: string): Promise<void> {
  const member = await crews.hasMember(crewId, characterId);
  if (!member) throw new AppError(403, "NOT_CREW_MEMBER", "Você não é membro deste bonde");
}

/** Throw AppError(403) unless the character is the crew leader. */
function requireLeader(crew: { leader_id?: string }, characterId: string): void {
  const leaderId = crew.leader_id;
  if (leaderId !== characterId) {
    throw new AppError(403, "NOT_CREW_LEADER", "Apenas o líder do bonde pode fazer isso");
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function crewRoutes(app: FastifyInstance, opts: CrewRoutesOptions) {
  const { redis } = opts;

  // POST /api/crews — found a crew (5.000 de Grana + SC >= 25).
  app.post(
    "/crews",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_create"),
        checkCircuitBreaker(redis),
        validate(createCrewSchema),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply): Promise<CreateCrewResponse> => {
      const { name, tag } = request.body as z.infer<typeof createCrewSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { name, tag };

      // Eligibility: SC gate + already-affiliated guard (one crew per char).
      const leader = await characters.findById(characterId);
      if (!leader) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");
      if (leader.crew_id) throw new AppError(409, "ALREADY_IN_CREW", "Você já está em um bonde");
      if (leader.street_cred < CREW_CREATE_SC) {
        throw new AppError(
          400,
          "SC_TOO_LOW",
          `Fundar um bonde requer ${CREW_CREATE_SC} de Moral (você tem ${leader.street_cred})`,
        );
      }
      // One transaction: debit wallet (optimistic lock, audit entry), reject
      // duplicate name/tag inside the tx (friendly 409 instead of the DB unique
      // constraint's opaque 500 — the constraints still backstop a concurrent
      // race, and a race loses by committing first).
      const { crew, member } = await withTransaction(async (trx) => {
        const wallet = await wallets.ensure(characterId, trx);
        const availableFunds = wallet.balance - wallet.escrow;
        if (availableFunds < CREW_CREATE_COST) {
          throw new AppError(
            400,
            "INSUFFICIENT_FUNDS",
            `Fundar um bonde custa G$ ${CREW_CREATE_COST} (você tem G$ ${availableFunds})`,
          );
        }
        const dupName = await crews.findByName(name, trx);
        if (dupName) throw new AppError(409, "DUPLICATE_NAME", "Já existe um bonde com este nome");
        const dupTag = await crews.findByTag(tag, trx);
        if (dupTag) throw new AppError(409, "DUPLICATE_TAG", "Já existe um bonde com esta tag");
        const debit = transferEddies(wallet, -CREW_CREATE_COST, {
          type: "CREW_CREATION",
          source: `Fundação do bonde (${name} [${tag}])`,
        });
        const updatedWallet = await wallets.updateOptimistic(
          characterId,
          wallet.version,
          {
            balance: debit.wallet.balance,
            lifetime_spent: debit.wallet.lifetimeSpent,
          },
          trx,
        );
        if (!updatedWallet) {
          throw new AppError(
            409,
            "CONCURRENCY_CONFLICT",
            "Modificação concorrente detectada. Tente novamente.",
          );
        }
        await transactions.insert(
          {
            character_id: characterId,
            type: "CREW_CREATION",
            amount: debit.transaction.amount,
            balance_before: debit.transaction.balanceBefore,
            balance_after: debit.transaction.balanceAfter,
            source: debit.transaction.source,
          },
          trx,
        );

        const crew = await crews.insert({ name, tag, leader_id: characterId }, trx);
        const member = await crews.insertMember(crew.id, characterId, trx);
        await characters.setCrewId(characterId, crew.id, trx);
        return { crew, member };
      });

      return reply.status(201).send({
        crew: {
          id: crew.id,
          name: crew.name,
          tag: crew.tag,
          leaderId: crew.leader_id,
          createdAt: new Date(crew.created_at).toISOString(),
        },
        member: {
          id: member.id,
          characterId,
          characterName: leader.name,
          streetCred: leader.street_cred,
          joinedAt: new Date(member.joined_at).toISOString(),
        },
      });
    },
  );

  // GET /api/crews — list all crews (name, tag, leader, member count).
  app.get(
    "/crews",
    { preHandler: [authenticate] },
    async (): Promise<
      Array<{ id: string; name: string; tag: string; leaderId: string; memberCount: number }>
    > => {
      return crews.listAllWithMemberCount();
    },
  );

  // GET /api/crews/:id — crew details (members, bonuses, ranking).
  app.get(
    "/crews/:id",
    { preHandler: [authenticate] },
    async (request): Promise<CrewDetailResponse> => {
      const crewId = (request.params as { id: string }).id;
      const crew = await getCrew(crewId);

      const memberRows = await crews.listMembers(crewId);

      const bonuses = calculateCrewBonuses(memberRows.length);

      // ponytail: materialize the whole ranking (O(crews)) — MVP scale is a
      // handful of crews; revisit with a window function if it grows.
      const ranked = await crews.listRanking();
      const position = ranked.findIndex((row) => row.id === crewId);
      const leaderboardPosition = position === -1 ? null : position + 1;

      return {
        crew: {
          id: crew.id,
          name: crew.name,
          tag: crew.tag,
          leaderId: crew.leader_id,
          createdAt: new Date(crew.created_at).toISOString(),
        },
        members: memberRows.map((member) => ({
          id: member.id,
          characterId: member.characterId,
          characterName: member.characterName,
          streetCred: member.streetCred,
          joinedAt: new Date(member.joinedAt).toISOString(),
        })),
        bonuses,
        leaderboardPosition,
      };
    },
  );

  // POST /api/crews/:id/invite — leader invites a recruit (SC >= 10).
  app.post(
    "/crews/:id/invite",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_invite"),
        checkCircuitBreaker(redis),
        checkCooldown(redis, "crew_invite"),
        validate(inviteSchema),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply): Promise<CrewInvite> => {
      const crewId = (request.params as { id: string }).id;
      const { characterId: targetId } = request.body as z.infer<typeof inviteSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { crewId, targetCharacterId: targetId };

      const crew = await getCrew(crewId);
      requireLeader(crew, characterId);
      if ((await crews.memberCount(crewId)) >= CREW_MAX_SIZE) {
        throw new AppError(409, "CREW_FULL", `Bonde cheio (máx. ${CREW_MAX_SIZE} membros)`);
      }

      const target = await characters.findById(targetId);
      if (!target) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");
      if (target.crew_id) throw new AppError(409, "ALREADY_IN_CREW", "Este personagem já está em um bonde");
      if (target.street_cred < CREW_RECRUIT_SC) {
        throw new AppError(
          400,
          "SC_TOO_LOW",
          `Recrutas precisam de pelo menos ${CREW_RECRUIT_SC} de Moral`,
        );
      }

      // One pending invite per (crew, character): reject a live duplicate,
      // replace an expired one (the unique constraint would reject the row).
      const existing = await crews.findInvite(crewId, targetId);
      if (existing) {
        if (new Date(existing.expires_at) > new Date()) {
          throw new AppError(409, "ALREADY_INVITED", "Este personagem já foi convidado");
        }
        await crews.deleteInvite(existing.id);
      }

      const invite = await crews.createInvite({
        crew_id: crewId,
        character_id: targetId,
        invited_by: characterId,
        expires_at: new Date(Date.now() + INVITE_TTL_MS),
      });
      if (!invite) throw new AppError(500, "INVITE_FAILED", "Não foi possível criar o convite");

      // Set cooldown AFTER success (ADR-2) — 60s.
      await redis.setex(`cooldown:${characterId}:crew_invite`, 60, "1");

      return reply.status(201).send({
        id: invite.id,
        crewId: invite.crew_id,
        characterId: invite.character_id,
        invitedBy: invite.invited_by,
        createdAt: new Date(invite.created_at).toISOString(),
        expiresAt: new Date(invite.expires_at).toISOString(),
      });
    },
  );

  // POST /api/crews/:id/join — accept an invite.
  app.post(
    "/crews/:id/join",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_join"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply): Promise<CrewDetailResponse["members"][number]> => {
      const { id: crewId } = uuidParam.parse(request.params);
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      request.audit_context!.payload = { crewId };

      const { member, target } = await withTransaction(async (trx) => {
        const invite = await crews.findInvite(crewId, characterId, trx);
        if (!invite) throw new AppError(404, "NO_INVITE", "Você não tem um convite para este bonde");
        if (new Date(invite.expires_at) <= new Date()) {
          throw new AppError(410, "INVITE_EXPIRED", "Convite expirado — peça um novo");
        }
        if ((await crews.memberCount(crewId, trx)) >= CREW_MAX_SIZE) {
          throw new AppError(409, "CREW_FULL", `Bonde cheio (máx. ${CREW_MAX_SIZE} membros)`);
        }
        // Guard against joining a second crew (unique character_id backstops).
        const target = await characters.findById(characterId, trx);
        if (!target) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

        const member = await crews.insertMember(crewId, characterId, trx);
        await crews.deleteInvite(invite.id, trx);
        await characters.setCrewId(characterId, crewId, trx);

        return { member, target };
      });

      // Send AFTER the transaction commits: the client must not see a 201
      // before characters.crew_id is durable (read-after-write visibility).
      return reply.status(201).send({
        id: member.id,
        characterId,
        characterName: target.name,
        streetCred: target.street_cred,
        joinedAt: new Date(member.joined_at).toISOString(),
      });
    },
  );

  // POST /api/crews/:id/leave — quit (leader must dissolve instead).
  app.post(
    "/crews/:id/leave",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_leave"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply) => {
      const { id: crewId } = uuidParam.parse(request.params);
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      const crew = await getCrew(crewId);

      request.audit_context!.payload = { crewId };

      if (crew.leader_id === characterId) {
        throw new AppError(400, "LEADER_CANNOT_LEAVE", "O líder deve dissolver o bonde para sair");
      }
      await requireMember(crewId, characterId);

      await withTransaction(async (trx) => {
        await crews.removeMember(crewId, characterId, trx);
        await characters.setCrewId(characterId, null, trx);
      });

      return reply.status(204).send();
    },
  );

  // DELETE /api/crews/:id/members/:characterId — leader kicks a member.
  app.delete(
    "/crews/:id/members/:characterId",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_kick"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply) => {
      const { id: crewId, characterId: targetId } = kickParams.parse(request.params);
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      const crew = await getCrew(crewId);

      request.audit_context!.payload = { crewId, targetCharacterId: targetId };

      requireLeader(crew, characterId);
      if (targetId === crew.leader_id) {
        throw new AppError(400, "CANNOT_KICK_LEADER", "Não é possível remover o líder");
      }
      await requireMember(crewId, targetId);

      await withTransaction(async (trx) => {
        await crews.removeMember(crewId, targetId, trx);
        await characters.setCrewId(targetId, null, trx);
      });

      return reply.status(204).send();
    },
  );

  // DELETE /api/crews/:id — dissolve the crew (leader only).
  app.delete(
    "/crews/:id",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_dissolve"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply) => {
      const { id: crewId } = uuidParam.parse(request.params);
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      const crew = await getCrew(crewId);

      request.audit_context!.payload = { crewId };

      requireLeader(crew, characterId);

      await withTransaction(async (trx) => {
        await characters.clearCrewForMembers(crewId, trx);
        await crews.deleteInvitesForCrew(crewId, trx);
        await crews.removeAllMembers(crewId, trx);
        await crews.delete(crewId, trx);
      });
      await redis.del(chatHistoryKey(crewId));

      return reply.status(204).send();
    },
  );

  // GET /api/crews/:id/chat/history — last 50 messages, oldest first.
  app.get(
    "/crews/:id/chat/history",
    { preHandler: [authenticate] },
    async (request): Promise<ChatHistoryResponse> => {
      const crewId = (request.params as { id: string }).id;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      await requireMember(crewId, characterId);

      const raw = await redis.lrange(chatHistoryKey(crewId), 0, CHAT_HISTORY_MAX - 1);
      const messages = raw.map((m) => JSON.parse(m) as ChatMessage).reverse();
      return { messages };
    },
  );

  // POST /api/crews/:id/chat — send a message (1 msg / 5s per member via the
  // chat_message cooldown). Uses its own `crew_chat` rate-limit namespace so
  // crew chat does NOT consume the Saideira chat budget (M1).
  app.post(
    "/crews/:id/chat",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_chat"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "crew_chat"),
        checkCooldown(redis, "chat_message"),
        validate(chatSendSchema),
      ],
    },
    async (request, reply): Promise<ChatMessage> => {
      const crewId = (request.params as { id: string }).id;
      const { message } = request.body as z.infer<typeof chatSendSchema>;
      const characterId = (await characters.requireByUserId(request.user.sub)).id;
      const crew = await getCrew(crewId);
      await requireMember(crewId, characterId);

      request.audit_context!.payload = { crewId, messageLength: message.length };

      const char = await characters.findById(characterId);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      const chatMessage: ChatMessage = {
        id: randomUUID(),
        characterName: char.name,
        crewTag: crew.tag,
        message: escapeHtml(message),
        createdAt: new Date().toISOString(),
      };
      const payload = JSON.stringify(chatMessage);

      await redis.publish(chatChannel(crewId), payload);
      await redis.lpush(chatHistoryKey(crewId), payload);
      await redis.ltrim(chatHistoryKey(crewId), 0, CHAT_HISTORY_MAX - 1);

      // Set cooldown AFTER success (ADR-2) — 5s.
      await redis.setex(`cooldown:${characterId}:chat_message`, 5, "1");

      return reply.status(201).send(chatMessage);
    },
  );

  // GET /api/crews/:id/chat/stream — SSE stream (members only).
  // Uses reply.raw + reply.hijack() (ADR-1): Fastify serialization is bypassed.
  app.get("/crews/:id/chat/stream", { preHandler: [sseAuthenticate] }, async (request, reply) => {
    const crewId = (request.params as { id: string }).id;
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    await requireMember(crewId, characterId);

    reply.raw.writeHead(200, {
      // CORS for cross-origin EventSource — see app.ts (sseCorsHeaders).
      ...request.server.sseCorsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // nginx: do not buffer
    });
    reply.raw.write(":ok\n\n"); // SSE handshake — client knows it connected

    let subscriber: Redis | null = null;
    try {
      subscriber = redis.duplicate();
      await subscriber.subscribe(chatChannel(crewId));
    } catch (err) {
      if (subscriber) void subscriber.quit();
      request.log.error(err, "crews: SSE subscriber setup failed");
      reply.raw.write(
        `event: error\ndata: ${JSON.stringify({ error: "Chat stream unavailable — tente novamente" })}\n\n`,
      );
      reply.raw.end();
      reply.hijack();
      return;
    }

    subscriber.on("message", (_channel, msg) => {
      reply.raw.write(`data: ${msg}\n\n`);
    });

    const ping = setInterval(() => {
      reply.raw.write(":ping\n\n");
    }, SSE_KEEPALIVE_MS);

    request.raw.on("close", () => {
      clearInterval(ping);
      void subscriber.unsubscribe(chatChannel(crewId));
      void subscriber.quit();
    });

    reply.hijack();
  });
}
