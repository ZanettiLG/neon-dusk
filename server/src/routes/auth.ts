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

export interface AuthRouteOptions {
  redis: Redis;
}

export async function authRoutes(app: FastifyInstance, opts: AuthRouteOptions) {
  const { redis } = opts;

  app.post("/auth/register", async (request, reply) => {
    const result = await registerUser(app, redis, registerSchema.parse(request.body));
    return reply.status(201).send(result as AuthResponse);
  });

  app.post("/auth/login", async (request) => {
    return loginUser(app, redis, loginSchema.parse(request.body));
  });

  app.post("/auth/refresh", async (request) => {
    return refreshSession(app, redis, refreshSchema.parse(request.body));
  });

  app.post("/auth/logout", async (request, reply) => {
    const { refreshToken } = refreshSchema.parse(request.body);
    await logoutUser(redis, refreshToken);
    return reply.status(204).send();
  });

  app.get("/auth/me", { preHandler: [authenticate] }, async (request) => {
    return getUserWithCharacter(request.user.sub) as Promise<UserWithCharacter>;
  });
}
