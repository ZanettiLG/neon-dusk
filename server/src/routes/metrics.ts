import type { FastifyInstance } from "fastify";
import { getMetrics } from "../telemetry/metrics";

// Neon Dusk — Prometheus scrape endpoint (ND-007)
// ============================================================================
// Exposes the telemetry registry in text/plain exposition format.
// Public (no auth) — Prometheus scrapes it directly.

export async function metricsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/metrics", async (_request, reply) => {
    const metrics = await getMetrics();
    return reply.type("text/plain").send(metrics);
  });
}
