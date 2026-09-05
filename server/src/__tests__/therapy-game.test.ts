import { describe, it, expect } from "vitest";
import {
  THERAPY_COOLDOWN_MS,
  THERAPY_OPTIONS,
  canUndergoTherapy,
  computeTherapyOutcome,
} from "../game/therapy";

// Issue #28 — unit tests for the Terapia game logic (pure functions, no DB).
// Follows 04-sistemas-e-progressao.md §4: clínicas restore 10-20 for
// G$ 5k-20k; sintonia restores 5-10 for G$ 2.5k-10k. Both share a single
// 500ms anti-spam window (#187) derived from the last session's completed_at.

// ─── THERAPY_OPTIONS ────────────────────────────────────────────────────────

describe("THERAPY_OPTIONS", () => {
  it("should define the clinic ranges (G$ 5k-20k, restaura 10-20)", () => {
    expect(THERAPY_OPTIONS.clinic).toEqual({
      costMin: 5000,
      costMax: 20000,
      restoreMin: 10,
      restoreMax: 20,
    });
  });

  it("should define the attunement ranges (G$ 2.5k-10k, restaura 5-10)", () => {
    expect(THERAPY_OPTIONS.attunement).toEqual({
      costMin: 2500,
      costMax: 10000,
      restoreMin: 5,
      restoreMax: 10,
    });
  });
});

// ─── canUndergoTherapy ──────────────────────────────────────────────────────

describe("canUndergoTherapy", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("should allow therapy when the character never did it", () => {
    expect(canUndergoTherapy(null, THERAPY_COOLDOWN_MS, now)).toEqual({
      canUndergo: true,
      nextAvailableAt: null,
    });
  });

  it("should allow therapy when the cooldown is disabled (cooldownMs <= 0)", () => {
    expect(canUndergoTherapy(now, 0, now)).toEqual({
      canUndergo: true,
      nextAvailableAt: null,
    });
  });

  it("should block therapy while the 500ms anti-spam window is running", () => {
    const last = new Date(now.getTime() - 100); // 100ms ago — inside the window
    const result = canUndergoTherapy(last, THERAPY_COOLDOWN_MS, now);
    expect(result.canUndergo).toBe(false);
    expect(result.nextAvailableAt!.getTime()).toBe(last.getTime() + THERAPY_COOLDOWN_MS);
  });

  it("should allow therapy exactly when the cooldown expires", () => {
    const last = new Date(now.getTime() - THERAPY_COOLDOWN_MS);
    expect(canUndergoTherapy(last, THERAPY_COOLDOWN_MS, now)).toEqual({
      canUndergo: true,
      nextAvailableAt: null,
    });
  });

  it("should block therapy when the last session is in the future (clock skew)", () => {
    const future = new Date(now.getTime() + 60_000);
    const result = canUndergoTherapy(future, THERAPY_COOLDOWN_MS, now);
    expect(result.canUndergo).toBe(false);
    expect(result.nextAvailableAt!.getTime()).toBe(future.getTime() + THERAPY_COOLDOWN_MS);
  });
});

// ─── computeTherapyOutcome ──────────────────────────────────────────────────

describe("computeTherapyOutcome", () => {
  it("should roll the clinic minimum when rng returns 0", () => {
    expect(computeTherapyOutcome("clinic", () => 0)).toEqual({ cost: 5000, restored: 10 });
  });

  it("should roll the clinic maximum when rng returns ~1", () => {
    // rollRange = floor(rng * (max - min + 1)) + min — the max is reachable
    // only when rng >= (max - min)/(max - min + 1) ≈ 0.99993.
    expect(computeTherapyOutcome("clinic", () => 0.9999999)).toEqual({ cost: 20000, restored: 20 });
  });

  it("should roll the attunement minimum when rng returns 0", () => {
    expect(computeTherapyOutcome("attunement", () => 0)).toEqual({ cost: 2500, restored: 5 });
  });

  it("should roll the attunement maximum when rng returns ~1", () => {
    expect(computeTherapyOutcome("attunement", () => 0.9999999)).toEqual({
      cost: 10000,
      restored: 10,
    });
  });

  it("should stay within the modality ranges for any rng value", () => {
    for (const r of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      const clinic = computeTherapyOutcome("clinic", () => r);
      expect(clinic.cost).toBeGreaterThanOrEqual(5000);
      expect(clinic.cost).toBeLessThanOrEqual(20000);
      expect(clinic.restored).toBeGreaterThanOrEqual(10);
      expect(clinic.restored).toBeLessThanOrEqual(20);

      const attunement = computeTherapyOutcome("attunement", () => r);
      expect(attunement.cost).toBeGreaterThanOrEqual(2500);
      expect(attunement.cost).toBeLessThanOrEqual(10000);
      expect(attunement.restored).toBeGreaterThanOrEqual(5);
      expect(attunement.restored).toBeLessThanOrEqual(10);
    }
  });

  it("should fall back to the clinic ranges for an unknown type (defensive)", () => {
    const result = computeTherapyOutcome("unknown" as never, () => 0);
    expect(result).toEqual({ cost: 5000, restored: 10 });
  });
});
