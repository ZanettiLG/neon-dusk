import type { FastifyInstance } from "fastify";
import type { AbilityState } from "@neon-dusk/shared";
import { ROLE_TO_ABILITY } from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import { authenticate } from "../middleware/auth";
import {
  canActivateAbility,
  computeActivation,
  cooldownRemainingMs,
  isAbilityActive,
} from "../game/abilities";
import { emitEvent } from "../telemetry/emit-event";
import { characterRepository as characters } from "../repositories/character-repository";

// Neon Dusk — Role Abilities routes (Feature #65)
// ============================================================================
// POST /api/abilities/activate — activate the character's role ability.
// GET  /api/abilities/status  — current ability state (active/cooldown/ready).

/** Build AbilityState from character timestamps. */
function buildAbilityState(
  role: string,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
): AbilityState {
  const abilityType = ROLE_TO_ABILITY[role as keyof typeof ROLE_TO_ABILITY];
  const active = isAbilityActive(activeUntil);
  return {
    abilityType,
    isActive: active,
    activeUntil: activeUntil?.toISOString() ?? null,
    cooldownUntil: cooldownUntil?.toISOString() ?? null,
    cooldownRemainingMs: active ? 0 : cooldownRemainingMs(cooldownUntil),
  };
}

export async function abilitiesRoutes(app: FastifyInstance) {
  // POST /api/abilities/activate — trigger the character's role ability.
  app.post(
    "/abilities/activate",
    { preHandler: [authenticate] },
    async (request): Promise<{
      success: boolean;
      abilityType: string;
      activeUntil: string;
      cooldownUntil: string;
      message: string;
    }> => {
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      const character = await characters.findById(characterId);
      if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      const role = character.role as "solo" | "netrunner" | "tech" | "fixer" | "nomad";

      // netrunner deep_dive is phase-2 — not implemented in MVP.
      if (role === "netrunner") {
        throw new AppError(503, "ABILITY_PHASE_2", "Deep Dive será implementado na Fase 2 (hacking)");
      }

      const { canActivate, reason } = canActivateAbility(
        role,
        character.ability_active_until,
        character.ability_cooldown_until,
      );
      if (!canActivate) {
        if (reason === "already_active") {
          throw new AppError(400, "ABILITY_ALREADY_ACTIVE", "Habilidade já está ativa");
        }
        throw new AppError(400, "ABILITY_COOLDOWN", "Habilidade ainda está em cooldown");
      }

      const activation = computeActivation(role);

      await characters.updateAbilityState(characterId, {
        activeUntil: activation.activeUntil,
        cooldownUntil: activation.cooldownUntil,
      });

      // Fire-and-forget telemetry.
      void emitEvent({
        eventType: "ABILITY_ACTIVATED",
        actorId: characterId,
        payload: { abilityType: activation.abilityType, role },
      }).catch(() => {});

      return {
        success: true,
        abilityType: activation.abilityType,
        activeUntil: activation.activeUntil.toISOString(),
        cooldownUntil: activation.cooldownUntil.toISOString(),
        message: "Habilidade ativada com sucesso",
      };
    },
  );

  // GET /api/abilities/status — current ability state.
  app.get(
    "/abilities/status",
    { preHandler: [authenticate] },
    async (request): Promise<AbilityState> => {
      const characterId = (await characters.requireByUserId(request.user.sub)).id;

      const character = await characters.findById(characterId);
      if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

      return buildAbilityState(
        character.role,
        character.ability_active_until,
        character.ability_cooldown_until,
      );
    },
  );
}
