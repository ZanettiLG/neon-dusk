import Fastify, { type FastifyInstance } from "fastify";
import type Redis from "ioredis";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { type Env } from "./env";
import { apiRoutes } from "./routes";
import { prometheusRoutes } from "./routes/metrics";
import { telemetryPlugin } from "./telemetry/middleware";
import { errorHandler } from "./middleware/error-handler";
import { createRedisClient } from "./lib/redis";

export interface AppOptions {
  env: Env;
}

// The shared Redis instance is decorated on the Fastify instance so any route
// or hook can reach it via `request.server.redis`.
declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const { env } = options;

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === "development"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
    trustProxy: env.NODE_ENV === "production",
  });

  // CORS
  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Rate Limiting — @fastify/rate-limit v10.x with direct Redis support
  // NOTE: design pinned ^9.1.0, but v9.x requires Fastify 4. v10.x supports
  // Fastify 5 AND the direct `redis` option (verified against v10.3.0 types).
  const redis = createRedisClient(env.REDIS_URL);

  // Shared Redis instance (rate-limit, auth, telemetry active-tracker)
  app.decorate("redis", redis);

  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (request, context) => ({
      statusCode: 429, // so the global error handler maps this to RATE_LIMITED
      error: "RATE_LIMITED",
      message: `Too many requests. Retry after ${Math.ceil(context.ttl / 1000)}s.`,
      retryAfter: Math.ceil(context.ttl / 1000),
    }),
  });

  // JWT — access token signing/verification (HS256, 15m TTL set per token)
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "15m" },
  });

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Telemetry (ND-007): onResponse hook — fire-and-forget game event writes.
  // Registered before the routes so it applies to every endpoint under /api.
  await app.register(telemetryPlugin);

  // Prometheus scrape endpoint at the ROOT (not under /api) so the dockerized
  // Prometheus can reach it at host.docker.internal:3000/metrics.
  await app.register(prometheusRoutes);

  // Routes — all feature routes under /api
  await app.register(apiRoutes, { prefix: "/api", redis });

  // Close the Redis client when the app shuts down
  app.addHook("onClose", async () => {
    redis.disconnect();
  });

  return app;
}
