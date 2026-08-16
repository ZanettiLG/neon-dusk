import type { AbilityState, Character } from "@neon-dusk/shared";
import { ROLE_TO_ABILITY } from "@neon-dusk/shared";
import { isAbilityActive, cooldownRemainingMs } from "../game/abilities";

// Neon Dusk — DB row → API shape transformers
// ============================================================================

/** Database row shape for characters (snake_case columns, subset used by transformers). */
interface DbCharacter {
  id: string;
  user_id: string;
  name: string;
  origin: string;
  role: string;
  body: number;
  reflexes: number;
  intelligence: number;
  technical: number;
  cool: number;
  street_cred: number;
  max_street_cred_achieved: number;
  ability_active_until: Date | null;
  ability_cooldown_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

/** Strip row internals — snake_case row → public camelCase Character. */
export function toPublicCharacter(row: DbCharacter): Character {
  const abilityType = ROLE_TO_ABILITY[row.role as keyof typeof ROLE_TO_ABILITY];
  const ability: AbilityState = {
    abilityType,
    isActive: isAbilityActive(row.ability_active_until),
    activeUntil: row.ability_active_until?.toISOString() ?? null,
    cooldownUntil: row.ability_cooldown_until?.toISOString() ?? null,
    cooldownRemainingMs: isAbilityActive(row.ability_active_until)
      ? 0
      : cooldownRemainingMs(row.ability_cooldown_until),
  };

  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    origin: row.origin as Character["origin"],
    role: row.role as Character["role"],
    body: row.body,
    reflexes: row.reflexes,
    intelligence: row.intelligence,
    technical: row.technical,
    cool: row.cool,
    streetCred: row.street_cred,
    maxStreetCredAchieved: row.max_street_cred_achieved,
    ability,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}
