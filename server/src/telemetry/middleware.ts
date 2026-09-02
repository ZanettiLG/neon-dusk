import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { instrument } from "./instrument";
import type { GameEventType } from "./event-types";
import { httpRequestsTotal } from "./metrics";

// Neon Dusk — Telemetry middleware (ND-007)
// ============================================================================
// Registers an `onResponse` hook that persists `request.event_context` via
// `instrument()` (fire-and-forget DB insert + Prometheus counter). Wrapped in
// fastify-plugin so the hook applies to ALL routes, not just this module's.

declare module "fastify" {
  interface FastifyRequest {
    /** Set by instrumented route handlers; consumed by the onResponse hook. */
    event_context?: {
      eventType: GameEventType;
      actorId?: string | null;
      payload?: Record<string, unknown>;
    };
  }
}

async function telemetryPlugin(app: FastifyInstance): Promise<void> {
  app.addHook("onResponse", async (request, reply) => {
    // HTTP status-class counter (ND-018) — feeds the NeonDuskHighErrorRate
    // alert. Hijacked SSE responses never fire onResponse, so the counter
    // stays exact for the reply pipeline.
    httpRequestsTotal.inc({ status_class: `${Math.floor(reply.statusCode / 100)}xx` });

    const ctx = request.event_context;
    if (ctx) {
      instrument({
        eventType: ctx.eventType,
        actorId: ctx.actorId ?? null,
        payload: ctx.payload ?? {},
      });
    }
  });
}

export default fp(telemetryPlugin, { name: "telemetry" });
