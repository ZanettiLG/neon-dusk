import Fastify, { type FastifyInstance } from "fastify";
import type Redis from "ioredis";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { type Env, corsOrigins } from "./env";
import { apiRoutes } from "./routes";
import { healthRoutes } from "./routes/health";
import { errorHandler } from "./middleware/error-handler";
import { createRedisClient } from "./lib/redis";
import { sseCorsHeaders } from "./lib/sse";
import telemetryPlugin from "./telemetry/middleware";
import auditOnResponse from "./middleware/audit-middleware";
import { metricsRoutes } from "./routes/metrics";

export interface AppOptions {
  env: Env;
}

// The shared Redis instance is decorated on the Fastify instance so any route
// or hook can reach it via `request.server.redis`.
declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
    /**
     * CORS headers for hijacked SSE responses — mirrors the @fastify/cors
     * config (origin + credentials), whose reply.header() calls never reach
     * the wire on writeHead()+hijack() responses. Call with the request
     * origin (echoed when allowed, first origin otherwise). See lib/sse.ts.
     */
    sseCorsHeaders: (origin?: string) => Record<string, string>;
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

  // CORS — multi-origin (ND-018): CORS_ORIGIN is comma-separated, e.g.
  // "http://localhost:5173,https://neondusk.gg". @fastify/cors accepts the
  // parsed array; the SSE route needs the same list via request.server.sseCorsHeaders.
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // SSE endpoints bypass the reply pipeline (reply.raw.writeHead + hijack,
  // ADR-1), so the cors hook's reply.header() calls never reach the wire —
  // decorate the equivalent headers for the hijacked writeHead calls.
  app.decorate("sseCorsHeaders", sseCorsHeaders(env));

  // Rate Limiting — @fastify/rate-limit v10.x with direct Redis support
  // NOTE: design pinned ^9.1.0, but v9.x requires Fastify 4. v10.x supports
  // Fastify 5 AND the direct `redis` option (verified against v10.3.0 types).
  const redis = createRedisClient(env.REDIS_URL);

  // Shared Redis instance (rate-limit, auth, telemetry active-tracker)
  app.decorate("redis", redis);

  // Health endpoint registered BEFORE the rate-limit plugin so it stays
  // reachable (and reports redis: "disconnected") when Redis is down.
  await app.register(healthRoutes, { prefix: "/api", redis });

  // ponytail: in-memory rate-limit — no Redis dependency, fails open on OOM.
  // Add `redis` back when running multi-instance behind a load balancer.
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (request, context) => ({
      statusCode: 429, // so the global error handler maps this to RATE_LIMITED
      error: "RATE_LIMITED",
      message: `Muitas requisições. Tente de novo em ${Math.ceil(context.ttl / 1000)}s.`,
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

  // Audit (ND-053): onResponse hook — fire-and-forget audit log entries.
  // Registered AFTER telemetry but BEFORE routes so it sees all responses.
  await app.register(auditOnResponse);

  // Prometheus scrape endpoint at the ROOT (not under /api) so the dockerized
  // Prometheus can reach it at host.docker.internal:3000/metrics.
  await app.register(metricsRoutes);

  // Routes — all feature routes under /api
  await app.register(apiRoutes, { prefix: "/api", redis });

  // Close the Redis client when the app shuts down
  app.addHook("onClose", async () => {
    redis.disconnect();
  });

  return app;
}
