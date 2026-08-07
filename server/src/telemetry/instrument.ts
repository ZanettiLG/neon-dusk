import { emitEvent } from "./emit-event";
import type { GameEventType } from "./event-types";
import {
  eddiesEarnedTotal,
  eddiesSpentTotal,
  gigsCompletedTotal,
  nilSpentTotal,
  pvpAttacksTotal,
} from "./metrics";

// Neon Dusk — Unified instrumentation
// ============================================================================
// Single entry point for telemetry. Every instrumented call site goes through
// `instrument()` so DB persistence (game_events) and Prometheus counters can
// never diverge. Best-effort by design — a DB/Redis hiccup never surfaces to
// the player.

export interface InstrumentInput {
  eventType: GameEventType;
  /** The acting user/character id (nullable — not every event has an actor). */
  actorId?: string | null;
  /** Arbitrary event details (amounts, targets, outcomes). */
  payload?: Record<string, unknown>;
}

/** Record one game event: fire-and-forget DB insert + Prometheus counter. */
export function instrument(input: InstrumentInput): void {
  // Fire-and-forget DB insert — response already sent; drop failures silently.
  setImmediate(() => {
    void emitEvent({
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      payload: input.payload ?? {},
    }).catch(() => {
      // intentionally silent — telemetry is best-effort
    });
  });

  // Increment the Prometheus counter mapped to this event type. Only event
  // types with an ops dashboard have counters; the rest are DB-only.
  const characterId = input.actorId ?? "unknown";
  const amount = typeof input.payload?.amount === "number" ? input.payload.amount : 1;
  switch (input.eventType) {
    case "NIL_SPENT":
      nilSpentTotal.inc({ characterId }, amount);
      break;
    case "EDDIES_EARNED":
      eddiesEarnedTotal.inc({ characterId }, amount);
      break;
    case "EDDIES_SPENT":
      eddiesSpentTotal.inc({ characterId }, amount);
      break;
    case "GIG_COMPLETED":
      gigsCompletedTotal.inc({ characterId });
      break;
    case "PVP_ATTACK":
      pvpAttacksTotal.inc({ characterId });
      break;
    // Other event types don't have Prometheus counters (design decision).
    default:
      break;
  }
}
