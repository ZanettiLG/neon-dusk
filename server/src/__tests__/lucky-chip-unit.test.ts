import { describe, it, expect } from "vitest";
import { createRng, rollD20, validateBet, resolveBet } from "../game/lucky-chip";

// Feature ND-008 — Lucky Chip pure game logic. No server, no DB: these are
// deterministic functions; every assertion below is stable run-to-run because
// the RNG is seedable (mulberry32) and no external state is involved.

describe("createRng", () => {
  it("should produce the same sequence for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 20; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("should produce different sequences for different seeds", () => {
    const a = createRng(42);
    const b = createRng(43);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).not.toEqual(seqB);
  });

  it("should only produce values in [0, 1)", () => {
    const rng = createRng(1234);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("should handle a negative seed deterministically (seed | 0)", () => {
    const a = createRng(-42);
    const b = createRng(-42);
    for (let i = 0; i < 5; i++) {
      expect(a.next()).toBe(b.next());
    }
  });

  it("should truncate non-integer seeds to int32 like the production call site", () => {
    const a = createRng(42.9);
    const b = createRng(42);
    for (let i = 0; i < 5; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
});

describe("rollD20", () => {
  it("should return integers in [1, 20] over 100k rolls", () => {
    const rng = createRng(7);
    for (let i = 0; i < 100_000; i++) {
      const roll = rollD20(rng);
      expect(Number.isInteger(roll)).toBe(true);
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(20);
    }
  });

  it("should produce the same roll sequence for the same seed", () => {
    const rolls = (seed: number) => {
      const rng = createRng(seed);
      return Array.from({ length: 10 }, () => rollD20(rng));
    };
    expect(rolls(99)).toEqual(rolls(99));
  });

  it("should be fair: every value appears in 100k rolls", () => {
    const rng = createRng(2026);
    const counts = new Array<number>(21).fill(0);
    for (let i = 0; i < 100_000; i++) {
      counts[rollD20(rng)]++;
    }
    // Expected 5000 per face. Deterministic seed → counts are stable; the
    // generous ±300 band (≈4.4σ) rejects a biased die without flaking.
    for (let face = 1; face <= 20; face++) {
      expect(counts[face]).toBeGreaterThanOrEqual(4700);
      expect(counts[face]).toBeLessThanOrEqual(5300);
    }
  });

  it("should roll exactly 10 at the lower boundary (next() → 0.5⁻)", () => {
    // floor(0.499999 * 20) + 1 = 10 — the largest value that still loses.
    expect(rollD20({ next: () => 0.499999 })).toBe(10);
  });

  it("should roll exactly 11 at the win boundary (next() = 0.5)", () => {
    // floor(0.5 * 20) + 1 = 11 — the smallest value that wins.
    expect(rollD20({ next: () => 0.5 })).toBe(11);
  });

  it("should roll 1 and 20 at the extremes", () => {
    expect(rollD20({ next: () => 0 })).toBe(1);
    // Largest float below 1 maps to floor(19.999…)+1 = 20.
    expect(rollD20({ next: () => 0.999999 })).toBe(20);
  });

  it("should produce both wins and losses across one seeded session", () => {
    const rng = createRng(42);
    const rolls = Array.from({ length: 100 }, () => rollD20(rng));
    expect(rolls.some((r) => r >= 11)).toBe(true);
    expect(rolls.some((r) => r <= 10)).toBe(true);
  });
});

describe("validateBet", () => {
  it("should accept a valid bet", () => {
    expect(validateBet(10, 100)).toEqual({ valid: true });
  });

  it("should accept a bet equal to the balance exactly", () => {
    expect(validateBet(100, 100)).toEqual({ valid: true });
  });

  it("should reject a zero bet (below minimum)", () => {
    expect(validateBet(0, 100)).toEqual({ valid: false, reason: "bet_below_min" });
  });

  it("should reject a negative bet", () => {
    expect(validateBet(-5, 100)).toEqual({ valid: false, reason: "bet_below_min" });
  });

  it("should reject a non-integer bet", () => {
    expect(validateBet(10.5, 100)).toEqual({ valid: false, reason: "bet_not_integer" });
  });

  it("should reject a NaN bet", () => {
    expect(validateBet(NaN, 100)).toEqual({ valid: false, reason: "bet_not_integer" });
  });

  it("should reject an infinite bet", () => {
    expect(validateBet(Infinity, 100)).toEqual({ valid: false, reason: "bet_not_integer" });
  });

  it("should reject a bet above the balance", () => {
    expect(validateBet(101, 100)).toEqual({ valid: false, reason: "bet_exceeds_balance" });
  });

  it("should reject an unsafe integer even when the balance would allow it", () => {
    const unsafe = Number.MAX_SAFE_INTEGER + 1; // 2^53 — integer but not safe
    expect(Number.isInteger(unsafe)).toBe(true);
    expect(validateBet(unsafe, unsafe)).toEqual({ valid: false, reason: "bet_unsafe_integer" });
  });
});

describe("resolveBet", () => {
  it("should pay 2x on a win (roll >= 11)", () => {
    const result = resolveBet(50, 15);
    expect(result).toEqual({ roll: 15, won: true, payout: 100 });
  });

  it("should pay 0 on a loss (roll <= 10)", () => {
    const result = resolveBet(50, 5);
    expect(result).toEqual({ roll: 5, won: false, payout: 0 });
  });

  it("should treat roll 11 as a win (boundary)", () => {
    expect(resolveBet(10, 11).won).toBe(true);
    expect(resolveBet(10, 11).payout).toBe(20);
  });

  it("should treat roll 10 as a loss (boundary)", () => {
    expect(resolveBet(10, 10).won).toBe(false);
    expect(resolveBet(10, 10).payout).toBe(0);
  });

  it("should win on a natural 20", () => {
    const result = resolveBet(5, 20);
    expect(result.won).toBe(true);
    expect(result.payout).toBe(10);
  });

  it("should lose on a natural 1", () => {
    const result = resolveBet(5, 1);
    expect(result.won).toBe(false);
    expect(result.payout).toBe(0);
  });

  it("should return a payout of exactly bet * 2 on a win", () => {
    expect(resolveBet(77, 19).payout).toBe(154);
  });

  it("should preserve the roll in the result", () => {
    expect(resolveBet(3, 13).roll).toBe(13);
  });
});
