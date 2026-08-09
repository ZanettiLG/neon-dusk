import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type {
  AwardSCResponse,
  LeaderboardResponse,
  StreetCredInfo,
} from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { db } from "../db";
import { requireCharacterId } from "../services/economy-service";
import { calculateDecay, getNextThreshold, getTitle } from "../game/street-cred";
import { invalidateLeaderboardCache, LEADERBOARD_CACHE_KEY } from "../lib/leaderboard-cache";

// Neon Dusk — Street Cred routes (ND-011.2)
// ============================================================================
// GET /api/street-cred applies decay lazily on read (grace 7d, -5 SC/day,
// floor = max threshold achieved) and writes the decayed score back. The
// leaderboard is public and cached in Redis (5 min TTL, invalidated on every
// SC change — see #74). POST /award is the internal/system faucet (events,
// admin) — clamped at the 100 cap and audited in transaction_log with type
// STREET_CRED_AWARD.

export interface StreetCredRoutesOptions {
  redis: Redis;
}

const leaderboardQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const awardSchema = z.object({
  amount: z.number().positive().max(100),
  source: z.string().min(1).max(200),
});

/** TTL for the public leaderboard snapshot (kept long for passive readers). */
const LEADERBOARD_CACHE_TTL_S = 300;

export async function streetCredRoutes(app: FastifyInstance, opts: StreetCredRoutesOptions) {
  const { redis } = opts;

  // GET /api/street-cred — live readout, decay applied (and written back)
  app.get("/street-cred", { preHandler: [authenticate] }, async (request): Promise<StreetCredInfo> => {
    const characterId = await requireCharacterId(request.user.sub);
    const [row] = await db("characters").select().where("id", characterId).limit(1);
    if (!row) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

    const now = new Date();
    const { effectiveScore } = calculateDecay(
      new Date(row.last_activity_at),
      row.street_cred,
      row.max_street_cred_achieved,
      now,
    );

    // Persist the decayed score once it actually moved (writeback on read).
    if (effectiveScore < row.street_cred) {
      await db("characters")
        .update({ street_cred: effectiveScore, updated_at: now })
        .where("id", characterId);
    }

    const next = getNextThreshold(effectiveScore);
    return {
      score: effectiveScore,
      title: getTitle(effectiveScore),
      maxAchieved: row.max_street_cred_achieved,
      nextThreshold: next,
      scToNext: next ? next.score - effectiveScore : null,
    };
  });

  // GET /api/street-cred/leaderboard — public, cached 5 min in Redis.
  // The global @fastify/rate-limit (per IP) guards this route.
  app.get("/street-cred/leaderboard", async (request): Promise<LeaderboardResponse> => {
    const { limit } = leaderboardQuery.parse(request.query);

    const cached = await redis.get(LEADERBOARD_CACHE_KEY);
    if (cached) {
      const entries = JSON.parse(cached) as LeaderboardResponse["leaderboard"];
      return { leaderboard: entries.slice(0, limit) };
    }

    // Always materialize the full 50 (the max allowed) so the cached snapshot
    // serves any requested limit, and fetch the decay inputs so each row's
    // effective score matches GET /api/street-cred.
    const rows = await db("characters")
      .select({
        name: "characters.name",
        streetCred: "characters.street_cred",
        maxStreetCredAchieved: "characters.max_street_cred_achieved",
        lastActivityAt: "characters.last_activity_at",
        crewName: "crews.name",
      })
      .leftJoin("crews", "crews.id", "characters.crew_id")
      .orderBy("characters.street_cred", "desc")
      .limit(50);

    const leaderboard = rows
      .map((row) => ({
        name: row.name,
        crewName: row.crewName,
        score: calculateDecay(new Date(row.lastActivityAt), row.streetCred, row.maxStreetCredAchieved).effectiveScore,
      }))
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({
        position: index + 1,
        characterName: row.name,
        // ND-016: crew affiliation, null for solo runners.
        crewName: row.crewName ?? null,
        score: row.score,
        title: getTitle(row.score),
      }));

    await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(leaderboard), "EX", LEADERBOARD_CACHE_TTL_S);
    return { leaderboard: leaderboard.slice(0, limit) };
  });

  // POST /api/street-cred/award — authenticated faucet, clamped at the cap.
  app.post(
    "/street-cred/award",
    { preHandler: [authenticate] },
    async (request): Promise<AwardSCResponse> => {
      const body = awardSchema.parse(request.body);
      const characterId = await requireCharacterId(request.user.sub);

      return db.transaction(async (trx) => {
        const [row] = await trx("characters")
          .select()
          .where("id", characterId)
          .limit(1);
        if (!row) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

        // Clamp to [1, 100 - current]; already at the cap → 0 (no-op award).
        const room = 100 - row.street_cred;
        const gained = Math.max(0, Math.min(body.amount, room));
        const newScore = row.street_cred + gained;

        if (gained > 0) {
          const [updated] = await trx("characters")
            .update({
              street_cred: newScore,
              max_street_cred_achieved: db.raw("GREATEST(max_street_cred_achieved, ?)", [newScore]),
              last_activity_at: db.fn.now(),
              updated_at: db.fn.now(),
            })
            .where("id", characterId)
            .returning(["street_cred as streetCred", "max_street_cred_achieved as maxStreetCredAchieved"]);

          if (!updated) throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");

          // Audit trail. transaction_log's CHECK requires
          // balance_after - balance_before = amount — the SC delta satisfies it.
          await trx("transaction_log").insert({
            character_id: characterId,
            type: "STREET_CRED_AWARD",
            amount: gained,
            balance_before: row.street_cred,
            balance_after: newScore,
            source: body.source,
          });

          // #74: drop the cached leaderboard so the next read shows the fresh
          // ranking. Best-effort, fires outside the DB transaction.
          await invalidateLeaderboardCache(redis);

          return {
            score: newScore,
            title: getTitle(newScore),
            gained,
            maxAchieved: updated.maxStreetCredAchieved,
          };
        }

        return { score: row.street_cred, title: getTitle(row.street_cred), gained: 0, maxAchieved: row.max_street_cred_achieved };
      });
    },
  );
}
