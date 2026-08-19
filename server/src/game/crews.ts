import type { CrewBonus } from "@neon-dusk/shared";

// Neon Dusk — Crew game logic (pure functions, no DB access)
// ============================================================================
// Size-based crew bonuses (ND-016). The multipliers are consumed by gig
// resolution (success rate, payout, Moral) in a future feature; the
// math lives here so it is unit-testable and shared with the API surface.

/**
 * Crew bonuses unlocked by crew size. Every tier is cumulative: a crew of 4
 * unlocks all three bonuses. See 03-mecanicas-core.md §2 for the gig hooks.
 */
export function calculateCrewBonuses(memberCount: number): CrewBonus[] {
  const bonuses: CrewBonus[] = [];
  if (memberCount >= 2) {
    bonuses.push({ type: "gig_success", description: "+5% gig success rate", value: 5 });
  }
  if (memberCount >= 3) {
    bonuses.push({ type: "eddies", description: "+10% de Grana de trampos", value: 10 });
  }
  if (memberCount >= 4) {
    bonuses.push({ type: "street_cred", description: "+10% de Moral ganha", value: 10 });
  }
  return bonuses;
}
