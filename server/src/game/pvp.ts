// Neon Dusk — PvP game logic (pure functions, no DB access)
// ============================================================================
// Conforme 04-sistemas-e-progressao.md §6: PvP sistema de combate, loot,
// Moral, proteções anti-grief. Todas as funções são puras, RNG
// injetável como último parâmetro para testabilidade.

import type { ChromeBonuses, Role } from "@neon-dusk/shared";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Input for combat power calculation. */
export interface CombatPowerInput {
  body: number;
  reflexes: number;
  chromePower: number;
  role: Role;
  /** Feature #65: true when the bicho's Combat Trance ability is active. */
  tranceActive?: boolean;
  rng?: () => number;
}

/** Two combatants facing off. */
export interface CombatInput {
  attacker: CombatPowerInput;
  defender: CombatPowerInput;
}

/** Result of a resolved combat. */
export interface CombatResult {
  winner: "attacker" | "defender";
  attackerPower: number;
  defenderPower: number;
}

/** SC change result. */
export interface SCChange {
  newSC: number;
  change: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max Moral. */
const SC_CAP = 100;

/** SC gained by winner per victory. */
const WINNER_SC_GAIN = 5;

/** Noob shield threshold: SC below this = reduced losses. */
const NOOB_SHIELD_THRESHOLD = 10;

/** SC loss rate for players with noob shield (< 10 SC): 1%. */
const NOOB_LOSS_RATE = 0.01;

/** SC loss rate for players without noob shield (>= 10 SC): 5%. */
const REGULAR_LOSS_RATE = 0.05;

/** Minimum SC loss per defeat. */
const MIN_SC_LOSS = 1;

/** Base loot: percentage of loser's balance. */
const LOOT_RATE = 0.1;

/** Griefer loot multiplier (10% of base = 1% of loser balance). */
const GRIEFER_LOOT_MULTIPLIER = 0.1;

/** Bicho combat power multiplier. */
const SOLO_MULTIPLIER = 1.1;

/** Bicho crit chance (0..1). */
const SOLO_CRIT_CHANCE = 0.05;

/** Bicho crit multiplier. */
const SOLO_CRIT_MULTIPLIER = 1.5;

/** Minimum random bonus in combat formula. */
const RANDOM_BONUS_MIN = 1;

/** Maximum random bonus in combat formula. */
const RANDOM_BONUS_MAX = 10;

/** Account immunity period in days. */
const IMMUNITY_DAYS = 7;

/** Max attacks on same target per week before grief penalty. */
const GRIEF_ATTACK_LIMIT = 3;

/** Máximo de derrotas por dia antes de limitar a perda de Moral/grana. */
const DEFEAT_CAP_LIMIT = 3;

const DAY_MS = 86_400_000;

// ─── Functions ──────────────────────────────────────────────────────────────

/**
 * Sum of `body` and `reflexes` bonuses from all installed cromo.
 *
 * @param installedBonuses - Array of installed cromo with their bonus objects.
 * @returns Total cromo combat power (integer).
 *
 * @edgecases Empty array → 0. Missing body/reflexes fields → treated as 0.
 */
export function calculateChromePower(
  installedBonuses: { bonuses: ChromeBonuses }[],
): number {
  let total = 0;
  for (const implant of installedBonuses) {
    total += implant.bonuses.body ?? 0;
    total += implant.bonuses.reflexes ?? 0;
  }
  return total;
}

/**
 * Calculate combat power: base = body + reflexes + chromePower + random(1..10).
 * Bicho role gets +10% and a 5% crit chance (+50% extra on top).
 *
 * @param input - Combat power parameters; rng is injectable for tests.
 * @returns Final combat power (integer).
 *
 * @edgecases All attributes zero → power = random(1..10) only. Bicho crit
 *            can trigger even at very low base values.
 */
export function calculateCombatPower(input: CombatPowerInput): number {
  const { body, reflexes, chromePower, role, tranceActive = false, rng = Math.random } = input;

  const randomBonus =
    Math.floor(rng() * (RANDOM_BONUS_MAX - RANDOM_BONUS_MIN + 1)) +
    RANDOM_BONUS_MIN;

  // Feature #65: Combat Trance boosts body + reflexes before the bicho multiplier.
  const effectiveBody = tranceActive && role === "bicho" ? Math.ceil(body * 1.25) : body;
  const effectiveReflexes = tranceActive && role === "bicho" ? Math.ceil(reflexes * 1.25) : reflexes;

  let base = effectiveBody + effectiveReflexes + chromePower + randomBonus;

  if (role === "bicho") {
    base = Math.ceil(base * SOLO_MULTIPLIER);
    if (rng() <= SOLO_CRIT_CHANCE) {
      base = Math.ceil(base * SOLO_CRIT_MULTIPLIER);
    }
  }

  return base;
}

/**
 * Resolve a combat between two players. Both powers are calculated
 * independently. Attacker wins on strictly higher power; ties go to defender.
 *
 * @param input - Attacker and defender CombatPowerInput.
 * @returns Winner, attacker power, and defender power.
 *
 * @edgecases Tie → defender wins. Both powers equal at 0 → defender wins.
 */
export function resolveCombat(input: CombatInput): CombatResult {
  const attackerPower = calculateCombatPower(input.attacker);
  const defenderPower = calculateCombatPower(input.defender);

  const winner =
    attackerPower > defenderPower ? "attacker" : "defender";

  return { winner, attackerPower, defenderPower };
}

/**
 * Espólio de um jogador derrotado: 10% do saldo, ou 1% com penalidade de
 * griefer. Nunca negativo.
 *
 * @param loserBalance   - Saldo em grana do jogador derrotado.
 * @param grieferPenalty - Se a penalidade de grief se aplica (≥3 ataques/semana).
 * @returns Valor do espólio em grana (inteiro, ≥ 0).
 *
 * @edgecases Saldo negativo → 0. Saldo zero → 0.
 */
export function calculateLoot(
  loserBalance: number,
  grieferPenalty: boolean,
): number {
  const effectiveBalance = Math.max(0, loserBalance);
  const base = Math.floor(effectiveBalance * LOOT_RATE);
  if (grieferPenalty) {
    return Math.floor(base * GRIEFER_LOOT_MULTIPLIER);
  }
  return base;
}

/**
 * Moral gain for winner: +5, capped at 100.
 *
 * @param winnerSC - Winner's current Moral.
 * @returns New SC and the actual change applied.
 *
 * @edgecases SC at 95 → newSC=100, change=+5. SC at 97 → newSC=100, change=+3.
 *            SC >= 100 → change=0.
 */
export function calculateWinnerSC(winnerSC: number): SCChange {
  const raw = winnerSC + WINNER_SC_GAIN;
  const newSC = Math.min(SC_CAP, raw);
  return { newSC, change: newSC - winnerSC };
}

/**
 * Moral loss for loser. If defeat-capped (≥3 losses today), no loss.
 * If under noob shield (<10 SC): 1% loss, minimum 1.
 * Otherwise: 5% loss, minimum 1. SC never goes below 0.
 *
 * @param currentSC   - Loser's current Moral.
 * @param lossesToday - Number of defeats already suffered today.
 * @returns New SC and the actual change (negative or zero).
 *
 * @edgecases SC=0 → newSC=0, change=0. lossesToday≥3 → no loss.
 *            Negative SC (defensive) → treated as 0 and clamped.
 */
export function calculateLoserSC(
  currentSC: number,
  lossesToday: number,
): SCChange {
  if (lossesToday >= DEFEAT_CAP_LIMIT) {
    return { newSC: currentSC, change: 0 };
  }

  const effectiveSC = Math.max(0, currentSC);

  if (effectiveSC === 0) {
    return { newSC: 0, change: 0 };
  }

  const rate =
    effectiveSC < NOOB_SHIELD_THRESHOLD ? NOOB_LOSS_RATE : REGULAR_LOSS_RATE;
  const loss = Math.max(MIN_SC_LOSS, Math.floor(effectiveSC * rate));
  const newSC = Math.max(0, effectiveSC - loss);

  return { newSC, change: -loss };
}

/**
 * Account created less than 7 days ago → immune to PvP attacks.
 *
 * @param createdAt - Account creation timestamp.
 * @param now       - Current time (injectable for tests).
 * @returns true if the account is within the immunity window.
 *
 * @edgecases Future `createdAt` (clock skew) → age negative → immune.
 */
export function isImmune(
  createdAt: Date | string,
  now?: Date | string,
): boolean {
  const created =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const current = now
    ? typeof now === "string"
      ? new Date(now)
      : now
    : new Date();
  const ageMs = current.getTime() - created.getTime();
  return ageMs < IMMUNITY_DAYS * DAY_MS;
}

/**
 * SC below 10 → noob shield active (reduced SC loss on defeat).
 *
 * @param streetCred - Current Moral score.
 * @returns true if the player qualifies for noob shield.
 */
export function hasNoobShield(streetCred: number): boolean {
  return streetCred < NOOB_SHIELD_THRESHOLD;
}

/**
 * Attacked the same target ≥3 times this week → grief penalty on loot.
 *
 * @param weeklyAttacksOnTarget - Number of attacks on this target this week.
 * @returns true if the grief penalty should apply.
 */
export function isGriefLimited(weeklyAttacksOnTarget: number): boolean {
  return weeklyAttacksOnTarget >= GRIEF_ATTACK_LIMIT;
}

/**
 * Sofreu ≥3 derrotas de PvP hoje → sem mais perda de Moral ou grana.
 *
 * @param lossesToday - Número de derrotas de PvP sofridas hoje.
 * @returns true se o teto de derrotas está ativo.
 */
export function isDefeatCapped(lossesToday: number): boolean {
  return lossesToday >= DEFEAT_CAP_LIMIT;
}
