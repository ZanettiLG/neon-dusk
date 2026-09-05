import type { ConsumablesResponse, ConsumableUseResponse } from "@neon-dusk/shared";
import {
  canUseConsumable,
  computeRestore,
  computeRestoreMultiplier,
  CONSUMABLE_WINDOW_MS,
  MAX_DAILY_USES,
} from "../game/consumables";
import { clampHumanity } from "../game/humanity";
import { AppError } from "../middleware/error-handler";
import { emitEvent } from "../telemetry/emit-event";
import { withTransaction } from "../db";
import { characterRepository as characters } from "../repositories/character-repository";
import { consumableRepository as consumables } from "../repositories/consumable-repository";

// Neon Dusk — Consumables service (itens anti-insanidade)
// ============================================================================
// GET /api/consumables: catalog + owned quantities + per-item cooldowns
// (mechanism still live in code, but all cooldown_hours are zeroed post-#187).
// POST /api/consumables/use: one atomic transaction — lock the character →
// validate inventory → gates (flatline/band/cooldown/diminishing) → restore
// humanity → decrement stock → usage log + HUMANITY_RESTORED telemetry.
//
// Diminishing returns are GLOBAL (ADR 28-B): all items share the counter of
// uses in the rolling 24h window (consumable_uses rows). Per-item cooldowns
// (ADR 28-D) come from the item's last use row — all zeroed post-#187
// (re-enabling requires a seed/migration). Inventory is per-round: the
// reset wipes character_consumables + consumable_uses.

/** One inventory row joined with the catalog (public shape). */

/**
 * GET /api/consumables — catalog with the player's stock and next
 * availability per item (T2/T3 cooldown derived from consumable_uses).
 */
export async function listConsumables(characterId: string): Promise<ConsumablesResponse> {
  const catalog = await consumables.listCatalog();
  const owned = await consumables.listOwned(characterId);

  const ownedByConsumable = new Map(owned.map((row) => [row.consumable_id, row]));

  // Per-item cooldown lookup batched in ONE query (issue #28 review, cycle 2 —
  // the previous per-item findLastUse loop was N+1).
  const cooldownItems = catalog.filter((c) => c.cooldown_hours > 0);
  const lastUses = await consumables.findLastUses(
    characterId,
    cooldownItems.map((c) => c.id),
  );

  const items = catalog.map((c) => {
    const own = ownedByConsumable.get(c.id);
    let nextAvailableAt: string | null = null;

    if (c.cooldown_hours > 0) {
      const lastUse = lastUses.get(c.id);
      if (lastUse) {
        const availableAt = new Date(
          lastUse.getTime() + c.cooldown_hours * 60 * 60 * 1000,
        );
        if (availableAt.getTime() > Date.now()) {
          nextAvailableAt = availableAt.toISOString();
        }
      }
    }

    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      tier: c.tier,
      restoreAmount: c.restore_amount,
      cooldownHours: c.cooldown_hours,
      ownedQuantity: own ? own.quantity : 0,
      nextAvailableAt,
    };
  });

  return { items };
}

/**
 * POST /api/consumables/use — consume one owned item to restore humanity.
 *
 * Error codes: 403 FLATLINED | 404 CONSUMABLE_NOT_FOUND |
 * 429 COOLDOWN_ACTIVE (details.nextAvailableAt) |
 * 400 NOT_OWNED / BAND_TOO_HIGH / DIMINISHING_RETURNS_EXHAUSTED.
 */
export async function useConsumable(
  characterId: string,
  consumableId: string,
): Promise<ConsumableUseResponse> {
  return withTransaction(async (trx) => {
    const character = await characters.findByIdForUpdate(characterId, trx);
    if (!character) throw new AppError(404, "NO_CHARACTER", "Personagem não encontrado");

    if (character.is_flatlined) {
      throw new AppError(403, "FLATLINED", "Personagem apagado. Sem ações permitidas.");
    }

    const item = await consumables.findById(consumableId, trx);
    if (!item || !item.is_active) {
      throw new AppError(404, "CONSUMABLE_NOT_FOUND", "Item não encontrado");
    }

    const owned = await consumables.getOwned(characterId, consumableId, trx);
    if (!owned || owned.quantity <= 0) {
      throw new AppError(400, "NOT_OWNED", "Você não tem este item no inventário.");
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - CONSUMABLE_WINDOW_MS);
    const usesInWindow = await consumables.countUsesInWindow(characterId, windowStart, trx);

    // Per-item cooldown (T2/T3; T1 has none).
    let itemCooldownUntil: Date | null = null;
    if (item.cooldown_hours > 0) {
      const lastUse = await consumables.findLastUse(characterId, consumableId, trx);
      if (lastUse) {
        const availableAt = new Date(lastUse.used_at.getTime() + item.cooldown_hours * 60 * 60 * 1000);
        if (availableAt.getTime() > now.getTime()) itemCooldownUntil = availableAt;
      }
    }

    const gate = canUseConsumable({
      humanity: character.humanity,
      isFlatlined: character.is_flatlined,
      usesInWindow,
      itemCooldownUntil,
      now,
    });
    if (!gate.allowed) {
      switch (gate.reason) {
        case "BAND_TOO_HIGH":
          throw new AppError(400, "BAND_TOO_HIGH", "Sua humanidade está alta demais para isso (máx. 70).");
        case "COOLDOWN_ACTIVE":
          // ND-053: 429 (not 400) — the cooldown convention shared by the
          // anti-cheat middleware, therapy and PvP. The unlock time rides in
          // details.nextAvailableAt (propagated by the error-handler).
          throw new AppError(429, "COOLDOWN_ACTIVE", "Este item ainda está em cooldown.", {
            nextAvailableAt: itemCooldownUntil?.toISOString() ?? null,
          });
        case "DIMINISHING_RETURNS_EXHAUSTED":
          throw new AppError(
            400,
            "DIMINISHING_RETURNS_EXHAUSTED",
            `Máximo de ${MAX_DAILY_USES} usos por 24h atingido.`,
          );
        default:
          throw new AppError(403, "FLATLINED", "Personagem apagado. Sem ações permitidas.");
      }
    }

    const multiplier = computeRestoreMultiplier(usesInWindow);
    const humanityBefore = character.humanity;
    const restored = computeRestore(item.restore_amount, multiplier, humanityBefore);
    const humanityAfter = clampHumanity(humanityBefore + restored);

    if (restored > 0) {
      await characters.updateHumanity(characterId, humanityAfter, trx);
    }

    const consumed = await consumables.decrementQuantity(characterId, consumableId, trx);
    if (!consumed) {
      // Concurrent use drained the stock between the check and the write.
      throw new AppError(400, "NOT_OWNED", "Você não tem este item no inventário.");
    }

    await consumables.insertUse(
      {
        character_id: characterId,
        consumable_id: consumableId,
        restored_amount: restored,
        multiplier,
      },
      trx,
    );

    // Fire-and-forget telemetry.
    void emitEvent({
      eventType: "HUMANITY_RESTORED",
      actorId: characterId,
      payload: {
        consumable: item.slug,
        restored,
        multiplier,
        usesInWindow: usesInWindow + 1,
      },
    }).catch(() => {
      // intentionally silent
    });

    // Next availability of THIS item (cooldownless items → null).
    let nextAvailableAt: string | null = null;
    if (item.cooldown_hours > 0) {
      const availableAt = new Date(now.getTime() + item.cooldown_hours * 60 * 60 * 1000);
      nextAvailableAt = availableAt.toISOString();
    }

    return {
      humanityBefore,
      humanityAfter,
      restored,
      costEddies: 0,
      nextAvailableAt,
    };
  });
}