import type { HumanityBand } from "@neon-dusk/shared";

// Neon Dusk — Humanidade / Cyberpsychosis game logic (pure functions)
// ============================================================================
// Bands follow 04-sistemas-e-progressao.md §4: 100-71 Íntegro, 70-41
// Instável, 40-21 Borderline, 20-1 Cyberpsycho, 0 Apagado (flatline).
// The Neural Scrubber regens +1/24h lazily (computed on read, never written
// by this module) with a hard cap of 50 — the "flag 2" interpretation
// approved by the product owner.

/** Scrubber regen ceiling — humanity never regens above this via the implant. */
export const SCRUBBER_REGEN_CAP = 50;

/** One full regen window, in milliseconds (24h). */
export const SCRUBBER_REGEN_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Humanity points restored per completed window. */
export const SCRUBBER_REGEN_RATE = 1;

/**
 * Map a humanity value to its cyberpsychosis band.
 *
 * @param humanity - Current humanity (0-100; values outside are clamped).
 * @returns The band identifier (API slug — PT labels live in the app).
 *
 * @edgecases Negative humanity → "apagado". Values above 70 → "integro".
 */
export function getHumanityBand(humanity: number): HumanityBand {
  if (humanity <= 0) return "apagado";
  if (humanity <= 20) return "cyberpsycho";
  if (humanity <= 40) return "borderline";
  if (humanity <= 70) return "instavel";
  return "integro";
}

/**
 * Clamp a humanity value to the valid [0, 100] range.
 *
 * @param value - Raw humanity (e.g. restore result or post-install value).
 * @returns Clamped integer in [0, 100].
 */
export function clampHumanity(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Apply the Neural Scrubber's lazy regen on read: +1 humanity per full 24h
 * window elapsed since the last humanity write, never above the cap (50).
 * Pure — the caller decides whether to persist (GET never writes).
 *
 * @param humanity      - Persisted humanity value.
 * @param lastUpdatedAt - Last humanity write timestamp (humanity_updated_at).
 * @param cap           - Regen ceiling (defaults to SCRUBBER_REGEN_CAP).
 * @param now           - Reference time (injectable for tests).
 * @returns Effective humanity with the regen applied, how much was applied
 *          and when the next +1 lands (null when at cap).
 *
 * @edgecases humanity >= cap → no regen, no next tick. lastUpdatedAt in the
 *            future → 0 elapsed windows. Null lastUpdatedAt → treated as now.
 */
export function applyScrubberRegen(
  humanity: number,
  lastUpdatedAt: Date | null,
  cap: number = SCRUBBER_REGEN_CAP,
  now?: Date,
): { humanity: number; regenApplied: number; nextRegenAt: Date | null } {
  const t = now ?? new Date();
  if (humanity >= cap) {
    return { humanity, regenApplied: 0, nextRegenAt: null };
  }

  const last = lastUpdatedAt ?? t;
  const elapsedMs = Math.max(0, t.getTime() - last.getTime());
  const windows = Math.floor(elapsedMs / SCRUBBER_REGEN_INTERVAL_MS);

  const regenApplied = Math.min(windows, cap - humanity);
  if (regenApplied <= 0) {
    // Window not complete yet — next tick is one window away.
    return {
      humanity,
      regenApplied: 0,
      nextRegenAt: new Date(last.getTime() + SCRUBBER_REGEN_INTERVAL_MS),
    };
  }

  const nextRegenAt =
    windows + 1 > cap - humanity
      ? null // cap reached before the next window completes
      : new Date(last.getTime() + (windows + 1) * SCRUBBER_REGEN_INTERVAL_MS);

  return { humanity: humanity + regenApplied, regenApplied, nextRegenAt };
}