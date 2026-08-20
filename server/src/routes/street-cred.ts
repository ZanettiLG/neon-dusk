import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { z } from "zod";
import type { LeaderboardResponse, StreetCredInfo } from "@neon-dusk/shared";
import { authenticate } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import { calculateDecay, getNextThreshold, getTitle } from "../game/street-cred";
import { LEADERBOARD_CACHE_KEY } from "../lib/leaderboard-cache";
import { characterRepository as characters } from "../repositories/character-repository";

// Neon Dusk — Moral routes (ND-011.2)
// ============================================================================
// GET /api/street-cred applies decay lazily on read (grace 7d, -5 SC/day,
// floor = max threshold achieved) and writes the decayed score back. The
// leaderboard is public and cached in Redis (5 min TTL, invalidated on every
// SC change — see #74). Moral awards happen server-side in gameplay flows
// (trampo wrap-up, PvP) — there is no player-facing award endpoint (#36).

export interface StreetCredRoutesOptions {
  redis: Redis;
}

const leaderboardQuery = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** TTL for the public leaderboard snapshot (kept long for passive readers). */
const LEADERBOARD_CACHE_TTL_S = 300;

export async function streetCredRoutes(app: FastifyInstance, opts: StreetCredRoutesOptions) {
  const { redis } = opts;

  // GET /api/street-cred — live readout, decay applied (and written back)
  app.get("/street-cred", { preHandler: [authenticate] }, async (request): Promise<StreetCredInfo> => {
    const characterId = (await characters.requireByUserId(request.user.sub)).id;
    const row = await characters.findById(characterId);
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
      await characters.updateStreetCred(characterId, effectiveScore);
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
    const board = await characters.listLeaderboardRows(50);

    const leaderboard = board
      .map((row) => ({
        name: row.name,
        crewName: row.crewName,
        score: calculateDecay(new Date(row.lastActivityAt), row.streetCred, row.maxStreetCredAchieved).effectiveScore,
      }))
      .sort((a, b) => b.score - a.score)
      .map((row, index) => ({
        position: index + 1,
        characterName: row.name,
        // ND-016: crew affiliation, null for characters without a crew.
        crewName: row.crewName ?? null,
        score: row.score,
        title: getTitle(row.score),
      }));

    await redis.set(LEADERBOARD_CACHE_KEY, JSON.stringify(leaderboard), "EX", LEADERBOARD_CACHE_TTL_S);
    return { leaderboard: leaderboard.slice(0, limit) };
  });
}
