// Neon Dusk — Lucky Chip minigame (ND-008)
// ============================================================================
// Pure game-logic functions: RNG, d20 roll, bet validation, bet resolution.
// Zero side effects. Zero DB/network imports. All functions are deterministic
// given their inputs (RNG being seedable ensures full reproducibility).
//
// House edge: 0% (fair 50/50). This is a test minigame, not real economy.
// Real gambling sinks will be added in Phase 2.
// ============================================================================

// ---------------------------------------------------------------------------
// RNG — Mulberry32
// ---------------------------------------------------------------------------

/** A seedable pseudo-random number generator producing floats in [0, 1). */
export interface Rng {
  /** Return the next random float in [0, 1). */
  next(): number;
}

/**
 * Mulberry32 PRNG. Fast, seedable, 32-bit state, period 2³².
 * Same seed always produces the same sequence — essential for determinism.
 *
 * Algorithm as specified in ND-008.
 *
 * @param seed — any integer; converted to int32 via `| 0`
 */
export function createRng(seed: number): Rng {
  let state = seed | 0;

  return {
    next() {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

// ---------------------------------------------------------------------------
// D20 Roll
// ---------------------------------------------------------------------------

/**
 * Roll a fair 20-sided die using the given RNG.
 * Each integer 1–20 has exactly 5% probability.
 *
 * @param rng — RNG instance (typically from {@link createRng})
 * @returns integer in [1, 20]
 */
export function rollD20(rng: Rng): number {
  return Math.floor(rng.next() * 20) + 1;
}

// ---------------------------------------------------------------------------
// Bet Validation
// ---------------------------------------------------------------------------

/** Discriminated union for bet validation outcomes. */
export type BetValidation =
  | { valid: true }
  | {
      valid: false;
      reason:
        | "bet_not_integer"
        | "bet_below_min"
        | "bet_exceeds_balance"
        | "bet_unsafe_integer";
    };

/** Minimum bet amount (1 eddie). */
const MIN_BET = 1;

/**
 * Validate a bet amount against the player's current balance.
 * Pure — does not access the database or any external state.
 *
 * Checks in order:
 * 1. Must be an integer
 * 2. Must be a safe integer (no overflow risk when multiplied)
 * 3. Must be >= {@link MIN_BET}
 * 4. Must be <= balance
 *
 * @param bet — the amount the player wants to wager
 * @param balance — the player's current eddie balance
 */
export function validateBet(bet: number, balance: number): BetValidation {
  if (!Number.isInteger(bet)) return { valid: false, reason: "bet_not_integer" };
  if (!Number.isSafeInteger(bet))
    return { valid: false, reason: "bet_unsafe_integer" };
  if (bet < MIN_BET) return { valid: false, reason: "bet_below_min" };
  if (bet > balance) return { valid: false, reason: "bet_exceeds_balance" };
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Bet Resolution
// ---------------------------------------------------------------------------

/** Outcome of a Lucky Chip bet. */
export interface LuckyChipResult {
  /** The d20 roll that decided the outcome (1–20). */
  roll: number;
  /** Whether the player won (roll >= 11) or lost (roll <= 10). */
  won: boolean;
  /** Eddie payout (2× bet on win, 0 on loss). */
  payout: number;
}

/** Threshold for winning: roll >= this value is a win. */
const WIN_THRESHOLD = 11;

/**
 * Resolve a Lucky Chip bet against a d20 roll.
 *
 * Formula (fair 50/50, 0% house edge):
 * - roll >= 11 → win: payout = bet × 2
 * - roll <= 10 → loss: payout = 0
 *
 * NOTE: The caller must ensure `bet` has passed {@link validateBet}
 * before calling this function. In particular, the `bet_unsafe_integer`
 * check in validateBet guarantees `bet * 2` cannot overflow
 * Number.MAX_SAFE_INTEGER.
 *
 * @param bet — validated bet amount (integer, >= 1, <= balance, safe)
 * @param roll — d20 roll result (1–20)
 */
export function resolveBet(bet: number, roll: number): LuckyChipResult {
  const won = roll >= WIN_THRESHOLD;
  const payout = won ? bet * 2 : 0;
  return { roll, won, payout };
}
