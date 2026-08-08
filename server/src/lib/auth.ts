import { randomUUID } from "node:crypto";
import type Redis from "ioredis";
import type { FastifyInstance } from "fastify";

// Neon Dusk — Auth primitives
// ============================================================================
// Access tokens: signed JWTs (HS256, 15 min TTL) via the @fastify/jwt plugin
// registered in app.ts. Refresh tokens: opaque UUIDs stored in Redis (7d TTL).
//
// Token rotation uses a blacklist pattern (MVP Option B):
//   1. Live token:   auth:refresh:{token}          = userId  (7d TTL)
//   2. Revoked token: auth:refresh:revoked:{token}  = "1"     (TTL mirrors original)
//
// On refresh: consume the old token (getdel → add to blacklist), issue new.
// If a revoked token reappears → replay attack detected → 401.
// On logout: revoke (del live key + add to blacklist).

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL_S = 7 * 24 * 60 * 60; // 7 days

/** Payload embedded in the access token and exposed as `request.user`. */
export interface AccessTokenPayload {
  sub: string; // user id
  email: string;
  role: "player" | "admin";
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

function revokedKey(token: string): string {
  return `auth:refresh:revoked:${token}`;
}

/** Sign a 15-minute access token for the given user. */
export function signAccessToken(
  app: FastifyInstance,
  user: { id: string; email: string; role?: "player" | "admin" },
): string {
  return app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role ?? "player" },
    { expiresIn: ACCESS_TOKEN_TTL },
  );
}

/** Issue a fresh opaque refresh token, storing it in Redis for 7 days. */
export async function issueRefreshToken(redis: Redis, userId: string): Promise<string> {
  const token = randomUUID();
  await redis.set(refreshKey(token), userId, "EX", REFRESH_TOKEN_TTL_S);
  return token;
}

/**
 * Check whether a refresh token was already revoked (in the blacklist).
 * If true, the token was consumed by a prior refresh — a reuse attempt
 * signals a potential replay attack.
 */
export async function isRefreshTokenRevoked(redis: Redis, token: string): Promise<boolean> {
  return (await redis.exists(revokedKey(token))) === 1;
}

/**
 * Atomically consume a refresh token:
 *   1. Check blacklist — if already revoked, reject (replay detection).
 *   2. Atomically get+delete the live key via getdel (single-use under concurrency).
 *   3. Add the token to the blacklist so any future use is detectable.
 * Returns the owner's user id, or null when unknown/expired/revoked.
 */
export async function consumeRefreshToken(redis: Redis, token: string): Promise<string | null> {
  // Replay detection: if the token is already in the blacklist, reject
  // immediately. Two concurrent calls that both pass this gate are fine —
  // getdel below is atomic and guarantees only one wins.
  if (await isRefreshTokenRevoked(redis, token)) {
    return null;
  }

  const userId = await redis.getdel(refreshKey(token));
  if (!userId) {
    return null;
  }

  // Add to blacklist with full 7-day TTL.
  // ponytail: we don't know the original TTL post-getdel, so we use the max.
  // The blacklist caps at the original token's max lifetime — harmless.
  await redis.set(revokedKey(token), "1", "EX", REFRESH_TOKEN_TTL_S);

  return userId;
}

/**
 * Invalidate a refresh token (logout / rotation).
 * Stores the token in the blacklist with the same TTL the live key had left,
 * so the blacklist entry expires alongside what would have been the token's
 * remaining lifespan.
 */
export async function revokeRefreshToken(redis: Redis, token: string): Promise<void> {
  const ttl = await redis.ttl(refreshKey(token));
  const effectiveTtl = ttl > 0 ? ttl : REFRESH_TOKEN_TTL_S;

  await redis
    .multi()
    .del(refreshKey(token))
    .set(revokedKey(token), "1", "EX", effectiveTtl)
    .exec();
}
