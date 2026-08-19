import type { GameEventType } from "@neon-dusk/shared";
import { db, type Queryable } from "../db";

// Neon Dusk — Game event repository (#158 DB repository layer)
// ============================================================================
// Append-only game_events access (telemetry). Inserts are best-effort —
// callers wrap in catch() so telemetry never fails the hot path.

/** Event count row (grouped by type). */
export interface EventCountRow {
  eventType: string;
  count: number;
}

/** game_events row for the character feed (camelCase aliases). */
export interface CharacterEventRow {
  id: string;
  eventType: GameEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface GameEventRepository {
  /** Insert one game event row. */
  insert(
    input: { eventType: string; actorId: string | null; payload: Record<string, unknown> },
    q?: Queryable,
  ): Promise<void>;
  /** Event counts grouped by type for the last `hours`. */
  countByType(hours: number, q?: Queryable): Promise<EventCountRow[]>;
  /** Distinct actors with at least one event in the last `hours`. */
  countDistinctActors(hours: number, q?: Queryable): Promise<number>;
  /** Events per hour for the last `hours` (hour label + count). */
  listHourlyCounts(hours: number, q?: Queryable): Promise<Array<{ hour: string; count: number }>>;
  /**
   * A character's own events, newest first, cursor-paginated by createdAt.
   * Returns `limit + 1` rows so the caller can detect whether a next page
   * exists; `cursor` is the ISO timestamp to page strictly older than.
   */
  listCharacterEvents(
    characterId: string,
    limit: number,
    cursor?: string,
    q?: Queryable,
  ): Promise<CharacterEventRow[]>;
}

export function createGameEventRepository(q: Queryable = db): GameEventRepository {
  /** `hours` ago cutoff — parameterized for safety (hours is always a literal number). */
  const sinceHours = (hours: number) => q.raw("now() - make_interval(hours => ?)", [hours]);

  return {
    async insert(input, tx = q) {
      await tx("game_events").insert({
        event_type: input.eventType,
        actor_id: input.actorId,
        payload: input.payload ?? {},
      });
    },

    async countByType(hours, tx = q) {
      return (await tx("game_events")
        .select({
          eventType: "event_type",
          count: q.raw("count(*)::int"),
        })
        .where("created_at", ">", sinceHours(hours))
        .groupBy("event_type")) as unknown as EventCountRow[];
    },

    async countDistinctActors(hours, tx = q) {
      const rows = await tx("game_events")
        .select({ count: q.raw("count(distinct actor_id)::int") })
        .where("created_at", ">", sinceHours(hours))
        .whereNotNull("actor_id");
      return rows[0]?.count ?? 0;
    },

    async listHourlyCounts(hours, tx = q) {
      return (await tx("game_events")
        .select({
          hour: q.raw("date_trunc('hour', game_events.created_at)::text"),
          count: q.raw("count(*)::int"),
        })
        .where("created_at", ">", sinceHours(hours))
        .groupByRaw("date_trunc('hour', game_events.created_at)")
        .orderByRaw("date_trunc('hour', game_events.created_at)")) as unknown as Array<{
        hour: string;
        count: number;
      }>;
    },

    async listCharacterEvents(characterId, limit, cursor, tx = q) {
      let query = tx("game_events")
        .select({
          id: "id",
          eventType: "event_type",
          payload: "payload",
          createdAt: "created_at",
        })
        .where("actor_id", characterId);

      if (cursor) {
        query = query.where("created_at", "<", new Date(cursor));
      }

      return (await query
        .orderBy("created_at", "desc")
        .limit(limit + 1)) as unknown as CharacterEventRow[]; // one extra row to detect hasMore
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const gameEventRepository = createGameEventRepository();
