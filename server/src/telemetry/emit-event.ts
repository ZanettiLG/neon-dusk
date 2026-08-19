import { gameEventRepository as gameEvents } from "../repositories/game-event-repository";
import type { GameEventType } from "./event-types";

// Neon Dusk — Telemetry event persistence (ND-007)
// ============================================================================
// Single insert point for game events. Everything the telemetry layer knows
// about a player action (trampo, PVP, economy movement, NIL spend) lands in the
// append-only `game_events` table. Callers are expected to fire-and-forget:
// telemetry must never block the hot path it instruments.

export interface EmitEventInput {
  eventType: GameEventType;
  /** The acting user/character id (nullable — not every event has an actor). */
  actorId: string | null;
  /** Arbitrary event details (amounts, targets, outcomes). */
  payload: Record<string, unknown>;
}

/** Insert one game event row. Best-effort — callers wrap in catch(). */
export async function emitEvent(input: EmitEventInput): Promise<void> {
  await gameEvents.insert({
    eventType: input.eventType,
    actorId: input.actorId,
    payload: input.payload ?? {},
  });
}
