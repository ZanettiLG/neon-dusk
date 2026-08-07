import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import type { GameEventType } from "./event-types";
import { emitEvent } from "./emit-event";

// Neon Dusk — Telemetry middleware
// ============================================================================
// Registers an onResponse hook that persists `request.event_context` (set by
// instrumented routes, e.g. gig/economy handlers) into the game_events table.
// The write is fire-and-forget via setImmediate: the response has already been
// sent, and a DB hiccup must never surface to the player.
//
// Wrapped in fastify-plugin so the hook is NOT encapsulated — without it,
// hooks registered via app.register() only apply to routes registered inside
// the plugin, and this plugin registers no routes.

/** Telemetry context a route can attach to its request. */
export interface RequestEventContext {
  eventType: GameEventType;
  actorId?: string;
  payload?: Record<string, unknown>;
}

declare module "fastify" {
  interface FastifyRequest {
    event_context?: RequestEventContext;
  }
}

/** Fastify plugin — registers the onResponse telemetry hook. */
export const telemetryPlugin = fp(async function telemetryPlugin(app: FastifyInstance) {
  app.addHook("onResponse", async (request) => {
    const context = request.event_context;
    if (!context) return;

    setImmediate(() => {
      emitEvent(context).catch((err) => request.log.error({ err }, "telemetry failed"));
    });
  });
});
