import type { TherapyType } from "@neon-dusk/shared";

// Neon Dusk — Terapia game logic (pure functions, no DB access)
// ============================================================================
// Humanidade recovery (04-sistemas-e-progressao.md §4): clínicas restore
// 10-20 for G$ 5k-20k; sintonia restores 5-10 for G$ 2.5k-10k. Both share a
// single 24h cooldown derived from the last session's `completed_at` (no
// denormalized column — the cooldown is computed from therapy_sessions).

// ─── Constants ──────────────────────────────────────────────────────────────

/** Shared cooldown between both modalities, in milliseconds (24h). */
export const THERAPY_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/** Cost/restore ranges per modality (04-sistemas-e-progressao.md §4). */
export const THERAPY_OPTIONS: Record<
  TherapyType,
  { costMin: number; costMax: number; restoreMin: number; restoreMax: number }
> = {
  clinic: { costMin: 5000, costMax: 20000, restoreMin: 10, restoreMax: 20 },
  attunement: { costMin: 2500, costMax: 10000, restoreMin: 5, restoreMax: 10 },
};

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Check whether the character can undergo therapy (shared 24h cooldown).
 *
 * @param lastCompletedAt - Timestamp of the last session (null when never).
 * @param cooldownMs      - Cooldown window (defaults to THERAPY_COOLDOWN_MS).
 * @param now             - Reference time (injectable for tests).
 * @returns Whether therapy is available and when it becomes available.
 *
 * @edgecases Never done therapy → available. Last session in the future
 *            (clock skew) → not available. cooldownMs <= 0 → always available.
 */
export function canUndergoTherapy(
  lastCompletedAt: Date | null,
  cooldownMs: number = THERAPY_COOLDOWN_MS,
  now?: Date,
): { canUndergo: boolean; nextAvailableAt: Date | null } {
  const t = now ?? new Date();
  if (!lastCompletedAt || cooldownMs <= 0) {
    return { canUndergo: true, nextAvailableAt: null };
  }

  const availableAt = new Date(lastCompletedAt.getTime() + cooldownMs);
  if (t.getTime() >= availableAt.getTime()) {
    return { canUndergo: true, nextAvailableAt: null };
  }

  return { canUndergo: false, nextAvailableAt: availableAt };
}

/**
 * Roll a therapy session outcome: cost + humanity restored, uniform within
 * the modality's ranges.
 *
 * @param type - "clinic" (10-20pt, G$ 5k-20k) or "attunement" (5-10pt,
 *               G$ 2.5k-10k).
 * @param rng  - Injectable RNG returning [0, 1). Defaults to Math.random.
 * @returns The session cost and restored amount (restore is NOT capped here —
 *          the service caps it against the character's current humanity).
 *
 * @edgecases Unknown type → defensive no-op with the clinic ranges.
 */
export function computeTherapyOutcome(
  type: TherapyType,
  rng: () => number = Math.random,
): { cost: number; restored: number } {
  const opt = THERAPY_OPTIONS[type] ?? THERAPY_OPTIONS.clinic;

  const rollRange = (min: number, max: number): number =>
    Math.floor(rng() * (max - min + 1)) + min;

  return {
    cost: rollRange(opt.costMin, opt.costMax),
    restored: rollRange(opt.restoreMin, opt.restoreMax),
  };
}