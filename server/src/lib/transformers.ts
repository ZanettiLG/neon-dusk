import type { AbilityState, Character } from "@neon-dusk/shared";
import { ROLE_TO_ABILITY } from "@neon-dusk/shared";
import { isAbilityActive, cooldownRemainingMs } from "../game/abilities";

// Neon Dusk — DB row → API shape transformers
// ============================================================================

/** Database row shape for characters (subset used by transformers). */
interface DbCharacter {
  id: string;
  userId: string;
  name: string;
  origin: string;
  role: string;
  body: number;
  reflexes: number;
  intelligence: number;
  technical: number;
  cool: number;
  streetCred: number;
  maxStreetCredAchieved: number;
  abilityActiveUntil: Date | null;
  abilityCooldownUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Strip row internals — characters carry only public fields. */
export function toPublicCharacter(row: DbCharacter): Character {
  const abilityType = ROLE_TO_ABILITY[row.role as keyof typeof ROLE_TO_ABILITY];
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
    origin: row.origin as Character["origin"],
    role: row.role as Character["role"],
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
