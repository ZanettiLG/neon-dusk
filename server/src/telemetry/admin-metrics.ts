import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import type { AdminMetricsResponse, GameEventType } from "@neon-dusk/shared";
import { db } from "../db";
import { gameEvents } from "../db/schema";
import { requireAdmin } from "../middleware/admin-auth";

// Neon Dusk — Admin telemetry endpoint
// ============================================================================
// GET /api/admin/metrics (x-api-key protected): a JSON digest of recent game
// activity for the ops dashboard. Counts come straight from the game_events
// table; no Prometheus round-trip, so it works even when scraping is down.

interface CountRow {
  eventType: string;
  count: number;
}

/** `hours` ago cutoff — computed server-side (postgres-js can't bind Date params). */
function sinceHours(hours: number): ReturnType<typeof sql> {
  return sql`now() - make_interval(hours => ${hours})`;
}

/** Event counts grouped by type, for the last `hours`. */
async function countEventsByType(hours: number): Promise<CountRow[]> {
  return db
    .select({
      eventType: gameEvents.eventType,
      count: sql<number>`count(*)::int`,
    })
    .from(gameEvents)
    .where(sql`${gameEvents.createdAt} > ${sinceHours(hours)}`)
    .groupBy(gameEvents.eventType);
}

/** Distinct actors with at least one event in the last `hours`. */
async function countDistinctActors(hours: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(distinct ${gameEvents.actorId})::int` })
    .from(gameEvents)
    .where(
      sql`${gameEvents.createdAt} > ${sinceHours(hours)} and ${gameEvents.actorId} is not null`,
    );
  return rows[0]?.count ?? 0;
}

function toRecord(rows: CountRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.eventType, row.count]));
}

function sumFor(rows: CountRow[], types: readonly GameEventType[]): number {
  return rows
    .filter((row) => (types as readonly string[]).includes(row.eventType))
    .reduce((acc, row) => acc + row.count, 0);
}

/** Fastify plugin — registers the admin metrics route (under the /api prefix). */
export async function telemetryAdminRoutes(app: FastifyInstance) {
  app.get("/admin/metrics", { preHandler: [requireAdmin] }, async () => {
    const last24h = await countEventsByType(24);
    const last1h = await countEventsByType(1);

    const response: AdminMetricsResponse = {
      timestamp: new Date().toISOString(),
      events: {
        last24h: toRecord(last24h),
        last1h: toRecord(last1h),
      },
      economy: {
        eddiesEarned24h: sumFor(last24h, ["EDDIES_EARNED"]),
        eddiesSpent24h: sumFor(last24h, ["EDDIES_SPENT"]),
        nilSpent24h: sumFor(last24h, ["NIL_SPENT"]),
      },
      activity: {
        activeCharacters24h: await countDistinctActors(24),
        gigsCompleted24h: sumFor(last24h, ["GIG_COMPLETED"]),
        gigsFailed24h: sumFor(last24h, ["GIG_FAILED"]),
        pvpAttacks24h: sumFor(last24h, ["PVP_ATTACK"]),
      },
    };
    return response;
  });
}
