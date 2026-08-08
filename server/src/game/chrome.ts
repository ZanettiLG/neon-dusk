import type { Attributes, ChromeBonuses, ChromeDefinition, ChromeSlot } from "@neon-dusk/shared";
import { SLOT_CAPACITY } from "@neon-dusk/shared";

// Neon Dusk — Chrome game logic (pure functions, no DB access)
// ============================================================================
// NOTE: this file is owned by the game-logic-dev agent; if a richer version
// exists in their handoff, prefer it. Types come from @neon-dusk/shared so the
// API contract and the game math never drift apart.
//
// Balance anchors (04-sistemas-e-progressao.md §3-4): T1 costs 2-5 humanity,
// T3 10-15, T5 20-30; humanity base is 100; 0 = flatline.

export type { ChromeBonuses, ChromeDefinition, ChromeSlot } from "@neon-dusk/shared";
export { SLOT_CAPACITY } from "@neon-dusk/shared";

const ATTR_KEYS: readonly (keyof Attributes)[] = [
  "body",
  "reflexes",
  "intelligence",
  "technical",
  "cool",
] as const;

/** Sum one bonus field across installed implants. */
function sumBonus(defs: ChromeDefinition[], key: keyof ChromeBonuses): number {
  return defs.reduce((total, def) => total + (def.bonuses[key] ?? 0), 0);
}

/**
 * Total attribute bonuses granted by the given implants, one key per
 * attribute. Bonuses are deltas (added on top of the character's base);
 * negatives are clamped to 0 since no implant debuffs exist yet.
 */
export function calculateStatBonus(defs: ChromeDefinition[]): Attributes {
  const bonus: Attributes = {
    body: 0,
    reflexes: 0,
    intelligence: 0,
    technical: 0,
    cool: 0,
  };
  for (const key of ATTR_KEYS) {
    bonus[key] = Math.max(0, sumBonus(defs, key));
  }
  return bonus;
}

/** Total +max_hp granted by the given implants. */
export function calculateHpBonus(defs: ChromeDefinition[]): number {
  return sumBonus(defs, "max_hp");
}

/** Total gig success rate bonus (percentage points) granted by the implants. */
export function calculateGigSuccessBonus(defs: ChromeDefinition[]): number {
  return sumBonus(defs, "gig_success_rate");
}

/** Total +NIL max granted by the given implants (frontal_cortex: +10/tier). */
export function calculateNilMaxBonus(defs: ChromeDefinition[]): number {
  return sumBonus(defs, "nil_max");
}

/** Total humanity drained by the given implants. */
export function calculateHumanityCost(defs: ChromeDefinition[]): number {
  return defs.reduce((total, def) => total + def.humanityCost, 0);
}

/** True when the slot still has room for one more implant. */
export function validateSlotAvailability(slot: ChromeSlot, installedInSlot: number): boolean {
  return installedInSlot < SLOT_CAPACITY[slot];
}

/**
 * True when installing an implant (cost) keeps humanity at or above 0.
 * Reaching exactly 0 is allowed here — flatline handling belongs to the
 * cyberpsychosis system.
 */
export function validateHumanityAfterInstall(currentHumanity: number, humanityCost: number): boolean {
  return currentHumanity - humanityCost >= 0;
}
