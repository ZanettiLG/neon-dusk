import type { Attributes } from "@neon-dusk/shared";

// Neon Dusk — Gigs game logic (pure functions, no DB access)
// ============================================================================
// Formulas from 03-mecanicas-core.md §2 and 04-sistemas-e-progressao.md §5.
// All probability calculations cap at 0.95 / floor at 0.05.
// RNG always injectable as the last parameter for testability.

// ─── Types ──────────────────────────────────────────────────────────────────

/** Available gig archetypes (MVP: T1-T2 only). */
export type GigType = "extraction" | "delivery" | "sabotage";

/** Gig tier (MVP: T1-T2). */
export type GigTier = "t1" | "t2";

/** Result of a gig success roll. */
export interface GigOutcome {
  success: boolean;
  /** The raw RNG roll [0, 1). */
  roll: number;
  /** The probability threshold that was checked against. */
  successChance: number;
}

/** Multiplicative payout modifiers from gig phases. */
export interface PayoutModifiers {
  /** Legwork completed (+20% payout). */
  legworkBonus?: boolean;
  /** Gig succeeded (+10% payout). */
  successBonus?: boolean;
}

/** Phases in the 5-phase gig loop (§2 of 03-mecanicas-core.md). */
export const GIG_PHASES = ["meet", "legwork", "execute", "escape", "wrap_up"] as const;
export type GigPhase = (typeof GIG_PHASES)[number];

/** Maps a phase → valid next phases via an action. */
const TRANSITIONS: Record<string, Record<string, string>> = {
  meet:     { start_legwork: "legwork", skip_to_execute: "execute" },
  legwork:  { execute: "execute" },
  execute:  { escape: "escape" },
  escape:   { wrap_up: "wrap_up" },
  wrap_up:  {},
};

// ─── Constants ──────────────────────────────────────────────────────────────

const SUCCESS_CAP = 0.95;
const SUCCESS_FLOOR = 0.05;
const LEGWORK_MULTIPLIER = 1.2;
const SUCCESS_MULTIPLIER = 1.1;
const HEAT_FAILURE_MULTIPLIER = 2;
const HEAT_DIVISOR = 100;
const DAILY_GIG_LIMIT = 10;

// ─── Stat Mapping ───────────────────────────────────────────────────────────

/**
 * Primary → secondary stat pair per gig type.
 * Conforme 03-mecanicas-core.md §2 (Tipos de Gig).
 */
const GIG_STATS: Record<GigType, readonly [keyof Attributes, keyof Attributes]> = {
  extraction: ["body", "reflexes"],
  delivery:   ["reflexes", "cool"],
  sabotage:   ["technical", "intelligence"],
};

/**
 * Stat used for the escape phase per gig type.
 * Extraction/delivery rely on quick reflexes; sabotage on staying cool.
 */
const ESCAPE_STATS: Record<GigType, keyof Attributes> = {
  extraction: "reflexes",
  delivery:   "reflexes",
  sabotage:    "cool",
};

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Map gig type to the two stats used for success calculation.
 *
 * @param gigType  - The gig archetype.
 * @param attrs    - The character's current attribute set.
 * @returns `{primary, secondary}` — primary is used for the roll;
 *          secondary is reserved for future tie-breaking and legwork bonuses.
 *
 * @edgecases If the mapped attribute key doesn't exist on the attributes object
 *            (should never happen with valid Attributes), returns 0 for that key.
 */
export function getRelevantStats(
  gigType: GigType,
  attrs: Attributes,
): { primary: number; secondary: number } {
  const [pk, sk] = GIG_STATS[gigType];
  return { primary: attrs[pk] ?? 0, secondary: attrs[sk] ?? 0 };
}

/**
 * Check if character attributes satisfy the gig's requiredStats.
 *
 * `requiredStats` is a sparse object like `{ body: 5, reflexes: 3 }`.
 * Missing keys are treated as a 0 requirement (always met).
 *
 * @param attrs         - The character's current attributes.
 * @param requiredStats - Sparse record of attribute → minimum value.
 * @returns `true` if every specified requirement is met or exceeded.
 *
 * @edgecases Passes when `requiredStats` is empty or undefined keys are null/omitted.
 *            Negative requirements are treated as 0 (always met).
 */
export function meetsStatRequirements(
  attrs: Attributes,
  requiredStats: Record<string, number>,
): boolean {
  for (const key of Object.keys(requiredStats)) {
    const required = Math.max(0, requiredStats[key]);
    // ponytail: cast through unknown because requiredStats keys are runtime strings
    const actual = (attrs as unknown as Record<string, number>)[key] ?? 0;
    if (actual < required) return false;
  }
  return true;
}

/**
 * Calculate gig execution success probability.
 *
 * Formula: `(stat + chromeBonus) / difficulty`, clamped to [0.05, 0.95].
 * Conforme 03-mecanicas-core.md §3 (Fórmula de sucesso).
 *
 * @param stat        - The relevant primary attribute value.
 * @param chromeBonus - Flat success bonus from installed chrome (percentage points).
 * @param difficulty  - The gig's difficulty rating.
 * @returns Probability in range [0.05, 0.95].
 *
 * @edgecases `difficulty ≤ 0` would cause division by zero → capped at 0.95.
 *            Negative `stat + chromeBonus` → floored at 0.05.
 */
export function calculateSuccessChance(
  stat: number,
  chromeBonus: number,
  difficulty: number,
): number {
  if (difficulty <= 0) return SUCCESS_CAP;
  const raw = (stat + chromeBonus) / difficulty;
  return Math.min(SUCCESS_CAP, Math.max(SUCCESS_FLOOR, raw));
}

/**
 * Roll for gig execute/escape outcome.
 *
 * Compares the RNG roll against the success chance.
 *
 * @param successChance - Probability of success [0, 1].
 * @param rng           - Injectable RNG returning [0, 1). Defaults to `Math.random`.
 * @returns `GigOutcome` with the roll value, chance, and boolean result.
 *
 * @edgecases Values outside [0, 1] are clamped before comparison.
 */
export function rollGigOutcome(
  successChance: number,
  rng: () => number = Math.random,
): GigOutcome {
  const clamped = Math.min(1, Math.max(0, successChance));
  const roll = rng();
  return { success: roll < clamped, roll, successChance: clamped };
}

/**
 * Calculate final eddie payout with modifiers applied multiplicatively.
 *
 * Formula: `baseReward × legwork(1.2) × success(1.1)`, rounded down.
 *
 * @param baseReward - Base eddie reward for the gig.
 * @param modifiers  - Optional phase modifiers (legwork completed, gig succeeded).
 * @returns Integer eddies (via `Math.floor`).
 *
 * @edgecases `baseReward < 0` returns 0 (no negative payouts).
 *            Missing modifier properties default to no multiplier (1.0).
 */
export function calculatePayout(
  baseReward: number,
  modifiers?: PayoutModifiers,
): number {
  if (baseReward <= 0) return 0;
  let multiplier = 1.0;
  if (modifiers?.legworkBonus) multiplier *= LEGWORK_MULTIPLIER;
  if (modifiers?.successBonus) multiplier *= SUCCESS_MULTIPLIER;
  return Math.floor(baseReward * multiplier);
}

/**
 * Calculate heat generated from a gig outcome.
 *
 * Success: `baseHeat`. Failure: `baseHeat × 2` (getting caught generates more heat).
 *
 * @param baseHeat - Base heat value of the gig.
 * @param outcome  - "success" or "failure".
 * @returns Total heat generated (integer, floored).
 *
 * @edgecases `baseHeat ≤ 0` returns 0 regardless of outcome.
 */
export function calculateHeat(baseHeat: number, outcome: "success" | "failure"): number {
  if (baseHeat <= 0) return 0;
  return outcome === "failure"
    ? Math.floor(baseHeat * HEAT_FAILURE_MULTIPLIER)
    : Math.floor(baseHeat);
}

/**
 * Calculate escape success chance with district heat penalty.
 *
 * Formula: `stat / (escapeDifficulty × heatMultiplier)`, clamped to [0.05, 0.95].
 * `heatMultiplier = 1 + (heatAmount / 100)`, so every 100 heat doubles the difficulty.
 *
 * @param stat             - The relevant escape attribute value.
 * @param escapeDifficulty - The gig's escape difficulty.
 * @param heatAmount       - Current heat in the district.
 * @returns Probability in range [0.05, 0.95].
 *
 * @edgecases `escapeDifficulty ≤ 0` → capped at 0.95.
 *            `heatAmount ≤ 0` → multiplier is 1.0 (no penalty).
 *            `stat ≤ 0` → floored at 0.05.
 */
export function calculateEscapeChance(
  stat: number,
  escapeDifficulty: number,
  heatAmount: number,
): number {
  if (escapeDifficulty <= 0) return SUCCESS_CAP;
  const heatMultiplier = 1 + Math.max(0, heatAmount) / HEAT_DIVISOR;
  const raw = stat / (escapeDifficulty * heatMultiplier);
  return Math.min(SUCCESS_CAP, Math.max(SUCCESS_FLOOR, raw));
}

/**
 * Roll street cred gain within tier range.
 *
 * Conforme 04-sistemas-e-progressao.md §5 (Como Ganhar).
 * T1: 1–3 SC. T2: 3–8 SC (as designed for ND-011 MVP).
 *
 * @param tier - Gig tier ("t1" or "t2").
 * @param rng  - Injectable RNG. Defaults to `Math.random`.
 * @returns Street cred points gained.
 *
 * @edgecases Uses uniform distribution within the tier range (inclusive).
 */
export function calculateStreetCred(
  tier: GigTier,
  rng: () => number = Math.random,
): number {
  const [min, max] = tier === "t1" ? [1, 3] : [3, 8];
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Check if enough time has passed since the last gig of the same type.
 *
 * @param lastCompletedAt  - Timestamp of the last same-type gig, or null if never done.
 * @param cooldownMinutes  - Cooldown period in minutes.
 * @param now              - Current time. Defaults to `new Date()`.
 * @returns `true` if the cooldown has expired (including when there's no prior gig).
 *
 * @edgecases `lastCompletedAt` is null → returns true (no prior gig).
 *            `cooldownMinutes ≤ 0` → always returns true.
 *            `lastCompletedAt` in the future → returns false.
 */
export function isCooldownExpired(
  lastCompletedAt: Date | null,
  cooldownMinutes: number,
  now: Date = new Date(),
): boolean {
  if (lastCompletedAt === null) return true;
  if (cooldownMinutes <= 0) return true;
  const elapsedMs = now.getTime() - lastCompletedAt.getTime();
  return elapsedMs >= cooldownMinutes * 60_000;
}

/**
 * Check daily gig limit.
 *
 * @param todayCount - Number of gigs completed today (midnight-to-midnight).
 * @returns `true` when under the daily cap (max 10 per calendar day).
 *
 * @edgecases `todayCount < 0` returns true (defensive).
 */
export function isUnderDailyLimit(todayCount: number): boolean {
  return todayCount < DAILY_GIG_LIMIT;
}

/**
 * Phase state machine: determine if a transition is valid.
 *
 * Valid transitions (conforme 03-mecanicas-core.md §2, loop de 5 fases):
 * - meet → legwork (start_legwork)
 * - meet → execute (skip_to_execute — skip legwork with penalty)
 * - legwork → execute (execute)
 * - execute → escape (escape)
 * - escape → wrap_up (wrap_up)
 *
 * @param currentPhase - The current phase.
 * @param action       - The action the player wants to take.
 * @returns The next phase name, or `null` if the transition is invalid.
 *
 * @edgecases Unknown phase or action returns null.
 *            `wrap_up` has no valid transitions (terminal), returns null.
 */
export function canTransition(currentPhase: string, action: string): string | null {
  return TRANSITIONS[currentPhase]?.[action] ?? null;
}

/**
 * Determine the relevant stat value for escape based on gig type.
 *
 * @param gigType - The gig archetype.
 * @param attrs   - The character's current attributes.
 * @returns The attribute value used for escape rolls.
 *
 * @edgecases If the attribute key doesn't exist on attrs, returns 0.
 */
export function getEscapeStat(gigType: GigType, attrs: Attributes): number {
  const key = ESCAPE_STATS[gigType];
  return (attrs as unknown as Record<string, number>)[key] ?? 0;
}
