// Neon Dusk — Role abilities game logic (pure functions, no DB access)
// ============================================================================
// Conforme 04-sistemas-e-progressao.md: 5 role abilities with state-machine
// lifecycle. All functions are pure, taking `now?: Date` for testability.
// No randomness — abilities are deterministic event triggers.
//
// State machine:
//   READY (both null) ──► activate() ──► ACTIVE (active_until set)
//   ACTIVE ──► duration expires (Combat Trance) or action consumed ──► COOLDOWN
//   COOLDOWN ──► cooldown expires ──► READY
//
// One-shot abilities stay ACTIVE until computeConsumption() is called;
// duration-based (Combat Trance) auto-transitions to COOLDOWN on expiry.

import type { AbilityType, Role } from "@neon-dusk/shared";
import { ROLE_TO_ABILITY } from "@neon-dusk/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

/** The three states in the ability state machine. */
export type AbilityStateKind = "ready" | "active" | "cooldown";

/** Result of resolveAbilityState. */
export interface AbilityState {
  state: AbilityStateKind;
  activeUntil: Date | null;
  cooldownUntil: Date | null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Cooldown durations in milliseconds, per ability. */
export const ABILITY_COOLDOWNS: Record<AbilityType, number> = {
  combat_trance: 24 * 60 * 1000,   // 24 minutes
  deep_dive: 48 * 60 * 1000,       // 48 minutes
  overclock: 120 * 60 * 1000,      // 2 hours
  silver_tongue: 60 * 60 * 1000,   // 1 hour
  long_haul: 30 * 60 * 1000,       // 30 minutes
};

/**
 * Active effect durations in milliseconds.
 * 0 = one-shot (consumed on use; activeUntil is a flag, not a timer).
 * > 0 = duration-based (effect runs for this long, then auto-transitions).
 */
export const ABILITY_DURATIONS: Record<AbilityType, number> = {
  combat_trance: 30_000,  // 30 seconds
  deep_dive: 0,                   // one-shot (framework-only in MVP)
  overclock: 0,                   // one-shot: consumed on next chrome purchase
  silver_tongue: 0,               // one-shot: consumed on next gig completion
  long_haul: 0,                   // one-shot: consumed when second gig starts
};

/** Passive bonuses — always active, independent of ability state. */
export const NOMAD_MAX_NIL_BONUS = 0.2;    // +20% max NIL
export const FIXER_DISCOUNT = 0.15;         // 15% vendor discount
export const TECH_EXTRA_SLOTS = 1;          // +1 chrome slot

// ─── Helpers ────────────────────────────────────────────────────────────────

/** True when the ability has a non-zero active duration (Combat Trance). */
function isDurationBased(ability: AbilityType): boolean {
  return ABILITY_DURATIONS[ability] > 0;
}

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Resolve the current ability state, auto-transitioning expired timestamps.
 *
 * Priority-ordered rules:
 *  1. cooldownUntil in the past → ready (both null)
 *  2. activeUntil is set and in the future → active (as-is)
 *  3. activeUntil is set and in the past:
 *     a. Duration-based (Combat Trance): auto-transition to cooldown
 *        (cooldownUntil = activeUntil + cooldown, activeUntil = null)
 *     b. One-shot: leave active (consumed explicitly via computeConsumption)
 *  4. cooldownUntil in the future → cooldown
 *  5. Both null → ready
 *
 * @param role          - Character's role.
 * @param activeUntil   - Timestamp when the active effect ends/has ended.
 * @param cooldownUntil - Timestamp when the cooldown ends.
 * @param now           - Reference time (injectable for tests, defaults to now).
 * @returns The resolved state with timestamps mutated to reflect transitions.
 *
 * @edgecases Null timestamps → treated as "not set". Unknown role → ready.
 *           Timestamps exactly equal to now → treated as expired (ready).
 *           activeUntil far in past → auto-transition works; resulting cooldown
 *           also expired → next call resolves to ready.
 */
export function resolveAbilityState(
  role: Role,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
  now?: Date,
): AbilityState {
  const t = now ?? new Date();
  const ability = ROLE_TO_ABILITY[role];
  if (!ability) return { state: "ready", activeUntil: null, cooldownUntil: null };

  // 1. Cooldown expired → ready
  if (cooldownUntil && cooldownUntil.getTime() < t.getTime()) {
    return { state: "ready", activeUntil: null, cooldownUntil: null };
  }

  // 2-3. Active timestamp exists
  if (activeUntil) {
    if (activeUntil.getTime() > t.getTime()) {
      return { state: "active", activeUntil, cooldownUntil };
    }

    // Expired duration-based → auto-transition to cooldown
    if (isDurationBased(ability)) {
      const cooldown = ABILITY_COOLDOWNS[ability];
      return {
        state: "cooldown",
        activeUntil: null,
        cooldownUntil: new Date(activeUntil.getTime() + cooldown),
      };
    }

    // One-shot, expired → stays active (explicit consumption required)
    return { state: "active", activeUntil, cooldownUntil };
  }

  // 4. Cooldown in progress (step 1 already ruled out expired, so it's future)
  if (cooldownUntil) {
    return { state: "cooldown", activeUntil: null, cooldownUntil };
  }

  // 5. Both null → ready
  return { state: "ready", activeUntil: null, cooldownUntil: null };
}

/**
 * Check whether a character can activate their role ability.
 *
 * Uses resolveAbilityState internally to handle timestamp expiry.
 * Deep Dive (netrunner) is gated behind phase2 regardless of state —
 * it is a framework-only ability during MVP.
 *
 * @param role          - Character's role.
 * @param activeUntil   - Current active effect timestamp.
 * @param cooldownUntil - Current cooldown timestamp.
 * @param now           - Reference time (injectable).
 * @returns Activation check result.
 *
 * @edgecases Unknown role → { canActivate: false, reason: "phase2" } (defensive).
 *           Netrunner always returns "phase2" regardless of timestamps.
 */
export function canActivateAbility(
  role: Role,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
  now?: Date,
): { canActivate: boolean; reason?: "cooldown" | "already_active" | "phase2" } {
  if (role === "netrunner") {
    return { canActivate: false, reason: "phase2" };
  }

  const { state } = resolveAbilityState(role, activeUntil, cooldownUntil, now);

  switch (state) {
    case "ready":
      return { canActivate: true };
    case "active":
      return { canActivate: false, reason: "already_active" };
    case "cooldown":
      return { canActivate: false, reason: "cooldown" };
    // ponytail: exhaustive switch — default covers defensive unknown state
    default:
      return { canActivate: false, reason: "phase2" };
  }
}

/**
 * Compute the new timestamps when activating a role ability.
 *
 * Duration-based (Combat Trance):
 *   activeUntil   = now + 30 minutes  (effect runs for this duration)
 *   cooldownUntil = activeUntil + 4h  (cooldown starts after effect ends)
 *
 * One-shot (all others):
 *   activeUntil   = now               (flag: ability is pending consumption)
 *   cooldownUntil = now + cooldown    (cooldown starts immediately)
 *
 * @param role - Character's role.
 * @param now  - Activation time (injectable).
 * @returns New activeUntil and cooldownUntil timestamps.
 *
 * @edgecases Unknown role → returns timestamps equal to now (defensive no-op).
 */
export function computeActivation(
  role: Role,
  now?: Date,
): { abilityType: AbilityType; activeUntil: Date; cooldownUntil: Date } {
  const t = now ?? new Date();
  const ability = ROLE_TO_ABILITY[role];

  if (!ability) {
    return { abilityType: "combat_trance", activeUntil: t, cooldownUntil: t };
  }

  const cooldown = ABILITY_COOLDOWNS[ability];

  if (isDurationBased(ability)) {
    const duration = ABILITY_DURATIONS[ability];
    const activeUntil = new Date(t.getTime() + duration);
    const cooldownUntil = new Date(activeUntil.getTime() + cooldown);
    return { abilityType: ability, activeUntil, cooldownUntil };
  }

  // One-shot
  return {
    abilityType: ability,
    activeUntil: t,
    cooldownUntil: new Date(t.getTime() + cooldown),
  };
}

/**
 * Compute timestamps when an ability is consumed (one-shot abilities only).
 *
 * Sets activeUntil to null, cooldownUntil to now + cooldown duration.
 * Called when the game event that "consumes" the ability fires:
 *   - Overclock: consumed on chrome purchase
 *   - Silver Tongue: consumed on gig completion
 *   - Long Haul: consumed when the second gig starts
 *   - Deep Dive: consumed when a netrunner action is taken (phase2)
 *
 * Combat Trance is duration-based — its consumption is automatic on expiry.
 *
 * @param role - Character's role.
 * @param now  - Consumption time (injectable).
 * @returns New timestamps with activeUntil = null.
 *
 * @edgecases Unknown role → returns cooldownUntil = now (defensive no-op).
 */
export function computeConsumption(
  role: Role,
  now?: Date,
): { activeUntil: null; cooldownUntil: Date } {
  const t = now ?? new Date();
  const ability = ROLE_TO_ABILITY[role];

  if (!ability) {
    return { activeUntil: null, cooldownUntil: t };
  }

  const cooldown = ABILITY_COOLDOWNS[ability];
  return {
    activeUntil: null,
    cooldownUntil: new Date(t.getTime() + cooldown),
  };
}

/**
 * Returns Combat Trance bonuses when the solo's ability is currently active.
 *
 * @param role          - Character's role.
 * @param activeUntil   - Current active effect timestamp.
 * @param cooldownUntil - Current cooldown timestamp.
 * @param now           - Reference time (injectable).
 * @returns Multipliers for body and reflexes, or null if not active.
 *
 * @edgecases Non-solo role → null. Expired trance (auto-transitioned) → null.
 */
export function getCombatTranceBonus(
  role: Role,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
  now?: Date,
): { bodyMultiplier: number; reflexesMultiplier: number } | null {
  if (role !== "solo") return null;

  const { state } = resolveAbilityState(role, activeUntil, cooldownUntil, now);
  if (state !== "active") return null;

  return { bodyMultiplier: 1.25, reflexesMultiplier: 1.25 };
}

/**
 * Returns Overclock bonuses when the tech's ability is currently active.
 *
 * Overclock halves the eddie cost and zeroes the humanity cost of the
 * next chrome purchase (consumed on use).
 *
 * @param role          - Character's role.
 * @param activeUntil   - Current active effect timestamp.
 * @param cooldownUntil - Current cooldown timestamp.
 * @param now           - Reference time (injectable).
 * @returns Cost modifiers, or null if not active.
 *
 * @edgecases Non-tech role → null. Already consumed (not active) → null.
 */
export function getOverclockBonus(
  role: Role,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
  now?: Date,
): { costMultiplier: number; humanityCost: number } | null {
  if (role !== "tech") return null;

  const { state } = resolveAbilityState(role, activeUntil, cooldownUntil, now);
  if (state !== "active") return null;

  return { costMultiplier: 0.5, humanityCost: 0 };
}

/**
 * Returns Silver Tongue bonuses when the fixer's ability is currently active.
 *
 * Silver Tongue boosts the next gig's eddie payout by +50% and street cred
 * by +25% (consumed on gig completion).
 *
 * @param role          - Character's role.
 * @param activeUntil   - Current active effect timestamp.
 * @param cooldownUntil - Current cooldown timestamp.
 * @param now           - Reference time (injectable).
 * @returns Eddie and SC multipliers, or null if not active.
 *
 * @edgecases Non-fixer role → null. Already consumed (not active) → null.
 */
export function getSilverTongueBonus(
  role: Role,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
  now?: Date,
): { eddieMultiplier: number; scMultiplier: number } | null {
  if (role !== "fixer") return null;

  const { state } = resolveAbilityState(role, activeUntil, cooldownUntil, now);
  if (state !== "active") return null;

  return { eddieMultiplier: 1.5, scMultiplier: 1.25 };
}

/**
 * Check whether a nomad can accept a second active gig (Long Haul).
 *
 * Nomads can have 2 active gigs instead of 1 when Long Haul is active.
 * The ability is consumed when the second gig starts (caller must call
 * computeConsumption afterwards).
 *
 * @param role               - Character's role.
 * @param activeUntil         - Current active effect timestamp.
 * @param cooldownUntil       - Current cooldown timestamp.
 * @param currentActiveGigs   - How many gigs the character already has active.
 * @param now                 - Reference time (injectable).
 * @returns True when the nomad can run a second gig.
 *
 * @edgecases Non-nomad role → false. Long Haul not active → false.
 *           Already at 2 gigs → false (cap). 0 active gigs → false (no second
 *           without a first — callers must check normal gig capacity separately).
 */
export function canRunSecondGig(
  role: Role,
  activeUntil: Date | null,
  cooldownUntil: Date | null,
  currentActiveGigs: number,
  now?: Date,
): boolean {
  if (role !== "nomad") return false;
  if (currentActiveGigs >= 2) return false;

  const { state } = resolveAbilityState(role, activeUntil, cooldownUntil, now);
  return state === "active";
}

// ─── Status Helpers ─────────────────────────────────────────────────────────

/**
 * Check whether an ability is currently active based on its activeUntil
 * timestamp (future == active). No state-machine resolution needed —
 * this is a simple timestamp check used for display/API purposes.
 *
 * @edgecases null → false. Timestamp in past → false.
 */
export function isAbilityActive(activeUntil: Date | null, now?: Date): boolean {
  if (!activeUntil) return false;
  return activeUntil.getTime() >= (now ?? new Date()).getTime();
}

/**
 * Remaining cooldown milliseconds. 0 if cooldownUntil is null or in the past.
 *
 * @edgecases null → 0. Past timestamp → 0.
 */
export function cooldownRemainingMs(
  cooldownUntil: Date | null,
  now?: Date,
): number {
  if (!cooldownUntil) return 0;
  const remaining = cooldownUntil.getTime() - (now ?? new Date()).getTime();
  return Math.max(0, remaining);
}
