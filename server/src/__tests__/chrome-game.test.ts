import { describe, it, expect } from "vitest";
import type { ChromeDefinition } from "@neon-dusk/shared";
import {
  calculateGigSuccessBonus,
  calculateHpBonus,
  calculateHumanityCost,
  calculateNilMaxBonus,
  calculateStatBonus,
  validateHumanityAfterInstall,
  validateSlotAvailability,
} from "../game/chrome";

// Feature #4 — unit tests for the pure cromo game logic (no DB, no mocks).
// Follows 04-sistemas-e-progressao.md §3-4 balance anchors: humanity drains,
// slot capacities from SLOT_CAPACITY, stat bonuses are deltas on top of base.

const ZERO_BONUS = { body: 0, reflexes: 0, intelligence: 0, technical: 0, cool: 0 };

/** Build a minimal ChromeDefinition, overriding only what the test needs. */
function def(overrides: Partial<ChromeDefinition> = {}): ChromeDefinition {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    slug: "test-cromo",
    name: "Cromo de Teste",
    slot: "frontal_cortex",
    tier: 1,
    bonuses: {},
    humanityCost: 3,
    basePrice: 100,
    description: null,
    ...overrides,
  };
}

describe("calculateStatBonus", () => {
  it("should return all-zero bonuses for an empty loadout", () => {
    expect(calculateStatBonus([])).toEqual(ZERO_BONUS);
  });

  it("should return the single bonus of one implant", () => {
    const result = calculateStatBonus([def({ bonuses: { intelligence: 2 } })]);
    expect(result).toEqual({ ...ZERO_BONUS, intelligence: 2 });
  });

  it("should sum bonuses across multiple implants", () => {
    const result = calculateStatBonus([
      def({ bonuses: { intelligence: 2 } }),
      def({ bonuses: { reflexes: 2 } }),
    ]);
    expect(result).toEqual({ ...ZERO_BONUS, intelligence: 2, reflexes: 2 });
  });

  it("should map an implant with a body bonus (Braço de Ferro) to the body key", () => {
    const result = calculateStatBonus([def({ bonuses: { body: 3 } })]);
    expect(result).toEqual({ ...ZERO_BONUS, body: 3 });
  });

  it("should return all zeros when an implant only grants non-stat bonuses", () => {
    const result = calculateStatBonus([def({ bonuses: { max_hp: 10 } })]);
    expect(result).toEqual(ZERO_BONUS);
  });

  it("should treat undefined bonus fields as 0 (no NaN leaking)", () => {
    const result = calculateStatBonus([def({ bonuses: { intelligence: undefined } })]);
    expect(result).toEqual(ZERO_BONUS);
    expect(Object.values(result).every((v) => Number.isFinite(v))).toBe(true);
  });

  it("should clamp negative bonuses to 0 (no implant debuffs exist yet)", () => {
    const result = calculateStatBonus([def({ bonuses: { body: -2, cool: 1 } })]);
    expect(result).toEqual({ ...ZERO_BONUS, cool: 1 });
  });
});

describe("calculateHpBonus", () => {
  it("should return 0 for an empty loadout", () => {
    expect(calculateHpBonus([])).toBe(0);
  });

  it("should return the max_hp bonus of a single implant (Casca Grossa)", () => {
    expect(calculateHpBonus([def({ bonuses: { max_hp: 10 } })])).toBe(10);
  });

  it("should sum max_hp bonuses across implants", () => {
    const result = calculateHpBonus([
      def({ bonuses: { max_hp: 10 } }),
      def({ bonuses: { max_hp: 15 } }),
    ]);
    expect(result).toBe(25);
  });

  it("should return 0 for implants without a max_hp bonus", () => {
    expect(calculateHpBonus([def({ bonuses: { intelligence: 1 } })])).toBe(0);
  });
});

describe("calculateGigSuccessBonus", () => {
  it("should return 0 for an empty loadout", () => {
    expect(calculateGigSuccessBonus([])).toBe(0);
  });

  it("should return the gig_success_rate bonus of a single implant (Óptica Vidraça)", () => {
    expect(calculateGigSuccessBonus([def({ bonuses: { gig_success_rate: 5 } })])).toBe(5);
  });

  it("should sum trampo success bonuses across implants", () => {
    const result = calculateGigSuccessBonus([
      def({ bonuses: { gig_success_rate: 2 } }),
      def({ bonuses: { gig_success_rate: 3 } }),
    ]);
    expect(result).toBe(5);
  });
});

describe("calculateNilMaxBonus", () => {
  it("should return 0 for an empty loadout", () => {
    expect(calculateNilMaxBonus([])).toBe(0);
  });

  it("should return the nil_max bonus of a Cuca Acesa (T1: +10)", () => {
    expect(calculateNilMaxBonus([def({ bonuses: { nil_max: 10 } })])).toBe(10);
  });

  it("should sum nil_max bonuses across multiple neural implants", () => {
    const result = calculateNilMaxBonus([
      def({ bonuses: { nil_max: 10 } }),
      def({ bonuses: { nil_max: 20 } }),
    ]);
    expect(result).toBe(30);
  });

  it("should return 0 for non-neural implants (Braço de Ferro)", () => {
    expect(calculateNilMaxBonus([def({ bonuses: { body: 3 } })])).toBe(0);
  });

  it("should return 0 for implants with mixed bonuses but no nil_max", () => {
    expect(calculateNilMaxBonus([def({ bonuses: { max_hp: 10, gig_success_rate: 5 } })])).toBe(0);
  });
});

describe("calculateHumanityCost", () => {
  it("should return 0 for an empty loadout", () => {
    expect(calculateHumanityCost([])).toBe(0);
  });

  it("should return the humanity cost of a single T1 implant", () => {
    expect(calculateHumanityCost([def({ humanityCost: 3 })])).toBe(3);
  });

  it("should sum humanity costs across all five starter implants (3+3+4+8+6)", () => {
    const allFive = [
      def({ slug: "neural-booster", humanityCost: 3 }),
      def({ slug: "reflex-tuner", humanityCost: 3 }),
      def({ slug: "kiroshi-optics", humanityCost: 4 }),
      def({ slug: "gorilla-arms", humanityCost: 8 }),
      def({ slug: "subdermal-armor", humanityCost: 6 }),
    ];
    expect(calculateHumanityCost(allFive)).toBe(24);
  });
});

describe("validateSlotAvailability", () => {
  it("should allow the first implant in an empty slot (0/3)", () => {
    expect(validateSlotAvailability("frontal_cortex", 0)).toBe(true);
  });

  it("should allow an implant when the slot still has room (2/3)", () => {
    expect(validateSlotAvailability("frontal_cortex", 2)).toBe(true);
  });

  it("should reject an implant when the slot is full (3/3)", () => {
    expect(validateSlotAvailability("frontal_cortex", 3)).toBe(false);
  });

  it("should reject an implant when the slot is over capacity (4/3)", () => {
    expect(validateSlotAvailability("frontal_cortex", 4)).toBe(false);
  });
});

describe("validateHumanityAfterInstall", () => {
  it("should allow an implant when humanity is high (100 - 3)", () => {
    expect(validateHumanityAfterInstall(100, 3)).toBe(true);
  });

  it("should allow an implant that keeps humanity above 0 (5 - 3)", () => {
    expect(validateHumanityAfterInstall(5, 3)).toBe(true);
  });

  // The game contract (see chrome.ts): reaching exactly 0 is allowed — flatline
  // handling belongs to the cyberpsychosis system, so the check is >= 0, not > 0.
  it("should allow an implant that brings humanity to exactly 0 (3 - 3)", () => {
    expect(validateHumanityAfterInstall(3, 3)).toBe(true);
  });

  it("should reject an implant that would drop humanity below 0 (1 - 3)", () => {
    expect(validateHumanityAfterInstall(1, 3)).toBe(false);
  });

  it("should reject an implant whose cost exceeds current humanity (3 - 4)", () => {
    expect(validateHumanityAfterInstall(3, 4)).toBe(false);
  });
});
