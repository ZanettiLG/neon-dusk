import type { OsAbilitySlug, OsActivateResponse, OsStatus } from "@neon-dusk/shared";
import { OS_ABILITIES, getOsActiveBonus, type OsActiveBonus } from "../game/os-abilities";
import {
  canActivateOs,
  computeOsActiveUntil,
  computeOsUsesRemaining,
  isSameUtcDay,
  startOfUtcDay,
} from "../game/os-abilities";
import { AppError } from "../middleware/error-handler";
import { emitEvent } from "../telemetry/emit-event";
import { withTransaction } from "../db";
import type { Queryable } from "../repositories";
import { characterRepository as characters } from "../repositories/character-repository";
import { chromeRepository as chrome } from "../repositories/chrome-repository";
import type { CharacterRow } from "../repositories/character-repository";

// Neon Dusk — OS service (install state + daily-charge activation)
// ============================================================================
// The OS lives in the chrome_definitions catalog (ADR 1); `characters` keeps
// the activation state (os_ability_*). Activation is a daily-charge ability
// (ADR 2) with the UTC-midnight reset computed from os_ability_used_date.
// Flatlined characters cannot activate (flatline enforcement gate).

/** Build the public OsStatus readout from the character row + installed OS. */
async function buildOsStatus(characterId: string): Promise<OsStatus> {
  const character = await characters.findById(characterId);
  if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

  if (!character.os_ability_id) {
    return { installed: false, os: null, ability: null };
  }

  const slug = await chrome.findSlugById(character.os_ability_id);
  const cfg = slug ? OS_ABILITIES[slug as keyof typeof OS_ABILITIES] : undefined;

  if (!cfg) {
    // Installed definition is not an OS — defensive (definition removed).
    return { installed: false, os: null, ability: null };
  }

  const now = new Date();
  const activeUntil = character.os_ability_active_until;
  const isActive = !!activeUntil && activeUntil.getTime() > now.getTime();
  const usedDate = character.os_ability_used_date;
  const usedToday = isSameUtcDay(usedDate, now) ? Math.max(0, character.os_ability_uses_today) : 0;

  return {
    installed: true,
    os: { slug: cfg.slug, name: cfg.name },
    ability: {
      isActive,
      activeUntil: activeUntil ? activeUntil.toISOString() : null,
      usesRemaining: computeOsUsesRemaining(cfg, character.os_ability_uses_today, usedDate, now),
      usedToday,
      maxUsesPerDay: cfg.maxUsesPerDay,
      durationSeconds: Math.round(cfg.durationMs / 1000),
      inert: cfg.durationMs <= 0 || cfg.maxUsesPerDay <= 0,
      resetsAt: new Date(startOfUtcDay(now).getTime() + 86_400_000).toISOString(),
    },
  };
}

/**
 * Shared OS active-bonus resolution (issue #28 review, cycle 2): maps the
 * installed OS definition (os_ability_id) to its slug and applies the pure
 * window check from game/os-abilities. Used by the trampo and PvP services
 * so the slug lookup + active check live in exactly one place.
 *
 * @param character - A characters row (os_ability_id + os_ability_active_until).
 * @param q         - Queryable (transaction-scoped when called inside one).
 * @returns The active multipliers, or null when no OS is installed, the
 *          definition is unknown, the OS is inert or the window expired.
 */
export async function resolveOsActiveBonus(
  character: CharacterRow,
  q?: Queryable,
): Promise<OsActiveBonus | null> {
  if (!character.os_ability_id) return null;
  const slug = await chrome.findSlugById(character.os_ability_id, q);
  if (!slug) return null;

  return getOsActiveBonus(
    slug as OsAbilitySlug,
    character.os_ability_active_until ? new Date(character.os_ability_active_until) : null,
  );
}

/**
 * GET /api/os/status — installed OS + activation readout.
 */
export async function getOsStatus(characterId: string): Promise<OsStatus> {
  return buildOsStatus(characterId);
}

/**
 * POST /api/os/activate — start the installed OS's effect window.
 *
 * Gates (in order): flatline (403), no OS installed (400), inert OS (400),
 * window already running (400), daily charges exhausted (400). On success the
 * daily counter increments (resetting first when the UTC day changed) and an
 * OS_ACTIVATED telemetry event is emitted.
 */
export async function activateOs(characterId: string): Promise<OsActivateResponse> {
  return withTransaction(async (trx) => {
    const character = await characters.findByIdForUpdate(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

    if (character.is_flatlined) {
      throw new AppError(403, "FLATLINED", "Personagem apagado. Sem ações permitidas.");
    }

    if (!character.os_ability_id) {
      throw new AppError(400, "NO_OS_INSTALLED", "Nenhum SO instalado. Visite um ferrageiro.");
    }

    const slug = await chrome.findSlugById(character.os_ability_id, trx);
    const cfg = slug ? OS_ABILITIES[slug as keyof typeof OS_ABILITIES] : undefined;
    if (!cfg) {
      throw new AppError(400, "NO_OS_INSTALLED", "O cromo instalado não é um SO.");
    }

    const now = new Date();
    const { canActivate, reason } = canActivateOs(
      cfg,
      character.os_ability_active_until,
      character.os_ability_uses_today,
      character.os_ability_used_date,
      now,
    );
    if (!canActivate) {
      switch (reason) {
        case "inert":
          throw new AppError(400, "OS_INERT", "Este SO não tem habilidade ativa nesta rodada.");
        case "already_active":
          throw new AppError(400, "OS_ALREADY_ACTIVE", "O efeito do SO já está ativo.");
        default:
          throw new AppError(400, "OS_NO_USES_LEFT", "Sem ativações restantes hoje. Reset à meia-noite UTC.");
      }
    }

    const activeUntil = computeOsActiveUntil(cfg, now);
    const usedDate = isSameUtcDay(character.os_ability_used_date, now)
      ? character.os_ability_used_date
      : startOfUtcDay(now);
    const usesToday = isSameUtcDay(character.os_ability_used_date, now)
      ? character.os_ability_uses_today + 1
      : 1;

    await characters.updateOsActivation(
      characterId,
      { activeUntil, usesToday, usedDate },
      trx,
    );

    // Fire-and-forget telemetry — never blocks the hot path.
    void emitEvent({
      eventType: "OS_ACTIVATED",
      actorId: characterId,
      payload: { os: cfg.slug, durationSeconds: Math.round(cfg.durationMs / 1000) },
    }).catch(() => {
      // intentionally silent
    });

    return {
      success: true,
      activeUntil: activeUntil.toISOString(),
      usesRemaining: Math.max(0, cfg.maxUsesPerDay - usesToday),
      message: `${cfg.name} ativado.`,
    };
  });
}