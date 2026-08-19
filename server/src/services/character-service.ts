import { z } from "zod";
import { ATTRIBUTE_KEYS, ATTR_TOTAL, BASE_ATTRIBUTES, MAX_ATTR, NIL_MAX_BASE, ORIGINS, ROLES } from "@neon-dusk/shared";
import type { Character } from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import { NOMAD_MAX_NIL_BONUS } from "../game/abilities";
import { toPublicCharacter } from "../lib/transformers";
import { characterRepository as characters } from "../repositories/character-repository";

// Neon Dusk — Character service
// ============================================================================

export const createCharacterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(24, "Name must be at most 24 characters"),
  origin: z.enum(ORIGINS),
  role: z.enum(ROLES),
  // Creation floor is 3 (BASE_ATTRIBUTES): a stat can never drop below the
  // 5×3 base line during creation (§0.3 of 04-sistemas-e-progressao.md).
  attributes: z.object({
    body: z.number().int().min(BASE_ATTRIBUTES).max(MAX_ATTR),
    reflexes: z.number().int().min(BASE_ATTRIBUTES).max(MAX_ATTR),
    intelligence: z.number().int().min(BASE_ATTRIBUTES).max(MAX_ATTR),
    technical: z.number().int().min(BASE_ATTRIBUTES).max(MAX_ATTR),
    cool: z.number().int().min(BASE_ATTRIBUTES).max(MAX_ATTR),
  }),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;

/** Create the user's single character. One user ↔ one character per round. */
export async function createCharacter(
  userId: string,
  input: CreateCharacterInput,
): Promise<Character> {
  const attrs = input.attributes;
  const total = ATTRIBUTE_KEYS.reduce((sum, key) => sum + attrs[key], 0);
  if (total !== ATTR_TOTAL) {
    throw new AppError(
      400,
      "INVALID_ATTRIBUTES",
      `Total de atributos deve ser exatamente ${ATTR_TOTAL} (atualmente ${total})`,
    );
  }

  const existing = await characters.findByUserId(userId);
  if (existing) {
    throw new AppError(409, "CHARACTER_EXISTS", "Você já tem um personagem");
  }

  const nameTaken = await characters.findNameTaken(input.name.trim());
  if (nameTaken) {
    throw new AppError(409, "NAME_TAKEN", "Esse nome já está em uso");
  }

  // Unique violations on insert (the lower(name) index) map to NAME_TAKEN
  // inside the repository (pg-errors mapping).
  const row = await characters.insert({
    user_id: userId,
    name: input.name.trim(),
    origin: input.origin,
    role: input.role,
    body: attrs.body,
    reflexes: attrs.reflexes,
    intelligence: attrs.intelligence,
    technical: attrs.technical,
    cool: attrs.cool,
    // Feature #65: estradeiro gets +20% max NIL.
    max_nil: input.role === "estradeiro"
      ? Math.ceil(NIL_MAX_BASE * (1 + NOMAD_MAX_NIL_BONUS))
      : NIL_MAX_BASE,
  });
  return toPublicCharacter(row);
}
