import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { FastifyInstance } from "fastify";

// Neon Dusk — Auth primitives
// ============================================================================
// Access tokens: signed JWTs (HS256, 15 min TTL) via the @fastify/jwt plugin
// registered in app.ts. Refresh tokens: opaque UUIDs stored in Redis (7d TTL);
// they are rotated on every use and revoked on logout.

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60; // 7 days

/** Payload embedded in the access token and exposed as `request.user`. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
}

/** JWT type augmentation consumed by @fastify/jwt → typed `request.user`. */
declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

function refreshKey(token: string): string {
  return `auth:refresh:${token}`;
}

/** Sign a 15-minute access token for the given user. */
export function signAccessToken(app: FastifyInstance, user: { id: string; email: string }): string {
  return app.jwt.sign({ sub: user.id, email: user.email }, { expiresIn: ACCESS_TOKEN_TTL });
}

/** Issue a fresh opaque refresh token, storing it in Redis for 7 days. */
export async function issueRefreshToken(redis: Redis, userId: string): Promise<string> {
  const token = randomUUID();
  await redis.set(refreshKey(token), userId, "EX", REFRESH_TOKEN_TTL_S);
  return token;
}

/**
 * Atomically consume a refresh token: returns the user id and deletes the
 * token in one step, so rotation is single-use even under concurrent requests.
 * Returns null when the token is unknown/expired.
 */
export async function consumeRefreshToken(redis: Redis, token: string): Promise<string | null> {
  return redis.getdel(refreshKey(token));
}

/** Invalidate a refresh token (logout / rotation). */
export async function revokeRefreshToken(redis: Redis, token: string): Promise<void> {
  await redis.del(refreshKey(token));
}
