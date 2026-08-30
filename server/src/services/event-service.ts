import type {
  CharacterEvent,
  CharacterEventSeverity,
  CharacterEventsResponse,
  GameEventType,
} from "@neon-dusk/shared";
import { gameEventRepository as gameEvents } from "../repositories/game-event-repository";

// Neon Dusk — Player event feed (ND-139)
// ============================================================================
// Maps the append-only `game_events` telemetry stream into a character-scoped,
// cursor-paginated feed for the corredor dashboard. Read-only; no writes here.

/** Coarse severity per event type (drives glyph + text color in the UI). */
export function severityFor(eventType: GameEventType): CharacterEventSeverity {
  switch (eventType) {
    case "GIG_COMPLETED":
    case "EDDIES_EARNED":
    case "NIL_RESTORED":
    case "ABILITY_ACTIVATED":
    case "OS_ACTIVATED":
    case "THERAPY_COMPLETED":
    case "HUMANITY_RESTORED":
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
  const rows = await gameEvents.listCharacterEvents(characterId, limit, cursor);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const events: CharacterEvent[] = page.map((row) => ({
    id: row.id,
    eventType: row.eventType,
    severity: severityFor(row.eventType),
    payload: row.payload ?? {},
    createdAt: new Date(row.createdAt).toISOString(),
  }));

  const nextCursor = hasMore ? events[events.length - 1].createdAt : null;

  return { events, nextCursor };
}
