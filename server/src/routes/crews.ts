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
import { db, type Queryable } from "../db";
import { transferEddies } from "../game/economy";
import { calculateCrewBonuses } from "../game/crews";
import { ensureWallet, requireCharacterId } from "../services/economy-service";

// Neon Dusk — Crew routes (ND-016: Crews Básicas, ND-053)
// ============================================================================
// Gang social system: found a crew (5,000 eddies, SC >= 25), invite recruits
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
async function getCrew(crewId: string): Promise<Record<string, unknown>> {
  const [crew] = await db("crews").select().where("id", crewId).limit(1);
  if (!crew) throw new AppError(404, "CREW_NOT_FOUND", "Crew não encontrada");
  return crew;
}

/** Count current members (the DB trigger enforces the hard cap). */
async function memberCount(tx: Queryable, crewId: string): Promise<number> {
  const [row] = await tx("crew_members")
    .count("* as count")
    .where("crew_id", crewId);
  return Number(row?.count ?? 0);
}

/** Throw AppError(403) unless the character is a crew member. */
async function requireMember(crewId: string, characterId: string): Promise<void> {
  const [member] = await db("crew_members")
    .select("id")
    .where("crew_id", crewId)
    .where("character_id", characterId)
    .limit(1);
  if (!member) throw new AppError(403, "NOT_CREW_MEMBER", "Você não é membro desta crew");
}

/** Throw AppError(403) unless the character is the crew leader. */
function requireLeader(crew: { leaderId?: string; leader_id?: string }, characterId: string): void {
  const leaderId = crew.leaderId ?? crew.leader_id;
  if (leaderId !== characterId) {
    throw new AppError(403, "NOT_CREW_LEADER", "Apenas o líder da crew pode fazer isso");
  }
}

/** Nullify `crew_id` on a character (leave / kick / dissolve). */
async function clearMembership(tx: Queryable, characterId: string): Promise<void> {
  await tx("characters")
    .update({ crew_id: null, updated_at: new Date() })
    .where("id", characterId);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function crewRoutes(app: FastifyInstance, opts: CrewRoutesOptions) {
  const { redis } = opts;

  // POST /api/crews — found a crew (5,000 eddies + SC >= 25).
  app.post(
    "/crews",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_invite"),
        checkCircuitBreaker(redis),
        validate(createCrewSchema),
        checkActionRateLimit(redis, "crew_invite"),
      ],
    },
    async (request, reply): Promise<CreateCrewResponse> => {
      const { name, tag } = request.body as z.infer<typeof createCrewSchema>;
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { name, tag };

      // Eligibility: SC gate + already-affiliated guard (one crew per char).
      const [leader] = await db("characters")
        .select("name", "street_cred as streetCred", "crew_id as crewId")
        .where("id", characterId)
        .limit(1);
      if (!leader) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");
      if (leader.crewId) throw new AppError(409, "ALREADY_IN_CREW", "Você já está em uma crew");
      if (leader.streetCred < CREW_CREATE_SC) {
        throw new AppError(
          400,
          "SC_TOO_LOW",
          `Fundar uma crew requer ${CREW_CREATE_SC} de Street Cred (você tem ${leader.streetCred})`,
        );
      }
      // One transaction: debit wallet (optimistic lock, audit entry), reject
      // duplicate name/tag inside the tx (friendly 409 instead of the DB unique
      // constraint's opaque 500 — the constraints still backstop a concurrent
      // race, and a race loses by committing first).
      const { crew, member } = await db.transaction(async (trx) => {
        const wallet = await ensureWallet(characterId, trx as unknown as Queryable);
        const availableFunds = wallet.balance - wallet.escrow;
        if (availableFunds < CREW_CREATE_COST) {
          throw new AppError(
            400,
            "INSUFFICIENT_FUNDS",
            `Fundar uma crew custa ${CREW_CREATE_COST} eddies (você tem ${availableFunds})`,
          );
        }
        const [dupName] = await trx("crews")
          .select("id")
          .where("name", name)
          .limit(1);
        if (dupName) throw new AppError(409, "DUPLICATE_NAME", "Já existe uma crew com este nome");
        const [dupTag] = await trx("crews")
          .select("id")
          .where("tag", tag)
          .limit(1);
        if (dupTag) throw new AppError(409, "DUPLICATE_TAG", "Já existe uma crew com esta tag");
        const debit = transferEddies(wallet, -CREW_CREATE_COST, {
          type: "CREW_CREATION",
          source: `Crew creation (${name} [${tag}])`,
        });
        const [updatedWallet] = await trx("character_wallets")
          .update({
            balance: debit.wallet.balance,
            lifetime_spent: debit.wallet.lifetimeSpent,
            version: wallet.version + 1,
            updated_at: new Date(),
          })
          .where("character_id", characterId)
          .where("version", wallet.version)
          .returning("*");
        if (!updatedWallet) {
          throw new AppError(
            409,
            "CONCURRENCY_CONFLICT",
            "Modificação concorrente detectada. Tente novamente.",
          );
        }
        await trx("transaction_log").insert({
          character_id: characterId,
          type: "CREW_CREATION",
          amount: debit.transaction.amount,
          balance_before: debit.transaction.balanceBefore,
          balance_after: debit.transaction.balanceAfter,
          source: debit.transaction.source,
        });

        const [crew] = await trx("crews")
          .insert({ name, tag, leader_id: characterId })
          .returning("*");
        const [member] = await trx("crew_members")
          .insert({ crew_id: crew.id, character_id: characterId })
          .returning("*");
        await trx("characters")
          .update({ crew_id: crew.id, updated_at: new Date() })
          .where("id", characterId);
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
          streetCred: leader.streetCred,
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
      const rows = await db("crews")
        .select({
          id: "crews.id",
          name: "crews.name",
          tag: "crews.tag",
          leaderId: "crews.leader_id",
          memberCount: db.raw(
            "(SELECT count(*)::int FROM crew_members WHERE crew_members.crew_id = crews.id)",
          ),
        })
        .orderBy("crews.created_at");

      return rows.map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: r.name as string,
        tag: r.tag as string,
        leaderId: r.leaderId as string,
        memberCount: Number(r.memberCount ?? 0),
      }));
    },
  );

  // GET /api/crews/:id — crew details (members, bonuses, ranking).
  app.get(
    "/crews/:id",
    { preHandler: [authenticate] },
    async (request): Promise<CrewDetailResponse> => {
      const crewId = (request.params as { id: string }).id;
      const crew = await getCrew(crewId);

      const memberRows = await db("crew_members")
        .select({
          id: "crew_members.id",
          characterId: "crew_members.character_id",
          characterName: "characters.name",
          streetCred: "characters.street_cred",
          joinedAt: "crew_members.joined_at",
        })
        .join("characters", "characters.id", "crew_members.character_id")
        .where("crew_members.crew_id", crewId)
        .orderBy("crew_members.joined_at");

      const bonuses = calculateCrewBonuses(memberRows.length);

      // ponytail: materialize the whole ranking (O(crews)) — MVP scale is a
      // handful of crews; revisit with a window function if it grows.
      const ranked = await db("crews")
        .select({
          id: "crews.id",
          totalSC: db.raw("COALESCE(SUM(characters.street_cred), 0)::int"),
        })
        .leftJoin("crew_members", "crew_members.crew_id", "crews.id")
        .leftJoin("characters", "characters.id", "crew_members.character_id")
        .groupBy("crews.id")
        .orderByRaw("COALESCE(SUM(characters.street_cred), 0) DESC");
      const position = ranked.findIndex((row: Record<string, unknown>) => row.id === crewId);
      const leaderboardPosition = position === -1 ? null : position + 1;

      return {
        crew: {
          id: crew.id as string,
          name: crew.name as string,
          tag: crew.tag as string,
          leaderId: (crew.leader_id ?? crew.leaderId) as string,
          createdAt: new Date(crew.created_at as string).toISOString(),
        },
        members: memberRows.map((member: Record<string, unknown>) => ({
          id: member.id as string,
          characterId: member.characterId as string,
          characterName: member.characterName as string,
          streetCred: member.streetCred as number,
          joinedAt: new Date(member.joinedAt as string).toISOString(),
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
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { crewId, targetCharacterId: targetId };

      const crew = await getCrew(crewId);
      requireLeader(crew, characterId);
      if ((await memberCount(db, crewId)) >= CREW_MAX_SIZE) {
        throw new AppError(409, "CREW_FULL", `Crew cheia (máx. ${CREW_MAX_SIZE} membros)`);
      }

      const [target] = await db("characters")
        .select("id", "street_cred as streetCred", "crew_id as crewId")
        .where("id", targetId)
        .limit(1);
      if (!target) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");
      if (target.crewId) throw new AppError(409, "ALREADY_IN_CREW", "Este personagem já está em uma crew");
      if (target.streetCred < CREW_RECRUIT_SC) {
        throw new AppError(
          400,
          "SC_TOO_LOW",
          `Recrutas precisam de pelo menos ${CREW_RECRUIT_SC} de Street Cred`,
        );
      }

      // One pending invite per (crew, character): reject a live duplicate,
      // replace an expired one (the unique constraint would reject the row).
      const [existing] = await db("crew_invites")
        .select("id", "expires_at as expiresAt")
        .where("crew_id", crewId)
        .where("character_id", targetId)
        .limit(1);
      if (existing) {
        if (new Date(existing.expiresAt) > new Date()) {
          throw new AppError(409, "ALREADY_INVITED", "Este personagem já foi convidado");
        }
        await db("crew_invites").delete().where("id", existing.id);
      }

      const [invite] = await db("crew_invites")
        .insert({
          crew_id: crewId,
          character_id: targetId,
          invited_by: characterId,
          expires_at: new Date(Date.now() + INVITE_TTL_MS),
        })
        .returning("*");
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
      const crewId = (request.params as { id: string }).id;
      const characterId = await requireCharacterId(request.user.sub);

      request.audit_context!.payload = { crewId };

      const { member, target } = await db.transaction(async (trx) => {
        const [invite] = await trx("crew_invites")
          .select()
          .where("crew_id", crewId)
          .where("character_id", characterId)
          .limit(1);
        if (!invite) throw new AppError(404, "NO_INVITE", "Você não tem um convite para esta crew");
        if (new Date(invite.expires_at) <= new Date()) {
          throw new AppError(410, "INVITE_EXPIRED", "Convite expirado — peça um novo");
        }
        if ((await memberCount(trx, crewId)) >= CREW_MAX_SIZE) {
          throw new AppError(409, "CREW_FULL", `Crew cheia (máx. ${CREW_MAX_SIZE} membros)`);
        }
        // Guard against joining a second crew (unique character_id backstops).
        const [target] = await trx("characters")
          .select("id", "name", "street_cred as streetCred")
          .where("id", characterId)
          .limit(1);
        if (!target) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

        const [member] = await trx("crew_members")
          .insert({ crew_id: crewId, character_id: characterId })
          .returning("*");
        await trx("crew_invites").delete().where("id", invite.id);
        await trx("characters")
          .update({ crew_id: crewId, updated_at: new Date() })
          .where("id", characterId);

        return { member, target };
      });

      // Send AFTER the transaction commits: the client must not see a 201
      // before characters.crew_id is durable (read-after-write visibility).
      return reply.status(201).send({
        id: member.id,
        characterId,
        characterName: target.name,
        streetCred: target.streetCred,
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
      const crewId = (request.params as { id: string }).id;
      const characterId = await requireCharacterId(request.user.sub);
      const crew = await getCrew(crewId);

      request.audit_context!.payload = { crewId };

      if ((crew.leader_id ?? crew.leaderId) === characterId) {
        throw new AppError(400, "LEADER_CANNOT_LEAVE", "O líder deve dissolver a crew para sair");
      }
      await requireMember(crewId, characterId);

      await db.transaction(async (trx) => {
        await trx("crew_members")
          .delete()
          .where("crew_id", crewId)
          .where("character_id", characterId);
        await clearMembership(trx, characterId);
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
      const { id: crewId, characterId: targetId } = request.params as {
        id: string;
        characterId: string;
      };
      const characterId = await requireCharacterId(request.user.sub);
      const crew = await getCrew(crewId);

      request.audit_context!.payload = { crewId, targetCharacterId: targetId };

      requireLeader(crew, characterId);
      if (targetId === (crew.leader_id ?? crew.leaderId)) {
        throw new AppError(400, "CANNOT_KICK_LEADER", "Não é possível remover o líder");
      }
      await requireMember(crewId, targetId);

      await db.transaction(async (trx) => {
        await trx("crew_members")
          .delete()
          .where("crew_id", crewId)
          .where("character_id", targetId);
        await clearMembership(trx, targetId);
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
      const crewId = (request.params as { id: string }).id;
      const characterId = await requireCharacterId(request.user.sub);
      const crew = await getCrew(crewId);

      request.audit_context!.payload = { crewId };

      requireLeader(crew, characterId);

      await db.transaction(async (trx) => {
        await trx("characters")
          .update({ crew_id: null, updated_at: new Date() })
          .where("crew_id", crewId);
        await trx("crew_invites").delete().where("crew_id", crewId);
        await trx("crew_members").delete().where("crew_id", crewId);
        await trx("crews").delete().where("id", crewId);
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
      const characterId = await requireCharacterId(request.user.sub);
      await requireMember(crewId, characterId);

      const raw = await redis.lrange(chatHistoryKey(crewId), 0, CHAT_HISTORY_MAX - 1);
      const messages = raw.map((m) => JSON.parse(m) as ChatMessage).reverse();
      return { messages };
    },
  );

  // POST /api/crews/:id/chat — send a message (1 msg / 5s per member via the
  // chat_message cooldown, same gate as the saideira chat — ND-053).
  app.post(
    "/crews/:id/chat",
    {
      preHandler: [
        authenticate,
        setAuditContext("crew_chat"),
        checkCircuitBreaker(redis),
        checkActionRateLimit(redis, "saideira_chat"),
        checkCooldown(redis, "chat_message"),
        validate(chatSendSchema),
      ],
    },
    async (request, reply): Promise<ChatMessage> => {
      const crewId = (request.params as { id: string }).id;
      const { message } = request.body as z.infer<typeof chatSendSchema>;
      const characterId = await requireCharacterId(request.user.sub);
      const crew = await getCrew(crewId);
      await requireMember(crewId, characterId);

      request.audit_context!.payload = { crewId, messageLength: message.length };

      const [char] = await db("characters")
        .select("name")
        .where("id", characterId)
        .limit(1);
      if (!char) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      const chatMessage: ChatMessage = {
        id: randomUUID(),
        characterName: char.name,
        crewTag: (crew.tag ?? crew.tag) as string,
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
    const characterId = await requireCharacterId(request.user.sub);
    await requireMember(crewId, characterId);

    reply.raw.writeHead(200, {
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
