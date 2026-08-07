// Neon Dusk — Round check cron (ND-017)
// ============================================================================
// setInterval-based checker (no external cron lib — ADR-4). Runs every hour
// and triggers a reset once the active round has exceeded its duration. The
// interval dies with the process: correct for a single-instance MVP; a
// multi-instance deployment would need a Redis lock to avoid double resets.

import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { rounds } from "../db/schema";
import { env } from "../env";
import { performRoundReset } from "../services/round-service";

/** How often the round expiry is checked. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

/** ms in one day (ROUND_DURATION_DAYS is expressed in days). */
const DAY_MS = 86_400_000;

/**
 * Start the round-check cron. Runs every hour and triggers a reset when the
 * active round has exceeded its duration. Called from server.ts after the
 * server is listening. Returns the interval handle so tests can clear it.
 */
export function startRoundCheckCron(app: FastifyInstance): NodeJS.Timeout {
  const interval = setInterval(() => {
    checkAndReset(app).catch((err) => {
      app.log.error({ err }, "round-check: reset check failed");
    });
  }, CHECK_INTERVAL_MS);

  app.log.info({ intervalMs: CHECK_INTERVAL_MS }, "round-check: cron started");
  return interval;
}

/**
 * Check if the active round is over (started_at + ROUND_DURATION_DAYS < now)
 * and trigger the reset if so. Exported for direct invocation in tests.
 */
export async function checkAndReset(app: FastifyInstance): Promise<void> {
  const durationMs = env.ROUND_DURATION_DAYS * DAY_MS;

  const [activeRound] = await db.select().from(rounds).where(eq(rounds.status, "active")).limit(1);

  if (!activeRound) {
    app.log.debug("round-check: no active round, skipping");
    return;
  }

  // During the intermission the next round's started_at is in the future —
  // a negative elapsed is always inside the duration, so it is skipped here.
  const endsAt = activeRound.startedAt.getTime() + durationMs;
  if (endsAt > Date.now()) {
    app.log.debug(
      {
        roundNumber: activeRound.roundNumber,
        endsAt: new Date(endsAt).toISOString(),
        roundDurationDays: env.ROUND_DURATION_DAYS,
      },
      "round-check: round still active, skipping",
    );
    return;
  }

  app.log.info({ roundNumber: activeRound.roundNumber }, "round-check: triggering reset");
  const result = await performRoundReset();
  app.log.info(
    {
      endedRound: result.endedRound,
      newRound: result.newRound,
      legendsInducted: result.legendsInducted,
    },
    "round-check: reset complete",
  );
}
