import type { OsAbilitySlug } from "@neon-dusk/shared";

// Neon Dusk — OS abilities game logic (pure functions, no DB access)
// ============================================================================
// The OS (Operating System) slot defines the character's playstyle for the
// round (04-sistemas-e-progressao.md §3). Activation is a daily-charge
// ability — the same pattern as role abilities (daily-charge ADR):
//
//   SO Fúria  — 60s, 3x/day, +50% Body
//   SO Surto  — 30s, 5x/day, +50% Reflexes, +25% dodge
//   SO Gazuá  — inert (RAM is Fase 2, documented in the definition)
//
// The daily counter resets at UTC midnight (os_ability_used_date stores the
// UTC midnight of the last use day). All functions are pure and take an
// injectable `now` for testability.

// ─── Types ──────────────────────────────────────────────────────────────────

/** Static config of one OS ability. */
export interface OsAbilityConfig {
  slug: OsAbilitySlug;
  name: string;
  description: string;
  /** Active effect window (0 = inert, no activatable ability). */
  durationMs: number;
  /** Daily activation cap (0 = inert). */
  maxUsesPerDay: number;
  /** Multiplier applied to Body while active (Fúria). */
  bodyMultiplier?: number;
  /** Multiplier applied to Reflexes while active (Surto). */
  reflexesMultiplier?: number;
  /** Multiplier applied to escape/dodge rolls while active (Surto). */
  dodgeMultiplier?: number;
}

/** Active-effect multipliers of an OS, when its window is running. */
export interface OsActiveBonus {
  bodyMultiplier: number;
  reflexesMultiplier: number;
  dodgeMultiplier: number;
}

// ─── Catalog ────────────────────────────────────────────────────────────────

/** The three OS implants (slugs match chrome_definitions). */
export const OS_ABILITIES: Record<OsAbilitySlug, OsAbilityConfig> = {
  "os-gazuah": {
    slug: "os-gazuah",
    name: "SO Gazuá",
    description:
      "SO de hacking. Inerte nesta rodada: +40% RAM e quickhacks chegam na Fase 2.",
    durationMs: 0,
    maxUsesPerDay: 0,
  },
  "os-fury": {
    slug: "os-fury",
    name: "SO Fúria",
    description: "Combate: +50% Body por 60s. Ativável 3x/dia.",
    durationMs: 60 * 1000,
    maxUsesPerDay: 3,
    bodyMultiplier: 1.5,
  },
  "os-surge": {
    slug: "os-surge",
    name: "SO Surto",
    description: "Velocidade: +50% Reflexes e +25% esquiva por 30s. Ativável 5x/dia.",
    durationMs: 30 * 1000,
    maxUsesPerDay: 5,
    reflexesMultiplier: 1.5,
    dodgeMultiplier: 1.25,
  },
};

// ─── Daily reset helpers ────────────────────────────────────────────────────

/**
 * UTC midnight of the given day — the daily-charge reset boundary.
 *
 * @param now - Reference time (injectable, defaults to now).
 * @returns Date at 00:00:00.000 UTC of `now`'s day.
 */
export function startOfUtcDay(now?: Date): Date {
  const t = now ?? new Date();
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

/**
 * True when two dates fall on the same UTC calendar day.
 *
 * @edgecases Null dates → false (never equal). Cross-midnight edges follow UTC.
 */
export function isSameUtcDay(a: Date | null, b: Date): boolean {
  if (!a) return false;
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

// ─── Activation math ────────────────────────────────────────────────────────

/**
 * Activations left today, applying the UTC-midnight daily reset.
 *
 * @param cfg       - The installed OS config.
 * @param usesToday - Persisted uses counter (os_ability_uses_today).
 * @param usedDate  - UTC midnight of the last use day (null when never used).
 * @param now       - Reference time (injectable).
 * @returns Remaining activations (>= 0).
 *
 * @edgecases usedDate on a previous day → counter resets to the full cap.
 */
export function computeOsUsesRemaining(
  cfg: OsAbilityConfig,
  usesToday: number,
  usedDate: Date | null,
  now?: Date,
): number {
  const t = now ?? new Date();
  const effectiveUses = isSameUtcDay(usedDate, t) ? Math.max(0, usesToday) : 0;
  return Math.max(0, cfg.maxUsesPerDay - effectiveUses);
}

/**
 * When a new activation expires: now + the OS's effect window.
 *
 * @param cfg - The installed OS config.
 * @param now - Activation time (injectable).
 * @returns Expiry timestamp (now for inert OSes — never activated anyway).
 */
export function computeOsActiveUntil(cfg: OsAbilityConfig, now?: Date): Date {
  const t = now ?? new Date();
  return new Date(t.getTime() + cfg.durationMs);
}

/**
 * Check whether the OS can be activated right now.
 *
 * @param cfg        - The installed OS config.
 * @param activeUntil - Current activation expiry (null when inactive).
 * @param usesToday   - Persisted uses counter.
 * @param usedDate    - UTC midnight of the last use day.
 * @param now         - Reference time (injectable).
 * @returns Allowed or the blocking reason.
 *
 * @edgecases Inert OS (Gazuá) → never allowed. Active window running →
 *            already_active. Counter exhausted → no_uses_left.
 */
export function canActivateOs(
  cfg: OsAbilityConfig,
  activeUntil: Date | null,
  usesToday: number,
  usedDate: Date | null,
  now?: Date,
): { canActivate: boolean; reason?: "inert" | "already_active" | "no_uses_left" } {
  if (cfg.durationMs <= 0 || cfg.maxUsesPerDay <= 0) {
    return { canActivate: false, reason: "inert" };
  }

  const t = now ?? new Date();
  if (activeUntil && activeUntil.getTime() > t.getTime()) {
    return { canActivate: false, reason: "already_active" };
  }

  if (computeOsUsesRemaining(cfg, usesToday, usedDate, t) <= 0) {
    return { canActivate: false, reason: "no_uses_left" };
  }

  return { canActivate: true };
}

/**
 * Active-effect multipliers of an installed OS, or null when the window is
 * not running (or the slug is unknown/inert).
 *
 * @param slug        - Installed OS slug (null when none installed).
 * @param activeUntil - Activation expiry timestamp.
 * @param now         - Reference time (injectable).
 * @returns Multipliers (1.0 for unaffected stats) or null when inactive.
 *
 * @edgecases Unknown slug → null. Inert OS → null. Expired window → null.
 */
export function getOsActiveBonus(
  slug: OsAbilitySlug | null,
  activeUntil: Date | null,
  now?: Date,
): OsActiveBonus | null {
  if (!slug || !activeUntil) return null;
  const t = now ?? new Date();
  if (activeUntil.getTime() <= t.getTime()) return null;

  const cfg = OS_ABILITIES[slug];
  if (!cfg || cfg.durationMs <= 0) return null;

  return {
    bodyMultiplier: cfg.bodyMultiplier ?? 1,
    reflexesMultiplier: cfg.reflexesMultiplier ?? 1,
    dodgeMultiplier: cfg.dodgeMultiplier ?? 1,
  };
}