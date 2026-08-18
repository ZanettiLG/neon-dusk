import type {
  CharacterEvent,
  CharacterEventSeverity,
  CharacterEventsResponse,
  GameEventType,
} from "@neon-dusk/shared";
import { db } from "../db";

// Neon Dusk — Player event feed (ND-139)
// ============================================================================
// Maps the append-only `game_events` telemetry stream into a character-scoped,
// cursor-paginated feed for the runner dashboard. Read-only; no writes here.

/** Coarse severity per event type (drives glyph + text color in the UI). */
export function severityFor(eventType: GameEventType): CharacterEventSeverity {
  switch (eventType) {
    case "GIG_COMPLETED":
    case "EDDIES_EARNED":
    case "NIL_RESTORED":
    case "ABILITY_ACTIVATED":
      return "success";
    case "GIG_FAILED":
    case "PVP_DEFEAT":
      return "danger";
    case "PVP_ATTACK":
    case "NIL_SPENT":
      return "warning";
    default:
      return "info";
  }
}

/** Raw game_events row shape (snake_case columns). */
interface DbGameEventRow {
  id: string;
  event_type: GameEventType;
  payload: Record<string, unknown>;
  created_at: Date;
}

/**
 * List a character's own events, newest first, cursor-paginated by createdAt.
 * Fetches `limit + 1` rows to detect whether a next page exists; the cursor is
 * the ISO timestamp of the last returned event (pass back to page forward).
 */
export async function listCharacterEvents(
  characterId: string,
  limit: number,
  cursor?: string,
): Promise<CharacterEventsResponse> {
  let query = db("game_events")
    .select("id", "event_type", "payload", "created_at")
    .where("actor_id", characterId);

  if (cursor) {
    query = query.where("created_at", "<", new Date(cursor));
  }

  const rows = (await query
    .orderBy("created_at", "desc")
    .limit(limit + 1)) as DbGameEventRow[]; // one extra row to detect hasMore

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const events: CharacterEvent[] = page.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    severity: severityFor(row.event_type),
    payload: row.payload ?? {},
    createdAt: new Date(row.created_at).toISOString(),
  }));

  const nextCursor = hasMore ? events[events.length - 1].createdAt : null;

  return { events, nextCursor };
}
