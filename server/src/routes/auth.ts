import type { FastifyInstance } from "fastify";
import type Redis from "ioredis";
import type { AuthResponse, UserWithCharacter } from "@neon-dusk/shared";
import {
  loginSchema,
  loginUser,
  logoutUser,
  refreshSchema,
  refreshSession,
  registerSchema,
  registerUser,
  getUserWithCharacter,
} from "../services/auth-service";
import { authenticate } from "../middleware/auth";
import { setPreAuthAuditContext } from "../middleware/audit-middleware";
import { checkRateLimit } from "../lib/rate-limit";

export interface AuthRouteOptions {
  redis: Redis;
}

export async function authRoutes(app: FastifyInstance, opts: AuthRouteOptions) {
  const { redis } = opts;

  app.post(
    "/auth/register",
    {
      preHandler: [
        setPreAuthAuditContext("auth_register"),
        async (request) => {
          await checkRateLimit(redis, `auth:register:ip:${request.ip}`, 10, 60_000);
        },
      ],
    },
    async (request, reply) => {
      const result = await registerUser(app, redis, registerSchema.parse(request.body));
      return reply.status(201).send(result as AuthResponse);
    },
  );

  app.post(
    "/auth/login",
    {
      preHandler: [
        setPreAuthAuditContext("auth_login"),
        async (request) => {
          await checkRateLimit(redis, `auth:login:ip:${request.ip}`, 10, 60_000);
        },
      ],
    },
    async (request) => {
      return loginUser(app, redis, loginSchema.parse(request.body));
    },
  );

  app.post(
    "/auth/refresh",
    { preHandler: [setPreAuthAuditContext("auth_refresh")] },
    async (request) => {
      return refreshSession(app, redis, refreshSchema.parse(request.body));
    },
  );

  app.post(
    "/auth/logout",
    { preHandler: [setPreAuthAuditContext("auth_logout")] },
    async (request, reply) => {
      const { refreshToken } = refreshSchema.parse(request.body);
      await logoutUser(redis, refreshToken);
      return reply.status(204).send();
    },
  );

  app.get("/auth/me", { preHandler: [authenticate] }, async (request) => {
    return getUserWithCharacter(request.user.sub) as Promise<UserWithCharacter>;
  });
}
