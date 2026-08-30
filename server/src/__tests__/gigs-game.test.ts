import { describe, it, expect } from "vitest";
import type { Attributes } from "@neon-dusk/shared";
import {
  applyHeatDecay,
  applyLegworkModifier,
  calculateEscapeChance,
  calculateHeat,
  calculatePayout,
  calculateStreetCred,
  calculateSuccessChance,
  canTransition,
  getEscapeStat,
  getRelevantStats,
  isCooldownExpired,
  meetsStatRequirements,
  rollGigOutcome,
  STAT_SCALING,
} from "../game/gigs";

// ND-011 — unit tests for the pure trampo game logic (no DB, no mocks).
// Formulas from 03-mecanicas-core.md §2-3: success capped at 0.95 / floored
// at 0.05, legwork +20%, success +10%, failure heat ×2, escape penalized by
// district heat (every 100 heat doubles the difficulty).

const FULL_ATTRS: Attributes = { body: 6, reflexes: 5, intelligence: 7, technical: 8, cool: 4 };

describe("getRelevantStats", () => {
  it("should map extraction to body (primary) and reflexes (secondary)", () => {
    expect(getRelevantStats("extraction", FULL_ATTRS)).toEqual({ primary: 6, secondary: 5 });
  });

  it("should map delivery to reflexes (primary) and cool (secondary)", () => {
    expect(getRelevantStats("delivery", FULL_ATTRS)).toEqual({ primary: 5, secondary: 4 });
  });

  it("should map sabotage to technical (primary) and intelligence (secondary)", () => {
    expect(getRelevantStats("sabotage", FULL_ATTRS)).toEqual({ primary: 8, secondary: 7 });
  });

  it("should return 0 for a missing attribute key instead of undefined", () => {
    const attrs = { ...FULL_ATTRS } as Partial<Attributes>;
    delete attrs.body;
    expect(getRelevantStats("extraction", attrs as Attributes)).toEqual({
      primary: 0,
      secondary: 5,
    });
  });
});

describe("meetsStatRequirements", () => {
  it("should return true when every requirement is met", () => {
    expect(meetsStatRequirements(FULL_ATTRS, { body: 5, cool: 3 })).toBe(true);
  });

  it("should return true when a requirement is met exactly", () => {
    expect(meetsStatRequirements(FULL_ATTRS, { body: 6 })).toBe(true);
  });

  it("should return false when a single requirement is not met", () => {
    expect(meetsStatRequirements(FULL_ATTRS, { body: 7 })).toBe(false);
  });

  it("should return false when any of several requirements is not met", () => {
    expect(meetsStatRequirements(FULL_ATTRS, { body: 5, cool: 5 })).toBe(false);
  });

  it("should return true for an empty requirement set", () => {
    expect(meetsStatRequirements(FULL_ATTRS, {})).toBe(true);
  });

  it("should treat negative requirements as 0 (always met)", () => {
    expect(meetsStatRequirements({ ...FULL_ATTRS, body: 0 }, { body: -3 })).toBe(true);
  });

  it("should treat missing attribute keys as 0", () => {
    const attrs = { ...FULL_ATTRS } as Partial<Attributes>;
    delete attrs.technical;
    expect(meetsStatRequirements(attrs as Attributes, { technical: 0 })).toBe(true);
    expect(meetsStatRequirements(attrs as Attributes, { technical: 1 })).toBe(false);
  });

  it("should return false when a required attribute is absent", () => {
    expect(meetsStatRequirements(FULL_ATTRS, { body: 6, agility: 1 })).toBe(false);
  });
});

describe("calculateSuccessChance", () => {
  it("should return 50% when stat × SCALING equals half the difficulty", () => {
    // stat=1, STAT_SCALING=5 → 5 / 10 = 0.50
    expect(calculateSuccessChance(1, 0, 10)).toBe(0.5);
  });

  it("should return exactly 0.05 when the raw ratio is exactly 0.05", () => {
    // stat=1 → 5 / 100 = 0.05
    expect(calculateSuccessChance(1, 0, 100)).toBe(0.05);
  });

  it("should return 95% when stat × SCALING matches the difficulty (cap at 0.95)", () => {
    // stat=10 → 50 / 50 = 1.0 → capped to 0.95
    expect(calculateSuccessChance(10, 0, 50)).toBe(0.95);
  });

  it("should add the cromo bonus to the scaled stat before dividing", () => {
    // stat=0, chromeBonus=5 → 5 / 10 = 0.50
    expect(calculateSuccessChance(0, 5, 10)).toBe(0.5);
  });

  it("should cap at 95% even with a large cromo bonus", () => {
    expect(calculateSuccessChance(5, 50, 10)).toBe(0.95);
  });

  it("should floor at 5% when the stat is far below the difficulty", () => {
    // stat=0 → 0 / 100 = 0 → floored 0.05
    expect(calculateSuccessChance(0, 0, 100)).toBe(0.05);
  });

  it("should floor at 5% when scaled stat + cromo is negative", () => {
    // stat=0, chromeBonus=-10 → -10 / 10 = -1 → floored 0.05
    expect(calculateSuccessChance(0, -10, 10)).toBe(0.05);
  });

  it("should return the raw ratio when it is inside the bounds", () => {
    // stat=2, STAT_SCALING=5 → 10 / 100 = 0.10
    expect(calculateSuccessChance(2, 0, 100)).toBe(0.1);
  });

  it("should return the cap (0.95) when difficulty is zero", () => {
    expect(calculateSuccessChance(5, 0, 0)).toBe(0.95);
  });

  it("should return the cap (0.95) when difficulty is negative", () => {
    expect(calculateSuccessChance(5, 0, -10)).toBe(0.95);
  });

  it("should include optional skillBonus in the numerator", () => {
    // stat=1 → 5, + skillBonus=5 → 10 / 10 = 1.0 → capped 0.95
    expect(calculateSuccessChance(1, 0, 10, 5)).toBe(0.95);
  });

  it("should treat missing skillBonus as 0", () => {
    // Same as: stat=1 → 5/10 = 0.5
    expect(calculateSuccessChance(1, 0, 10)).toBe(0.5);
  });
});

describe("applyLegworkModifier", () => {
  it("should apply -20% penalty when legwork is skipped (modo rápido)", () => {
    const base = 0.5;
    expect(applyLegworkModifier(base, { skippedLegwork: true, legworkDone: false })).toBe(0.4);
  });

  it("should apply +20% bonus when legwork was completed", () => {
    const base = 0.5;
    expect(applyLegworkModifier(base, { skippedLegwork: false, legworkDone: true })).toBe(0.6);
  });

  it("should return neutral chance when no legwork action taken", () => {
    const base = 0.5;
    expect(applyLegworkModifier(base, { skippedLegwork: false, legworkDone: false })).toBe(0.5);
  });

  it("should cap at 95% even with legwork bonus on high base chance", () => {
    expect(applyLegworkModifier(0.9, { skippedLegwork: false, legworkDone: true })).toBe(0.95);
  });

  it("should cap at 95% even with skip penalty (already capped by base calc)", () => {
    // 0.95 base → 0.95 × 0.8 = 0.76, not capped; cap only matters for bonus
    expect(applyLegworkModifier(0.95, { skippedLegwork: true, legworkDone: false })).toBe(0.76);
  });

  it("should apply penalty even to floored chances", () => {
    // Base floor is 0.05; skip penalty pushes it to 0.04 (fp-tolerant)
    expect(applyLegworkModifier(0.05, { skippedLegwork: true, legworkDone: false })).toBeCloseTo(
      0.04,
      4,
    );
  });

  it("should apply bonus even when base is below floor (already floored by caller)", () => {
    expect(applyLegworkModifier(0.1, { skippedLegwork: false, legworkDone: true })).toBe(0.12);
  });

  it("should let skipped win over done if both true (edge case, never happens)", () => {
    // Skipped vs done conflict — penalty takes precedence (safer).
    expect(applyLegworkModifier(0.5, { skippedLegwork: true, legworkDone: true })).toBe(0.4);
  });
});

describe("rollGigOutcome", () => {
  it("should succeed when the roll is below the chance", () => {
    const result = rollGigOutcome(0.5, () => 0.2);
    expect(result).toEqual({ success: true, roll: 0.2, successChance: 0.5 });
  });

  it("should fail when the roll is above the chance", () => {
    const result = rollGigOutcome(0.5, () => 0.8);
    expect(result).toEqual({ success: false, roll: 0.8, successChance: 0.5 });
  });

  it("should fail on a roll exactly equal to the chance (roll < chance)", () => {
    const result = rollGigOutcome(0.5, () => 0.5);
    expect(result.success).toBe(false);
  });

  it("should clamp a chance above 1 to 1 (always succeeds)", () => {
    const result = rollGigOutcome(2, () => 0.99);
    expect(result).toEqual({ success: true, roll: 0.99, successChance: 1 });
  });

  it("should clamp a chance below 0 to 0 (always fails)", () => {
    const result = rollGigOutcome(-1, () => 0.01);
    expect(result).toEqual({ success: false, roll: 0.01, successChance: 0 });
  });

  it("should use Math.random by default and stay within [0,1)", () => {
    const result = rollGigOutcome(0.5);
    expect(result.roll).toBeGreaterThanOrEqual(0);
    expect(result.roll).toBeLessThan(1);
    expect(typeof result.success).toBe("boolean");
    expect(result.successChance).toBe(0.5);
  });
});

describe("calculatePayout", () => {
  it("should return the base reward with no modifiers", () => {
    expect(calculatePayout(1000)).toBe(1000);
    expect(calculatePayout(1000, {})).toBe(1000);
  });

  it("should apply +20% for completed legwork", () => {
    expect(calculatePayout(1000, { legworkBonus: true })).toBe(1200);
  });

  it("should apply +10% for a successful trampo", () => {
    expect(calculatePayout(1000, { successBonus: true })).toBe(1100);
  });

  it("should apply both multipliers multiplicatively (1.2 × 1.1 = 1.32)", () => {
    expect(calculatePayout(1000, { legworkBonus: true, successBonus: true })).toBe(1320);
  });

  it("should round down fractional payouts", () => {
    expect(calculatePayout(333, { legworkBonus: true, successBonus: true })).toBe(439); // floor(333 × 1.32)
  });

  it("should return 0 when base reward is zero even with modifiers", () => {
    expect(calculatePayout(0, { legworkBonus: true, successBonus: true })).toBe(0);
  });

  it("should return 0 when base reward is negative (no negative payouts)", () => {
    expect(calculatePayout(-100, { successBonus: true })).toBe(0);
  });

  it("should ignore explicit false modifiers", () => {
    expect(calculatePayout(1000, { legworkBonus: false, successBonus: false })).toBe(1000);
  });

  // ND-052: GIG_BASE_REWARD floor — the global minimum payout base.
  it("should not bind the GIG_BASE_REWARD floor when the template pays more", () => {
    // Template base 800 > floor 100 → unchanged.
    expect(calculatePayout(800, { legworkBonus: true, successBonus: true }, 100)).toBe(1056);
  });

  it("should raise the base to the GIG_BASE_REWARD floor when the template pays less", () => {
    // Template base 50 < floor 100 → effective base 100 (100 × 1.32 = 132).
    expect(calculatePayout(50, { legworkBonus: true, successBonus: true }, 100)).toBe(132);
  });

  it("should keep zero-reward trampos at zero even with a GIG_BASE_REWARD floor", () => {
    expect(calculatePayout(0, { legworkBonus: true, successBonus: true }, 100)).toBe(0);
    expect(calculatePayout(-50, { successBonus: true }, 100)).toBe(0);
  });
});

describe("calculateHeat", () => {
  it("should return the base heat on success", () => {
    expect(calculateHeat(15, "success")).toBe(15);
  });

  it("should double the heat on failure", () => {
    expect(calculateHeat(15, "failure")).toBe(30);
  });

  it("should floor fractional heat", () => {
    expect(calculateHeat(15.9, "failure")).toBe(31);
  });

  it("should return 0 when base heat is zero regardless of outcome", () => {
    expect(calculateHeat(0, "success")).toBe(0);
    expect(calculateHeat(0, "failure")).toBe(0);
  });

  it("should return 0 when base heat is negative", () => {
    expect(calculateHeat(-5, "failure")).toBe(0);
  });
});

describe("calculateEscapeChance", () => {
  it("should return 50% when scaled stat equals half the escape difficulty", () => {
    // stat=1, STAT_SCALING=5 → 5 / (10 * 1) = 0.50
    expect(calculateEscapeChance(1, 10, 0)).toBe(0.5);
  });

  it("should have no heat penalty when heat is zero", () => {
    // stat=1 → 5 / 10 = 0.5
    expect(calculateEscapeChance(1, 10, 0)).toBe(0.5);
  });

  it("should halve the chance at 100 heat (difficulty ×2)", () => {
    // stat=1 → 5 / (10 × 2) = 5/20 = 0.25
    expect(calculateEscapeChance(1, 10, 100)).toBeCloseTo(0.25, 5);
  });

  it("should triple the difficulty at 200 heat", () => {
    // stat=1 → 5 / (10 × 3) = 5/30 = 0.16667
    expect(calculateEscapeChance(1, 10, 200)).toBeCloseTo(0.16667, 4);
  });

  it("should ignore negative heat (no penalty)", () => {
    // stat=1 → 5 / 10 = 0.5
    expect(calculateEscapeChance(1, 10, -50)).toBe(0.5);
  });

  it("should cap at 95% when stat exceeds the difficulty", () => {
    // stat=10 → 50 / 10 = 5.0 → capped 0.95
    expect(calculateEscapeChance(10, 10, 0)).toBe(0.95);
  });

  it("should floor at 5% when stat is zero", () => {
    // stat=0 → 0 / 10 = 0 → floored 0.05
    expect(calculateEscapeChance(0, 10, 0)).toBe(0.05);
  });

  it("should return the cap (0.95) when escape difficulty is zero", () => {
    expect(calculateEscapeChance(5, 0, 100)).toBe(0.95);
  });

  it("should return the cap (0.95) when escape difficulty is negative", () => {
    expect(calculateEscapeChance(5, -10, 100)).toBe(0.95);
  });
});

describe("calculateStreetCred", () => {
  it("should grant 1-3 SC for T1 trampos (inclusive range)", () => {
    expect(calculateStreetCred("t1", () => 0)).toBe(1);
    expect(calculateStreetCred("t1", () => 0.5)).toBe(2);
    expect(calculateStreetCred("t1", () => 0.9999)).toBe(3);
  });

  it("should grant 3-8 SC for T2 trampos (inclusive range)", () => {
    expect(calculateStreetCred("t2", () => 0)).toBe(3);
    expect(calculateStreetCred("t2", () => 0.2)).toBe(4);
    expect(calculateStreetCred("t2", () => 0.9999)).toBe(8);
  });

  it("should never exceed the tier max with an injected RNG", () => {
    for (const tier of ["t1", "t2"] as const) {
      const [min, max] = tier === "t1" ? [1, 3] : [3, 8];
      for (let i = 0; i < 100; i++) {
        const gained = calculateStreetCred(tier, Math.random);
        expect(gained).toBeGreaterThanOrEqual(min);
        expect(gained).toBeLessThanOrEqual(max);
      }
    }
  });

  it("should grant 8-15 SC for T3 trampos (fuzz)", () => {
    for (let i = 0; i < 50; i++) {
      const sc = calculateStreetCred("t3", Math.random);
      expect(sc).toBeGreaterThanOrEqual(8);
      expect(sc).toBeLessThanOrEqual(15);
    }
  });

  it("should grant 15-25 SC for T4 trampos (fuzz)", () => {
    for (let i = 0; i < 50; i++) {
      const sc = calculateStreetCred("t4", Math.random);
      expect(sc).toBeGreaterThanOrEqual(15);
      expect(sc).toBeLessThanOrEqual(25);
    }
  });

  it("should grant 25-40 SC for T5 trampos (fuzz)", () => {
    for (let i = 0; i < 50; i++) {
      const sc = calculateStreetCred("t5", Math.random);
      expect(sc).toBeGreaterThanOrEqual(25);
      expect(sc).toBeLessThanOrEqual(40);
    }
  });
});

describe("isCooldownExpired", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const MIN = 60_000;

  it("should return true when there is no prior completion", () => {
    expect(isCooldownExpired(null, 10, now)).toBe(true);
  });

  it("should return true when the cooldown has fully elapsed", () => {
    const last = new Date(now.getTime() - 11 * MIN);
    expect(isCooldownExpired(last, 10, now)).toBe(true);
  });

  it("should return false while the cooldown is still running", () => {
    const last = new Date(now.getTime() - 5 * MIN);
    expect(isCooldownExpired(last, 10, now)).toBe(false);
  });

  it("should return true exactly at the cooldown boundary (elapsed >= cooldown)", () => {
    const last = new Date(now.getTime() - 10 * MIN);
    expect(isCooldownExpired(last, 10, now)).toBe(true);
  });

  it("should return true for a zero cooldown", () => {
    expect(isCooldownExpired(new Date(now.getTime() - MIN), 0, now)).toBe(true);
  });

  it("should return true for a negative cooldown", () => {
    expect(isCooldownExpired(new Date(now.getTime() - MIN), -5, now)).toBe(true);
  });

  it("should return false when the last completion is in the future", () => {
    expect(isCooldownExpired(new Date(now.getTime() + 30 * MIN), 10, now)).toBe(false);
  });
});

describe("canTransition", () => {
  it("should allow meet → legwork via start_legwork", () => {
    expect(canTransition("meet", "start_legwork")).toBe("legwork");
  });

  it("should allow meet → execute via skip_to_execute", () => {
    expect(canTransition("meet", "skip_to_execute")).toBe("execute");
  });

  it("should allow legwork → execute via execute", () => {
    expect(canTransition("legwork", "execute")).toBe("execute");
  });

  it("should allow execute → escape via escape", () => {
    expect(canTransition("execute", "escape")).toBe("escape");
  });

  it("should allow escape → wrap_up via wrap_up", () => {
    expect(canTransition("escape", "wrap_up")).toBe("wrap_up");
  });

  it("should reject an action not valid from the current phase", () => {
    expect(canTransition("meet", "execute")).toBeNull();
    expect(canTransition("legwork", "start_legwork")).toBeNull();
    expect(canTransition("execute", "wrap_up")).toBeNull();
    expect(canTransition("escape", "escape")).toBeNull();
  });

  it("should reject every action from the terminal wrap_up phase", () => {
    expect(canTransition("wrap_up", "start_legwork")).toBeNull();
    expect(canTransition("wrap_up", "execute")).toBeNull();
    expect(canTransition("wrap_up", "wrap_up")).toBeNull();
  });

  it("should return null for unknown phases and actions", () => {
    expect(canTransition("meet", "unknown_action")).toBeNull();
    expect(canTransition("unknown_phase", "execute")).toBeNull();
    expect(canTransition("", "")).toBeNull();
  });
});

describe("getEscapeStat", () => {
  it("should map extraction to reflexes", () => {
    expect(getEscapeStat("extraction", FULL_ATTRS)).toBe(5);
  });

  it("should map delivery to reflexes", () => {
    expect(getEscapeStat("delivery", FULL_ATTRS)).toBe(5);
  });

  it("should map sabotage to cool", () => {
    expect(getEscapeStat("sabotage", FULL_ATTRS)).toBe(4);
  });

  it("should return 0 for a missing attribute key", () => {
    const attrs = { ...FULL_ATTRS } as Partial<Attributes>;
    delete attrs.cool;
    expect(getEscapeStat("sabotage", attrs as Attributes)).toBe(0);
  });
});

describe("STAT_SCALING", () => {
  it("should be 5 as per ND-011 balance fix", () => {
    expect(STAT_SCALING).toBe(5);
  });
});

describe("applyHeatDecay", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");
  const DAY = 86_400_000;

  it("should decay 5 heat per full day", () => {
    const last = new Date(now.getTime() - 2 * DAY);
    expect(applyHeatDecay(50, last, now)).toEqual({ heat: 40, decayed: 10 });
  });

  it("should not decay partial days", () => {
    const last = new Date(now.getTime() - 23 * 3_600_000); // 23 hours
    expect(applyHeatDecay(50, last, now)).toEqual({ heat: 50, decayed: 0 });
  });

  it("should not go below zero", () => {
    const last = new Date(now.getTime() - 5 * DAY);
    expect(applyHeatDecay(10, last, now)).toEqual({ heat: 0, decayed: 10 });
  });

  it("should return zero heat when input is zero", () => {
    expect(applyHeatDecay(0, now, now)).toEqual({ heat: 0, decayed: 0 });
  });

  it("should return zero heat when input is negative", () => {
    expect(applyHeatDecay(-10, now, now)).toEqual({ heat: 0, decayed: 0 });
  });

  it("should treat lastUpdatedAt in the future as 0 days elapsed", () => {
    const future = new Date(now.getTime() + DAY);
    expect(applyHeatDecay(50, future, now)).toEqual({ heat: 50, decayed: 0 });
  });

  it("should use Date.now as the default third parameter", () => {
    const result = applyHeatDecay(10, new Date());
    expect(result.heat).toBeGreaterThanOrEqual(0);
    expect(result.heat).toBeLessThanOrEqual(10);
    expect(result.decayed).toBeGreaterThanOrEqual(0);
    expect(result.decayed).toBeLessThanOrEqual(10);
  });
});
