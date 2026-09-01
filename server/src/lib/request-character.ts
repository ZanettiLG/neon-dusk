import type { FastifyRequest } from "fastify";
import { characterRepository as characters } from "../repositories/character-repository";
import type { CharacterRow } from "../repositories/character-repository";
import { AppError } from "../middleware/error-handler";

// Neon Dusk — per-request character cache (ND-053, M6)
// ============================================================================
// Every mutation route resolves the caller's character in multiple places: the
// ban check, the audit context, the cooldown gate, and the handler itself. Each
// resolution was a separate `characters.findByUserId`/`requireByUserId` query.
// This helper memoizes the resolved row on `request` so the whole preHandler
// chain + handler share a single query per request.

declare module "fastify" {
  interface FastifyRequest {
    /**
     * Resolved character for the authenticated user, memoized per request.
     * `undefined` = not resolved yet; `null` = user has no character.
     */
    character?: CharacterRow | null;
  }
}

/**
 * Return the caller's character, resolving it from the DB on first call and
 * memoizing the row on `request` for the rest of the request lifecycle.
 *
 * With `require: true` (default) a missing character throws NO_CHARACTER —
 * matching `characters.requireByUserId`. With `require: false` it returns
 * `null` instead (used by the ban check, which must keep serving
 * pre-character flows).
 */
export async function resolveCharacter(
  request: FastifyRequest,
  opts: { require?: boolean } = {},
): Promise<CharacterRow | null> {
  if (request.character !== undefined) {
    if (request.character === null && opts.require !== false) {
      throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");
    }
    return request.character;
  }

  const character = await characters.findByUserId(request.user.sub);
  if (!character && opts.require !== false) {
    throw new AppError(404, "NO_CHARACTER", "Crie um personagem primeiro");
  }
  request.character = character;
  return character;
}
