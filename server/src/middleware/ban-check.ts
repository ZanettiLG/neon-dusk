import type { FastifyRequest } from "fastify";
import { characterRepository as characters } from "../repositories/character-repository";
import { AppError } from "./error-handler";

// Neon Dusk — manual admin ban gate (ND-053, Gap D)
// ============================================================================
// `characters.is_banned` is set by the admin panel (admin-service.banPlayer)
// but was never enforced on the player side: banned players could keep logging
// in and playing. This middleware closes the gap. Fail-open: an infra error
// (DB down) must never block an otherwise valid player.

/**
 * Throw AppError(403, "BANNED") when the user's character is banned.
 * No-op when the user has no character. Fail-open on infra errors.
 */
export async function assertCharacterNotBanned(userId: string): Promise<void> {
  try {
    const character = await characters.findByUserId(userId);
    if (character?.is_banned) {
      throw new AppError(403, "BANNED", "Sua conta foi banida.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // ponytail: DB unavailable — fail open, don't block an otherwise valid player
    console.warn("[ban-check] DB unavailable, allowing request");
  }
}

/**
 * PreHandler that blocks requests from banned characters.
 *
 * - Banned character → AppError(403, "BANNED")
 * - No character     → AppError(404, "NO_CHARACTER") (default `requireCharacter`)
 * - DB unavailable   → fail open (request allowed)
 *
 * Pass `{ requireCharacter: false }` to skip the NO_CHARACTER gate — needed by
 * `authenticate`, which must keep serving pre-character flows (register →
 * POST /characters).
 */
export async function checkBan(
  request: FastifyRequest,
  opts: { requireCharacter?: boolean } = {},
): Promise<void> {
  const { requireCharacter = true } = opts;
  try {
    const character = requireCharacter
      ? await characters.requireByUserId(request.user.sub)
      : await characters.findByUserId(request.user.sub);
    if (character?.is_banned) {
      throw new AppError(403, "BANNED", "Sua conta foi banida.");
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    // ponytail: DB unavailable — fail open, don't block an otherwise valid player
    console.warn("[ban-check] DB unavailable, allowing request");
  }
}
