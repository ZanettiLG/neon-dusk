import type { FastifyInstance } from "fastify";
import { getMetrics } from "../telemetry/metrics";

// Neon Dusk — Prometheus scrape endpoint
// ============================================================================
// GET /metrics (root-level, NOT under /api): exposes the telemetry registry in
// Prometheus text format. Unauthenticated — Prometheus scrapes it directly
// (see prometheus/prometheus.yml).

export async function prometheusRoutes(app: FastifyInstance) {
  app.get("/metrics", async (_request, reply) => {
    const metrics = await getMetrics();
    return reply.type("text/plain").send(metrics);
  });
}
