import { db, type Queryable } from "../db";

// Neon Dusk — Game param repository (#158 DB repository layer)
// ============================================================================

/** Raw row shape for `game_params`. */
export interface GameParamRow {
  key: string;
  value: string;
  updated_by: string | null;
  updated_at: Date;
}

export interface GameParamRepository {
  /** All params as a flat record. */
  get(q?: Queryable): Promise<Record<string, string>>;
  /** All param rows. */
  list(q?: Queryable): Promise<GameParamRow[]>;
  /** Update one param (key must already exist — checked by the caller). */
  set(key: string, value: string, adminUserId: string, q?: Queryable): Promise<void>;
}

export function createGameParamRepository(q: Queryable = db): GameParamRepository {
  return {
    async get(tx = q) {
      const rows = await tx("game_params").select();
      return Object.fromEntries(
        rows.map((r) => [(r as GameParamRow).key, (r as GameParamRow).value]),
      );
    },

    async list(tx = q) {
      return (await tx("game_params").select()) as GameParamRow[];
    },

    async set(key, value, adminUserId, tx = q) {
      await tx("game_params")
        .update({ value, updated_by: adminUserId, updated_at: new Date() })
        .where("key", key);
      // Admin updates must be visible immediately — drop the 30s cache entry.
      invalidateGameParamCache(key);
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const gameParamRepository = createGameParamRepository();

// ─── Cached param reads (ND-052) ────────────────────────────────────────────
// Services read tunables (ROUND_DURATION_DAYS, PVP_NIL_COST, ...) through
// getGameParam instead of hardcoded constants so the admin panel can tune the
// economy live. The 30s in-memory cache keeps the read off the hot paths
// (every wrap-up, every attack); admin updates invalidate it immediately.

/** How long a resolved param value stays cached, in ms. */
const PARAM_CACHE_TTL_MS = 30_000;

/** In-memory param cache: key → { value, expiresAt }. */
const paramCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Read one game param with a short cache and a fallback for missing keys.
 *
 * The value is cached for 30s (per key); a cache hit never touches the DB.
 * When the key does not exist (e.g. before a migration seeds it), `fallback`
 * is returned and also cached, so a missing param does not hammer the DB.
 * Callers must pass numeric values as strings; `Number(...)` the result.
 *
 * @param key      — the game_params key (e.g. "PVP_NIL_COST").
 * @param fallback — value used when the key is not present in the DB.
 * @param q        — queryable (defaults to the global db). Config reads are
 *                   not transactional state, so services usually omit it.
 * @returns the param value as a string.
 */
export async function getGameParam(
  key: string,
  fallback: string,
  q: Queryable = db,
): Promise<string> {
  const cached = paramCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const rows = await q("game_params").select("value").where("key", key).limit(1);
  const value = rows.length > 0 ? (rows[0] as { value: string }).value : fallback;

  paramCache.set(key, { value, expiresAt: Date.now() + PARAM_CACHE_TTL_MS });
  return value;
}

/**
 * Drop cached param values so the next read hits the DB. Called by the
 * repository's `set` (admin updates must apply immediately, not after the
 * 30s TTL); exported so tests can reset state deterministically.
 *
 * @param key — invalidate one key; omit to clear the whole cache.
 */
export function invalidateGameParamCache(key?: string): void {
  if (key) paramCache.delete(key);
  else paramCache.clear();
}
