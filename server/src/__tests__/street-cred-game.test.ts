import { describe, it, expect } from "vitest";
import {
  STREET_CRED_THRESHOLDS,
  getTitle,
  getNextThreshold,
  getThresholdFloor,
  calculateDecay,
  calculateSCAward,
  calculateStreetCredAward,
} from "../game/street-cred";

// ND-011.2 — unit tests for Moral game logic (pure functions, no DB).
// Conforme 04-sistemas-e-progressao.md §5: thresholds, decay, and SC awards.

// ─── Thresholds ─────────────────────────────────────────────────────────────

describe("STREET_CRED_THRESHOLDS", () => {
  it("should define seven thresholds from Zé Ninguém to Lenda", () => {
    expect(STREET_CRED_THRESHOLDS).toHaveLength(7);
    expect(STREET_CRED_THRESHOLDS[0]).toEqual({ score: 0, title: "Zé Ninguém" });
    expect(STREET_CRED_THRESHOLDS[1]).toEqual({ score: 10, title: "Perna" });
    expect(STREET_CRED_THRESHOLDS[2]).toEqual({ score: 25, title: "Pro" });
    expect(STREET_CRED_THRESHOLDS[3]).toEqual({ score: 50, title: "Corredor" });
    expect(STREET_CRED_THRESHOLDS[4]).toEqual({ score: 75, title: "Elite" });
    expect(STREET_CRED_THRESHOLDS[5]).toEqual({ score: 90, title: "Lenda de SP" });
    expect(STREET_CRED_THRESHOLDS[6]).toEqual({ score: 100, title: "Lenda" });
  });
});

// ─── getTitle ───────────────────────────────────────────────────────────────

describe("getTitle", () => {
  it("should return 'Zé Ninguém' for score 0", () => {
    expect(getTitle(0)).toBe("Zé Ninguém");
  });

  it("should return 'Zé Ninguém' for negative scores", () => {
    expect(getTitle(-1)).toBe("Zé Ninguém");
    expect(getTitle(-999)).toBe("Zé Ninguém");
  });

  it("should return 'Zé Ninguém' for scores between 0 and 9", () => {
    expect(getTitle(1)).toBe("Zé Ninguém");
    expect(getTitle(5)).toBe("Zé Ninguém");
    expect(getTitle(9)).toBe("Zé Ninguém");
  });

  it("should return 'Perna' for scores between 10 and 24", () => {
    expect(getTitle(10)).toBe("Perna");
    expect(getTitle(12)).toBe("Perna");
    expect(getTitle(24)).toBe("Perna");
  });

  it("should return 'Pro' for scores between 25 and 49", () => {
    expect(getTitle(25)).toBe("Pro");
    expect(getTitle(37)).toBe("Pro");
    expect(getTitle(49)).toBe("Pro");
  });

  it("should return 'Corredor' for scores between 50 and 74", () => {
    expect(getTitle(50)).toBe("Corredor");
    expect(getTitle(62)).toBe("Corredor");
    expect(getTitle(74)).toBe("Corredor");
  });

  it("should return 'Elite' for scores between 75 and 89", () => {
    expect(getTitle(75)).toBe("Elite");
    expect(getTitle(88)).toBe("Elite");
    expect(getTitle(89)).toBe("Elite");
  });

  it("should return 'Lenda de SP' for scores between 90 and 99", () => {
    expect(getTitle(90)).toBe("Lenda de SP");
    expect(getTitle(95)).toBe("Lenda de SP");
    expect(getTitle(99)).toBe("Lenda de SP");
  });

  it("should return 'Lenda' for score 100", () => {
    expect(getTitle(100)).toBe("Lenda");
  });

  it("should return 'Lenda' for scores above 100 (capped)", () => {
    expect(getTitle(150)).toBe("Lenda");
    expect(getTitle(9999)).toBe("Lenda");
  });
});

// ─── getNextThreshold ───────────────────────────────────────────────────────

describe("getNextThreshold", () => {
  it("should return Perna for score 0", () => {
    expect(getNextThreshold(0)).toEqual({ score: 10, title: "Perna" });
  });

  it("should return Perna for score 9", () => {
    expect(getNextThreshold(9)).toEqual({ score: 10, title: "Perna" });
  });

  it("should return Pro for score 10", () => {
    expect(getNextThreshold(10)).toEqual({ score: 25, title: "Pro" });
  });

  it("should return Pro for score 24", () => {
    expect(getNextThreshold(24)).toEqual({ score: 25, title: "Pro" });
  });

  it("should return Corredor for score 25", () => {
    expect(getNextThreshold(25)).toEqual({ score: 50, title: "Corredor" });
  });

  it("should return Elite for score 50", () => {
    expect(getNextThreshold(50)).toEqual({ score: 75, title: "Elite" });
  });

  it("should return Lenda de SP for score 75", () => {
    expect(getNextThreshold(75)).toEqual({ score: 90, title: "Lenda de SP" });
  });

  it("should return Lenda de SP for score 89", () => {
    expect(getNextThreshold(89)).toEqual({ score: 90, title: "Lenda de SP" });
  });

  it("should return Lenda for score 90", () => {
    expect(getNextThreshold(90)).toEqual({ score: 100, title: "Lenda" });
  });

  it("should return Lenda for score 99", () => {
    expect(getNextThreshold(99)).toEqual({ score: 100, title: "Lenda" });
  });

  it("should return null for score 100 (Lenda)", () => {
    expect(getNextThreshold(100)).toBeNull();
  });

  it("should return null for scores above 100", () => {
    expect(getNextThreshold(150)).toBeNull();
    expect(getNextThreshold(999)).toBeNull();
  });

  it("should return Zé Ninguém (0) for negative scores (first threshold > score)", () => {
    // The first threshold with score > -5 is 0 (Zé Ninguém), not 10
    expect(getNextThreshold(-5)).toEqual({ score: 0, title: "Zé Ninguém" });
  });
});

// ─── getThresholdFloor ──────────────────────────────────────────────────────

describe("getThresholdFloor", () => {
  it("should return 0 for maxAchieved 0", () => {
    expect(getThresholdFloor(0)).toBe(0);
  });

  it("should return 0 for maxAchieved 5 (still Zé Ninguém)", () => {
    expect(getThresholdFloor(5)).toBe(0);
  });

  it("should return 10 for maxAchieved 10 (Perna)", () => {
    expect(getThresholdFloor(10)).toBe(10);
  });

  it("should return 10 for maxAchieved 12 (still Perna)", () => {
    expect(getThresholdFloor(12)).toBe(10);
  });

  it("should return 25 for maxAchieved 25 (Pro)", () => {
    expect(getThresholdFloor(25)).toBe(25);
  });

  it("should return 50 for maxAchieved 52 (Corredor)", () => {
    expect(getThresholdFloor(52)).toBe(50);
  });

  it("should return 50 for maxAchieved 74 (Corredor)", () => {
    expect(getThresholdFloor(74)).toBe(50);
  });

  it("should return 75 for maxAchieved 75 (Elite)", () => {
    expect(getThresholdFloor(75)).toBe(75);
  });

  it("should return 75 for maxAchieved 89 (still Elite)", () => {
    expect(getThresholdFloor(89)).toBe(75);
  });

  it("should return 90 for maxAchieved 90 (Lenda de SP)", () => {
    expect(getThresholdFloor(90)).toBe(90);
  });

  it("should return 90 for maxAchieved 99 (still Lenda de SP)", () => {
    expect(getThresholdFloor(99)).toBe(90);
  });

  it("should return 100 for maxAchieved 100 (Lenda)", () => {
    expect(getThresholdFloor(100)).toBe(100);
  });

  it("should return 100 for maxAchieved above 100", () => {
    expect(getThresholdFloor(150)).toBe(100);
  });

  it("should return 0 for negative maxAchieved", () => {
    expect(getThresholdFloor(-10)).toBe(0);
  });
});

// ─── calculateDecay ─────────────────────────────────────────────────────────

const DAY = 86_400_000;
const NOW = new Date("2026-08-07T12:00:00.000Z");

describe("calculateDecay", () => {
  // ── Grace period (0–6 days) ────────────────────────────────────────────

  it("should not decay when last activity is today (0 days)", () => {
    const result = calculateDecay(NOW, 100, 100, NOW);
    expect(result).toEqual({ decayAmount: 0, effectiveScore: 100 });
  });

  it("should not decay after 1 day", () => {
    const last = new Date(NOW.getTime() - 1 * DAY);
    expect(calculateDecay(last, 100, 100, NOW)).toEqual({ decayAmount: 0, effectiveScore: 100 });
  });

  it("should not decay after 3 days", () => {
    const last = new Date(NOW.getTime() - 3 * DAY);
    expect(calculateDecay(last, 100, 100, NOW)).toEqual({ decayAmount: 0, effectiveScore: 100 });
  });

  it("should not decay after 6 days (last day of grace)", () => {
    const last = new Date(NOW.getTime() - 6 * DAY);
    expect(calculateDecay(last, 100, 100, NOW)).toEqual({ decayAmount: 0, effectiveScore: 100 });
  });

  // ── Exactly at grace boundary (7 days) ─────────────────────────────────

  it("should apply 0 decay at exactly 7 days (days - 7 = 0)", () => {
    const last = new Date(NOW.getTime() - 7 * DAY);
    const result = calculateDecay(last, 100, 100, NOW);
    // Math.floor(7 - 7) * 5 = 0
    expect(result).toEqual({ decayAmount: 0, effectiveScore: 100 });
  });

  // ── Past grace period ──────────────────────────────────────────────────

  it("should decay by 5 at 8 days (1 day past grace)", () => {
    // Use maxAchieved=0, currentScore=50: floor=0, maxDecay=50, raw=5
    const last = new Date(NOW.getTime() - 8 * DAY);
    const result = calculateDecay(last, 50, 0, NOW);
    // Math.floor(8 - 7) * 5 = 5
    expect(result).toEqual({ decayAmount: 5, effectiveScore: 45 });
  });

  it("should decay by 15 at 10 days (3 days past grace)", () => {
    // maxAchieved=0, currentScore=50: floor=0, maxDecay=50, raw=15
    const last = new Date(NOW.getTime() - 10 * DAY);
    const result = calculateDecay(last, 50, 0, NOW);
    // Math.floor(10 - 7) * 5 = 15
    expect(result).toEqual({ decayAmount: 15, effectiveScore: 35 });
  });

  it("should decay by 25 at 12 days (5 days past grace)", () => {
    // maxAchieved=0, currentScore=50: floor=0, maxDecay=50, raw=25
    const last = new Date(NOW.getTime() - 12 * DAY);
    const result = calculateDecay(last, 50, 0, NOW);
    // Math.floor(12 - 7) * 5 = 25
    expect(result).toEqual({ decayAmount: 25, effectiveScore: 25 });
  });

  // ── Fractional days: Math.floor truncates ──────────────────────────────

  it("should not decay at 7.5 days (floor gives 7, still in grace)", () => {
    const last = new Date(NOW.getTime() - 7 * DAY - 12 * 3_600_000); // 7d 12h
    const result = calculateDecay(last, 100, 100, NOW);
    // Math.floor(7.5 - 7) * 5 = 0
    expect(result.decayAmount).toBe(0);
  });

  // ── Floor protection ───────────────────────────────────────────────────

  it("should stop decay at the threshold floor for maxAchieved 52 (floor=50)", () => {
    // currentScore = 55, maxAchieved=52 → floor = 50, max decay = 5
    // At 10 days: raw decay = (10-7)*5 = 15, clamped to 5
    const last = new Date(NOW.getTime() - 10 * DAY);
    const result = calculateDecay(last, 55, 52, NOW);
    expect(result).toEqual({ decayAmount: 5, effectiveScore: 50 });
  });

  it("should stop decay at Perna floor (10) for maxAchieved 12", () => {
    // currentScore=18, maxAchieved=12 → floor=10, maxDecay=8
    // At 12 days: raw = (12-7)*5 = 25, clamped to 8
    const last = new Date(NOW.getTime() - 12 * DAY);
    const result = calculateDecay(last, 18, 12, NOW);
    expect(result).toEqual({ decayAmount: 8, effectiveScore: 10 });
  });

  it("should not decay when currentScore is already at floor", () => {
    const last = new Date(NOW.getTime() - 30 * DAY);
    const result = calculateDecay(last, 10, 12, NOW); // floor=10, score=10
    expect(result).toEqual({ decayAmount: 0, effectiveScore: 10 });
  });

  it("should not decay when currentScore is below floor (defensive)", () => {
    const last = new Date(NOW.getTime() - 30 * DAY);
    const result = calculateDecay(last, 8, 12, NOW); // floor=10, score=8 → already below
    expect(result).toEqual({ decayAmount: 0, effectiveScore: 8 });
  });

  // ── Clock skew: future date ────────────────────────────────────────────

  it("should treat future lastActivity as 0 days (no decay)", () => {
    const future = new Date(NOW.getTime() + 10 * DAY);
    const result = calculateDecay(future, 100, 100, NOW);
    expect(result).toEqual({ decayAmount: 0, effectiveScore: 100 });
  });

  // ── Extensive decay ────────────────────────────────────────────────────

  it("should decay all the way to Elite floor (75) with enough time", () => {
    // currentScore=100, maxAchieved=100, floor=100
    // maxDecay = 100 - 100 = 0 → no decay possible (Lenda floor = 100)
    const last = new Date(NOW.getTime() - 100 * DAY);
    const result = calculateDecay(last, 100, 100, NOW);
    expect(result.effectiveScore).toBe(100);
  });

  it("should decay from 80 to Corredor floor (50) with enough time", () => {
    // maxAchieved=80 → floor=75 (Elite), maxDecay=80-75=5
    const last = new Date(NOW.getTime() - 100 * DAY);
    const result = calculateDecay(last, 80, 80, NOW);
    expect(result.effectiveScore).toBe(75);
  });

  it("should not decay from Unknown (0) regardless of inactivity", () => {
    const last = new Date(NOW.getTime() - 365 * DAY);
    const result = calculateDecay(last, 0, 0, NOW);
    expect(result).toEqual({ decayAmount: 0, effectiveScore: 0 });
  });
});

// ─── calculateSCAward ───────────────────────────────────────────────────────

describe("calculateSCAward", () => {
  // ── T1 (1–3) ───────────────────────────────────────────────────────────

  it("should return 0 for a failed T1 trampo", () => {
    expect(calculateSCAward("t1", 5, false, () => 0.5)).toBe(0);
  });

  it("should return 1 for T1 with RNG at minimum bound", () => {
    expect(calculateSCAward("t1", 5, true, () => 0)).toBe(1);
  });

  it("should return 3 for T1 with RNG at maximum bound", () => {
    expect(calculateSCAward("t1", 5, true, () => 0.9999)).toBe(3);
  });

  it("should return values in [1, 3] for T1 over many iterations", () => {
    for (let i = 0; i < 200; i++) {
      const sc = calculateSCAward("t1", 5, true, Math.random);
      expect(sc).toBeGreaterThanOrEqual(1);
      expect(sc).toBeLessThanOrEqual(3);
    }
  });

  // ── T2 (3–8) ───────────────────────────────────────────────────────────

  it("should return 3 for T2 with RNG at minimum bound", () => {
    expect(calculateSCAward("t2", 7, true, () => 0)).toBe(3);
  });

  it("should return 8 for T2 with RNG at maximum bound", () => {
    expect(calculateSCAward("t2", 7, true, () => 0.9999)).toBe(8);
  });

  it("should return 4 for T2 with RNG at 0.2", () => {
    // range = 6 values [3..8], rng=0.2 → floor(0.2*6)=1 → 1+3 = 4
    expect(calculateSCAward("t2", 7, true, () => 0.2)).toBe(4);
  });

  it("should return values in [3, 8] for T2 over many iterations", () => {
    for (let i = 0; i < 200; i++) {
      const sc = calculateSCAward("t2", 7, true, Math.random);
      expect(sc).toBeGreaterThanOrEqual(3);
      expect(sc).toBeLessThanOrEqual(8);
    }
  });

  // ── T3 (10–20) ─────────────────────────────────────────────────────────

  it("should return 10 for T3 with RNG at minimum bound", () => {
    expect(calculateSCAward("t3", 10, true, () => 0)).toBe(10);
  });

  it("should return 20 for T3 with RNG at maximum bound", () => {
    expect(calculateSCAward("t3", 10, true, () => 0.9999)).toBe(20);
  });

  it("should return values in [10, 20] for T3 over many iterations", () => {
    for (let i = 0; i < 200; i++) {
      const sc = calculateSCAward("t3", 10, true, Math.random);
      expect(sc).toBeGreaterThanOrEqual(10);
      expect(sc).toBeLessThanOrEqual(20);
    }
  });

  // ── T4 (20–30) ─────────────────────────────────────────────────────────

  it("should return 20 for T4 with RNG at minimum bound", () => {
    expect(calculateSCAward("t4", 15, true, () => 0)).toBe(20);
  });

  it("should return 30 for T4 with RNG at maximum bound", () => {
    expect(calculateSCAward("t4", 15, true, () => 0.9999)).toBe(30);
  });

  it("should return values in [20, 30] for T4 over many iterations", () => {
    for (let i = 0; i < 200; i++) {
      const sc = calculateSCAward("t4", 15, true, Math.random);
      expect(sc).toBeGreaterThanOrEqual(20);
      expect(sc).toBeLessThanOrEqual(30);
    }
  });

  // ── T5 (30–50) ─────────────────────────────────────────────────────────

  it("should return 30 for T5 with RNG at minimum bound", () => {
    expect(calculateSCAward("t5", 20, true, () => 0)).toBe(30);
  });

  it("should return 50 for T5 with RNG at maximum bound", () => {
    expect(calculateSCAward("t5", 20, true, () => 0.9999)).toBe(50);
  });

  it("should return values in [30, 50] for T5 over many iterations", () => {
    for (let i = 0; i < 200; i++) {
      const sc = calculateSCAward("t5", 20, true, Math.random);
      expect(sc).toBeGreaterThanOrEqual(30);
      expect(sc).toBeLessThanOrEqual(50);
    }
  });

  // ── Failure cases ──────────────────────────────────────────────────────

  it("should return 0 for a failed T2 trampo", () => {
    expect(calculateSCAward("t2", 7, false, () => 0.5)).toBe(0);
  });

  it("should return 0 for a failed T5 trampo", () => {
    expect(calculateSCAward("t5", 25, false, () => 0.1)).toBe(0);
  });

  // ── Unknown tier ───────────────────────────────────────────────────────

  it("should return 0 for an unknown tier on success", () => {
    expect(calculateSCAward("unknown", 5, true, () => 0.5)).toBe(0);
  });

  it("should return 0 for an empty tier string", () => {
    expect(calculateSCAward("", 5, true, () => 0.5)).toBe(0);
  });

  // ── Case insensitivity ─────────────────────────────────────────────────

  it("should handle uppercase tier strings (T1, T2)", () => {
    expect(calculateSCAward("T1", 5, true, () => 0)).toBe(1);
    expect(calculateSCAward("T2", 5, true, () => 0)).toBe(3);
  });

  // ── Seeded RNG deterministic output ────────────────────────────────────

  it("should produce deterministic output with a seeded RNG", () => {
    // Simple linear congruential generator for reproducibility
    let seed = 42;
    const lcg = (): number => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };
    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      results.push(calculateSCAward("t3", 10, true, lcg));
    }
    // Run again with same seed — must produce identical sequence
    seed = 42;
    for (let i = 0; i < 10; i++) {
      expect(calculateSCAward("t3", 10, true, lcg)).toBe(results[i]);
    }
  });

  // ── difficulty param does not affect output ────────────────────────────

  it("should produce the same SC award regardless of difficulty (reserved param)", () => {
    const rng = () => 0.5;
    expect(calculateSCAward("t1", 1, true, rng)).toBe(calculateSCAward("t1", 999, true, rng));
    expect(calculateSCAward("t2", 5, true, rng)).toBe(calculateSCAward("t2", 100, true, rng));
  });
});

// ─── calculateStreetCredAward (backward-compat wrapper) ─────────────────────

describe("calculateStreetCredAward", () => {
  it("should delegate to calculateSCAward for T1", () => {
    expect(calculateStreetCredAward("t1", 5, true, () => 0.5)).toBe(2);
  });

  it("should delegate to calculateSCAward for T2", () => {
    expect(calculateStreetCredAward("t2", 5, true, () => 0.5)).toBe(6);
  });

  it("should return 0 on failure", () => {
    expect(calculateStreetCredAward("t1", 5, false)).toBe(0);
  });
});

// ─── Edge case: multi-day decay crossing multiple thresholds ────────────────

describe("Decay edge cases", () => {
  const NOW = new Date("2026-08-07T12:00:00.000Z");
  const DAY = 86_400_000;

  it("should decay from 95 to Lenda de SP floor (90) but not below", () => {
    // maxAchieved=95 → floor=90 (Lenda de SP), maxDecay=5
    // At 15 days: raw = (15-7)*5 = 40, clamped to 5
    const last = new Date(NOW.getTime() - 15 * DAY);
    const result = calculateDecay(last, 95, 95, NOW);
    expect(result.effectiveScore).toBe(90);
    expect(result.decayAmount).toBe(5);
  });

  it("should exactly hit the floor when raw decay equals max decay", () => {
    // maxAchieved=30, currentScore=35 → floor=25, maxDecay=10
    // Need (days-7)*5 = 10 → days = 9
    const last = new Date(NOW.getTime() - 9 * DAY);
    const result = calculateDecay(last, 35, 30, NOW);
    expect(result).toEqual({ decayAmount: 10, effectiveScore: 25 });
  });

  it("should handle partial decay within a day (hours but not full day)", () => {
    // 7 days 23 hours → floor gives 7 days → grace
    const last = new Date(NOW.getTime() - 7 * DAY - 23 * 3_600_000);
    const result = calculateDecay(last, 100, 100, NOW);
    expect(result.decayAmount).toBe(0);
  });

  it("should handle exactly 8 days (24h past grace)", () => {
    // maxAchieved=0, currentScore=50: floor=0, raw decay = (8-7)*5 = 5
    const last = new Date(NOW.getTime() - 8 * DAY);
    const result = calculateDecay(last, 50, 0, NOW);
    expect(result.decayAmount).toBe(5);
  });
});

// ─── Deterministic composition: getTitle reflects effectiveScore ────────────

describe("Title + Decay integration", () => {
  const NOW = new Date("2026-08-07T12:00:00.000Z");
  const DAY = 86_400_000;

  it("should maintain Elite title after decaying from 100 to floor 75", () => {
    const last = new Date(NOW.getTime() - 100 * DAY);
    const { effectiveScore } = calculateDecay(last, 100, 100, NOW);
    expect(effectiveScore).toBe(100); // Lenda floor = 100, can't fall
    expect(getTitle(effectiveScore)).toBe("Lenda");
  });

  it("should maintain Corredor title after decaying from 60 to floor 50", () => {
    const last = new Date(NOW.getTime() - 30 * DAY);
    const { effectiveScore } = calculateDecay(last, 60, 50, NOW);
    expect(effectiveScore).toBe(50);
    expect(getTitle(effectiveScore)).toBe("Corredor");
  });

  it("should maintain Pro title after decaying from 35 to floor 25", () => {
    const last = new Date(NOW.getTime() - 30 * DAY);
    const { effectiveScore } = calculateDecay(last, 35, 25, NOW);
    expect(effectiveScore).toBe(25);
    expect(getTitle(effectiveScore)).toBe("Pro");
  });
});
