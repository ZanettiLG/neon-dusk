import type { AbilityState, Character } from "@neon-dusk/shared";
import { ROLE_TO_ABILITY } from "@neon-dusk/shared";
import type { characters } from "../db/schema";
import { isAbilityActive, cooldownRemainingMs } from "../game/abilities";

// Neon Dusk — DB row → API shape transformers
// ============================================================================

/** Strip row internals — characters carry only public fields. */
export function toPublicCharacter(row: typeof characters.$inferSelect): Character {
  const abilityType = ROLE_TO_ABILITY[row.role];
  const ability: AbilityState = {
    abilityType,
    isActive: isAbilityActive(row.abilityActiveUntil),
    activeUntil: row.abilityActiveUntil?.toISOString() ?? null,
    cooldownUntil: row.abilityCooldownUntil?.toISOString() ?? null,
    cooldownRemainingMs: isAbilityActive(row.abilityActiveUntil)
      ? 0
      : cooldownRemainingMs(row.abilityCooldownUntil),
  };

  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    origin: row.origin,
    role: row.role,
    body: row.body,
    reflexes: row.reflexes,
    intelligence: row.intelligence,
    technical: row.technical,
    cool: row.cool,
    streetCred: row.streetCred,
    maxStreetCredAchieved: row.maxStreetCredAchieved,
    ability,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
