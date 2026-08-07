import { collectDefaultMetrics, Counter, Gauge, Registry } from "prom-client";
import type Redis from "ioredis";
import { env } from "../env";
import { createRedisClient } from "../lib/redis";

// Neon Dusk — Prometheus metrics (singleton)
// ============================================================================
// One registry, shared by the whole process. Counters are incremented by the
// features that produce the underlying events (gigs, economy, PVP) via the
// exports below; the /metrics route (routes/metrics.ts) exposes the registry
// to Prometheus.

const registry = new Registry();

// Optional Node.js runtime metrics (event loop lag, heap, etc.) — off by
// default; enable with PROMETHEUS_COLLECT_DEFAULTS=true.
if (env.PROMETHEUS_COLLECT_DEFAULTS === "true") {
  collectDefaultMetrics({ register: registry });
}

/** Total NIL consumed by players (per character). */
export const nilSpentTotal = new Counter({
  name: "neondusk_nil_spent_total",
  help: "Total NIL consumed by players",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Total eddies earned by players (per character). */
export const eddiesEarnedTotal = new Counter({
  name: "neondusk_eddies_earned_total",
  help: "Total eddies earned by players",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Total eddies spent by players (per character). */
export const eddiesSpentTotal = new Counter({
  name: "neondusk_eddies_spent_total",
  help: "Total eddies spent by players",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Total gigs completed by players (per character). */
export const gigsCompletedTotal = new Counter({
  name: "neondusk_gigs_completed_total",
  help: "Total gigs completed by players",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

/** Total PVP attacks launched by players (per character). */
export const pvpAttacksTotal = new Counter({
  name: "neondusk_pvp_attacks_total",
  help: "Total PVP attacks launched by players",
  labelNames: ["characterId"] as const,
  registers: [registry],
});

// Redis client used only for the active-character gauge. Created lazily on the
// first scrape so a metrics module import never opens a connection.
let activeRedis: Redis | null | undefined;

function getActiveRedis(): Redis | null {
  if (activeRedis === undefined) {
    activeRedis = createRedisClient(env.REDIS_URL);
  }
  return activeRedis;
}

/** Unique players active in the last 24h — derived from `auth:active:*` keys. */
export const activeCharacters = new Gauge({
  name: "neondusk_active_characters",
  help: "Unique players active in the last 24 hours",
  async collect() {
    let count = 0;
    try {
      const redis = getActiveRedis();
      if (redis) {
        // SCAN (not KEYS) — O(N) per call but safe on a busy server; runs
        // once per scrape (15s), so the cost is bounded.
        const stream = redis.scanStream({ match: "auth:active:*", count: 1000 });
        for await (const keys of stream) {
          count += Array.isArray(keys) ? keys.length : 0;
        }
      }
    } catch {
      // Redis down → report 0 rather than failing the whole scrape.
      this.set(0);
      return;
    }
    this.set(count);
  },
  registers: [registry],
});

/** Serialize the registry in Prometheus text format. */
export async function getMetrics(): Promise<string> {
  return registry.metrics();
}
