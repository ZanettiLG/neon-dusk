import { describe, it, expect } from "vitest";
import { calculateCrewBonuses } from "../game/crews";
import type { CrewBonus } from "@neon-dusk/shared";

// ND-016 — crew game logic (pure functions). Size-based bonuses: every tier
// is cumulative — 2 members unlock gig_success, 3 add eddies, 4 add
// street_cred. The function never throws and returns what it can for any
// non-negative count (0 or 1 → none; > 4 → all three).

const GIG_SUCCESS: CrewBonus = {
  type: "gig_success",
  description: "+5% gig success rate",
  value: 5,
};
const EDDIES: CrewBonus = {
  type: "eddies",
  description: "+10% eddies from gigs",
  value: 10,
};
const STREET_CRED: CrewBonus = {
  type: "street_cred",
  description: "+10% Street Cred gained",
  value: 10,
};

describe("calculateCrewBonuses", () => {
  it("should return no bonuses for a solo member (memberCount 1)", () => {
    expect(calculateCrewBonuses(1)).toEqual([]);
  });

  it("should unlock gig_success at memberCount 2", () => {
    expect(calculateCrewBonuses(2)).toEqual([GIG_SUCCESS]);
  });

  it("should unlock gig_success and eddies at memberCount 3", () => {
    expect(calculateCrewBonuses(3)).toEqual([GIG_SUCCESS, EDDIES]);
  });

  it("should unlock all three bonuses at memberCount 4", () => {
    expect(calculateCrewBonuses(4)).toEqual([GIG_SUCCESS, EDDIES, STREET_CRED]);
  });

  it("should return no bonuses for memberCount 0 (edge case)", () => {
    expect(calculateCrewBonuses(0)).toEqual([]);
  });

  it("should return all three bonuses for memberCount 5 (max is 4, no upper clamp)", () => {
    // The function does not validate against CREW_MAX_SIZE — it returns every
    // tier the count satisfies. The 4-member cap is enforced elsewhere (DB
    // trigger + app checks), so 5+ still yields the full set.
    expect(calculateCrewBonuses(5)).toEqual([GIG_SUCCESS, EDDIES, STREET_CRED]);
  });
});
