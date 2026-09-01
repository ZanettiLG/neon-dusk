import { z } from "zod";
import bcrypt from "bcrypt";
import type Redis from "ioredis";
import type { FastifyInstance } from "fastify";
import type { AuthResponse, Character, User, UserWithCharacter } from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import { toPublicCharacter } from "../lib/transformers";
import {
  consumeRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
  signAccessToken,
} from "../lib/auth";
import { checkRateLimit } from "../lib/rate-limit";
import { assertCharacterNotBanned } from "../middleware/ban-check";
import { userRepository as users } from "../repositories/user-repository";
import { characterRepository as characters } from "../repositories/character-repository";
import type { UserRow } from "../repositories/user-repository";

// Neon Dusk — Auth service
// ============================================================================

export const emailSchema = z.string().trim().toLowerCase().email("Invalid email address");
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export const loginSchema = registerSchema;
export const refreshSchema = z.object({
  refreshToken: z.string().uuid("Invalid refresh token"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;

const BCRYPT_ROUNDS = 12;
const LOGIN_RATE_LIMIT = { max: 500, windowMs: 60_000 };
const REGISTER_RATE_LIMIT = { max: 300, windowMs: 60_000 };

/** Strip the password hash off a DB user row (snake → public camelCase). */
function toPublicUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Load the user's character (users have at most one). */
async function findCharacterByUser(userId: string): Promise<Character | null> {
  const row = await characters.findByUserId(userId);
  return row ? toPublicCharacter(row) : null;
}

async function buildAuthResponse(
  app: FastifyInstance,
  redis: Redis,
  user: UserRow,
): Promise<AuthResponse> {
  const [accessToken, refreshToken, character] = await Promise.all([
    signAccessToken(app, { id: user.id, email: user.email, role: user.role }),
    issueRefreshToken(redis, user.id),
    findCharacterByUser(user.id),
  ]);
  return { accessToken, refreshToken, user: toPublicUser(user), character };
}

/** Register a new account and return a token pair. */
export async function registerUser(
  app: FastifyInstance,
  redis: Redis,
  input: RegisterInput,
): Promise<AuthResponse> {
  await checkRateLimit(
    redis,
    `register:${input.email}`,
    REGISTER_RATE_LIMIT.max,
    REGISTER_RATE_LIMIT.windowMs,
  );

  if (await users.findByEmail(input.email)) {
    throw new AppError(409, "EMAIL_TAKEN", "Já existe uma conta com este email");
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const user = await users.insert({ email: input.email, password_hash: passwordHash });

  return buildAuthResponse(app, redis, user);
}

/** Log in with email + password and return a token pair. */
export async function loginUser(
  app: FastifyInstance,
  redis: Redis,
  input: LoginInput,
): Promise<AuthResponse> {
  await checkRateLimit(
    redis,
    `login:${input.email}`,
    LOGIN_RATE_LIMIT.max,
    LOGIN_RATE_LIMIT.windowMs,
  );

  const user = await users.findByEmail(input.email);
  // Same error for unknown email vs wrong password (no account enumeration).
  if (!user || !(await bcrypt.compare(input.password, user.password_hash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email ou senha inválidos");
  }

  // ND-053 (Gap D): banned players must not receive new tokens. Runs after
  // credential verification so ban status is never leaked to unauthenticated
  // callers. `authenticate` enforces the same gate on every subsequent request.
  await assertCharacterNotBanned(user.id);

  return buildAuthResponse(app, redis, user);
}

/** Rotate the refresh token: atomically consume the old one, issue a new pair. */
export async function refreshSession(
  app: FastifyInstance,
  redis: Redis,
  input: RefreshInput,
): Promise<AuthResponse> {
  const userId = await consumeRefreshToken(redis, input.refreshToken);
  if (!userId) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token inválido ou expirado");
  }

  const user = await users.findById(userId);
  if (!user) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token inválido ou expirado");
  }

  return buildAuthResponse(app, redis, user);
}

/** Invalidate a refresh token (logout). Idempotent. */
export async function logoutUser(redis: Redis, token: string): Promise<void> {
  await revokeRefreshToken(redis, token);
}

/** Fetch the authenticated user and their character (if any). */
export async function getUserWithCharacter(userId: string): Promise<UserWithCharacter> {
  const user = await users.findById(userId);
  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "Usuário não existe mais");
  }
  return { user: toPublicUser(user), character: await findCharacterByUser(userId) };
}
