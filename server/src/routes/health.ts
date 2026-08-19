import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import { checkConnection } from "../db";

export interface HealthRouteOptions {
  redis: Redis;
}

const healthResponse = {
  type: "object",
  properties: {
    status: { type: "string" },
    timestamp: { type: "string" },
    uptime: { type: "number" },
    version: { type: "string" },
    services: {
      type: "object",
      properties: {
        database: { type: "string" },
        redis: { type: "string" },
      },
    },
  },
};

export async function healthRoutes(app: FastifyInstance, opts: HealthRouteOptions) {
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: healthResponse,
          503: healthResponse,
        },
      },
    },
    async (_request, reply) => {
      const services = {
        database: "disconnected" as string,
        redis: "disconnected" as string,
      };

      try {
        await checkConnection();
        services.database = "connected";
      } catch {
        services.database = "disconnected";
      }

      // Reuse the app's Redis instance (created in app.ts for rate limiting)
      try {
        await opts.redis.ping();
        services.redis = "connected";
      } catch {
        services.redis = "disconnected";
      }

      const isHealthy = services.database === "connected" && services.redis === "connected";
      const statusCode = isHealthy ? 200 : 503;

      return reply.status(statusCode).send({
        status: isHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: "0.1.0",
        services,
      });
    },
  );
}
