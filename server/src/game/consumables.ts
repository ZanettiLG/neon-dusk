// Neon Dusk — Itens anti-insanidade game logic (pure functions, no DB access)
// ============================================================================
// Consumables restore humanity with GLOBAL diminishing returns across a
// rolling 24h window (ADR 28-B — all items share the counter):
//   1st use 100%, 2nd 60%, 3rd 30%, 4th+ blocked.
// Gates (design delta): humanity > 70 → BAND_TOO_HIGH; flatlined → FLATLINED;
// Cyberpsycho (1-20) WORKS — the safety net where the danger is highest
// (ADR 28-A). Per-item cooldowns (T2 12h, T3 24h, T1 none) are derived from
// consumable_uses (ADR 28-D).

import type { Consumable } from "@neon-dusk/shared";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Restore multipliers per use index in the rolling 24h window. */
export const CONSUMABLE_MULTIPLIERS = [1.0, 0.6, 0.3] as const;

/** Hard ceiling: 3 uses per 24h (4th+ blocked). */
export const MAX_DAILY_USES = 3;

/** Humanity above this band (Íntegro) cannot use sanity items. */
export const BAND_CAP = 70;

/** Rolling window for the global use counter, in milliseconds (24h). */
export const CONSUMABLE_WINDOW_MS = 24 * 60 * 60 * 1000;

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Restore multiplier for the next use, based on uses already spent in the
 * rolling 24h window: [1.0, 0.6, 0.3] then 0 (blocked).
 *
 * @param usesInWindow - Uses in the last 24h (all items combined).
 * @returns The multiplier (0 when the window is exhausted).
 *
 * @edgecases usesInWindow <= 0 → 1.0. usesInWindow >= 3 → 0.
 */
export function computeRestoreMultiplier(usesInWindow: number): number {
  if (usesInWindow <= 0) return CONSUMABLE_MULTIPLIERS[0];
  if (usesInWindow >= CONSUMABLE_MULTIPLIERS.length) return 0;
  return CONSUMABLE_MULTIPLIERS[usesInWindow];
}

/**
 * Humanity actually restored by one use: round(base × multiplier), capped so
 * humanity never exceeds 100.
 *
 * @param baseAmount     - The item's restore_amount.
 * @param multiplier     - Diminishing-returns multiplier (see above).
 * @param currentHumanity - Humanity before the use.
 * @returns Points restored (0 when humanity is already at 100).
 *
 * @edgecases multiplier 0 → 0. Negative currentHumanity (defensive) → cap
 *            allows the full restore. Fractional products → Math.round.
 */
export function computeRestore(
  baseAmount: number,
  multiplier: number,
  currentHumanity: number,
): number {
  const raw = Math.round(baseAmount * multiplier);
  const headroom = Math.max(0, 100 - currentHumanity);
  return Math.min(raw, headroom);
}

/**
 * Gate the use of a sanity item. Pure — the service maps the reason to the
 * documented HTTP error codes.
 *
 * @param input - Current character + item state.
 * @returns Allowed, or the blocking reason.
 *
 * @edgecases Flatlined → always blocked (even in Cyberpsycho). Humanity above
 *            BAND_CAP → blocked. Item cooldown running → blocked. Window
 *            exhausted (3 uses) → blocked.
 */
export function canUseConsumable(input: {
  humanity: number;
  isFlatlined: boolean;
  /** Uses in the rolling 24h window (all items). */
  usesInWindow: number;
  /** Cooldown end of THIS item (null when ready or cooldownless). */
  itemCooldownUntil: Date | null;
  now?: Date;
}): { allowed: boolean; reason?: "FLATLINED" | "BAND_TOO_HIGH" | "COOLDOWN_ACTIVE" | "DIMINISHING_RETURNS_EXHAUSTED" } {
  if (input.isFlatlined) return { allowed: false, reason: "FLATLINED" };
  if (input.humanity > BAND_CAP) return { allowed: false, reason: "BAND_TOO_HIGH" };

  if (input.itemCooldownUntil) {
    const t = input.now ?? new Date();
    if (input.itemCooldownUntil.getTime() > t.getTime()) {
      return { allowed: false, reason: "COOLDOWN_ACTIVE" };
    }
  }

  if (computeRestoreMultiplier(input.usesInWindow) <= 0) {
    return { allowed: false, reason: "DIMINISHING_RETURNS_EXHAUSTED" };
  }

  return { allowed: true };
}

/**
 * Validate the catalog entry shape — used by the seed integrity tests and
 * defensive guards (a malformed row must never reach the restore math).
 *
 * @param item - A consumables catalog row.
 * @returns True when the entry is usable by the game logic.
 */
export function isValidConsumable(item: Consumable): boolean {
  return (
    item.restoreAmount > 0 &&
    item.cooldownHours >= 0 &&
    item.tier >= 1 &&
    item.tier <= 3
  );
}