import { Counter, Gauge, Registry } from "prom-client";
import Redis from "ioredis";
import { env } from "../env";

// Neon Dusk — Prometheus metrics (ND-007)
// ============================================================================
// Process-local singleton registry. A custom Registry (not prom-client's
// default) keeps test files isolated: vitest's singleFork re-evaluates this
// module per file, and the default registry is a process singleton that would
// collide ("metric already registered"). Counters are incremented by
// `instrument()`; the /metrics route exposes the registry to Prometheus.

const registry = new Registry();

/** NIL energy consumed. */
export const nilSpentTotal = new Counter({
  name: "neondusk_nil_spent_total",
  help: "Total NIL consumed",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Grana earned (gig payouts, PVP rewards, loot). */
export const eddiesEarnedTotal = new Counter({
  name: "neondusk_eddies_earned_total",
  help: "Total Grana earned",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Grana spent (vendor purchases, fees). */
export const eddiesSpentTotal = new Counter({
  name: "neondusk_eddies_spent_total",
  help: "Total Grana spent",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Gigs completed successfully. */
export const gigsCompletedTotal = new Counter({
  name: "neondusk_gigs_completed_total",
  help: "Total de trampos concluídos",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** PVP attacks launched. */
export const pvpAttacksTotal = new Counter({
  name: "neondusk_pvp_attacks_total",
  help: "Total PVP attacks",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/**
 * Active characters in the last 24h — counts `auth:active:*` keys via SCAN.
 * Best-effort: a Redis failure resolves to 0 so a scrape never crashes.
 */
export const activeCharacters = new Gauge({
  name: "neondusk_active_characters",
  help: "Active characters in the last 24h",
  async collect() {
    // A fresh connection per scrape keeps this lazy (no connection at import
    // time) and bounded (disposed as soon as the count is read).
    // ponytail: per-scrape connection; reuse a shared pool if scrapes get hot.
    const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    try {
      await redis.connect();
      let count = 0;
      let cursor = "0";
      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", "auth:active:*", "COUNT", 1000);
        count += keys.length;
        cursor = nextCursor;
      } while (cursor !== "0");
      this.set(count);
    } catch {
      // Redis down — report 0 rather than fail the scrape (best-effort).
      this.set(0);
    } finally {
      redis.disconnect();
    }
  },
  registers: [registry],
});

/** Serialize the registry in Prometheus text format. */
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}
