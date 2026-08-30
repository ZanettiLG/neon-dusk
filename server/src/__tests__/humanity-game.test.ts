import { describe, it, expect } from "vitest";
import {
  SCRUBBER_REGEN_CAP,
  SCRUBBER_REGEN_INTERVAL_MS,
  applyScrubberRegen,
  clampHumanity,
  getHumanityBand,
} from "../game/humanity";

// Issue #28 — unit tests for the Humanidade game logic (pure functions, no DB).
// Follows 04-sistemas-e-progressao.md §4: 100-71 Íntegro, 70-41 Instável,
// 40-21 Borderline, 20-1 Cyberpsycho, 0 Apagado (flatline). The Neural
// Scrubber regens +1/24h lazily (computed on read) with a hard cap of 50.

// ─── getHumanityBand ────────────────────────────────────────────────────────

describe("getHumanityBand", () => {
  it("should return integro for humanity 100 and 71", () => {
    expect(getHumanityBand(100)).toBe("integro");
    expect(getHumanityBand(71)).toBe("integro");
  });

  it("should return instavel for humanity 70 and 41", () => {
    expect(getHumanityBand(70)).toBe("instavel");
    expect(getHumanityBand(41)).toBe("instavel");
  });

  it("should return borderline for humanity 40 and 21", () => {
    expect(getHumanityBand(40)).toBe("borderline");
    expect(getHumanityBand(21)).toBe("borderline");
  });

  it("should return cyberpsycho for humanity 20 and 1", () => {
    expect(getHumanityBand(20)).toBe("cyberpsycho");
    expect(getHumanityBand(1)).toBe("cyberpsycho");
  });

  it("should return apagado for humanity 0", () => {
    expect(getHumanityBand(0)).toBe("apagado");
  });

  it("should clamp negative humanity to apagado", () => {
    expect(getHumanityBand(-5)).toBe("apagado");
  });

  it("should clamp humanity above 100 to integro", () => {
    expect(getHumanityBand(150)).toBe("integro");
  });
});

// ─── clampHumanity ──────────────────────────────────────────────────────────

describe("clampHumanity", () => {
  it("should keep values inside [0, 100] unchanged", () => {
    expect(clampHumanity(0)).toBe(0);
    expect(clampHumanity(50)).toBe(50);
    expect(clampHumanity(100)).toBe(100);
  });

  it("should clamp negative values to 0", () => {
    expect(clampHumanity(-1)).toBe(0);
    expect(clampHumanity(-50)).toBe(0);
  });

  it("should clamp values above 100 to 100", () => {
    expect(clampHumanity(101)).toBe(100);
    expect(clampHumanity(150)).toBe(100);
  });

  it("should round fractional values", () => {
    expect(clampHumanity(42.4)).toBe(42);
    expect(clampHumanity(42.5)).toBe(43);
  });
});

// ─── applyScrubberRegen ─────────────────────────────────────────────────────

describe("applyScrubberRegen", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("should apply no regen and no next tick when humanity is at the cap", () => {
    const result = applyScrubberRegen(50, new Date(now.getTime() - 3 * SCRUBBER_REGEN_INTERVAL_MS), SCRUBBER_REGEN_CAP, now);
    expect(result).toEqual({ humanity: 50, regenApplied: 0, nextRegenAt: null });
  });

  it("should treat a null lastUpdatedAt as now (no elapsed windows)", () => {
    const result = applyScrubberRegen(40, null, SCRUBBER_REGEN_CAP, now);
    expect(result.humanity).toBe(40);
    expect(result.regenApplied).toBe(0);
    expect(result.nextRegenAt!.getTime()).toBe(now.getTime() + SCRUBBER_REGEN_INTERVAL_MS);
  });

  it("should apply 0 regen when the last write is in the future (clock skew)", () => {
    const future = new Date(now.getTime() + 60_000);
    const result = applyScrubberRegen(40, future, SCRUBBER_REGEN_CAP, now);
    expect(result.humanity).toBe(40);
    expect(result.regenApplied).toBe(0);
  });

  it("should apply +1 after one full 24h window", () => {
    const last = new Date(now.getTime() - SCRUBBER_REGEN_INTERVAL_MS);
    const result = applyScrubberRegen(40, last, SCRUBBER_REGEN_CAP, now);
    expect(result.humanity).toBe(41);
    expect(result.regenApplied).toBe(1);
    expect(result.nextRegenAt!.getTime()).toBe(last.getTime() + 2 * SCRUBBER_REGEN_INTERVAL_MS);
  });

  it("should apply +N after N full windows (lazy multi-day regen)", () => {
    const last = new Date(now.getTime() - 3 * SCRUBBER_REGEN_INTERVAL_MS);
    const result = applyScrubberRegen(40, last, SCRUBBER_REGEN_CAP, now);
    expect(result.humanity).toBe(43);
    expect(result.regenApplied).toBe(3);
  });

  it("should apply 0 regen when the window is not complete yet", () => {
    const last = new Date(now.getTime() - SCRUBBER_REGEN_INTERVAL_MS + 1_000);
    const result = applyScrubberRegen(40, last, SCRUBBER_REGEN_CAP, now);
    expect(result.humanity).toBe(40);
    expect(result.regenApplied).toBe(0);
    expect(result.nextRegenAt!.getTime()).toBe(last.getTime() + SCRUBBER_REGEN_INTERVAL_MS);
  });

  it("should cap the regen so humanity never exceeds the cap", () => {
    // 5 windows elapsed but only 3 points of headroom (47 → 50).
    const last = new Date(now.getTime() - 5 * SCRUBBER_REGEN_INTERVAL_MS);
    const result = applyScrubberRegen(47, last, SCRUBBER_REGEN_CAP, now);
    expect(result.humanity).toBe(50);
    expect(result.regenApplied).toBe(3);
    expect(result.nextRegenAt).toBeNull(); // cap reached before the next window
  });

  it("should honor a custom cap", () => {
    const last = new Date(now.getTime() - 2 * SCRUBBER_REGEN_INTERVAL_MS);
    const result = applyScrubberRegen(10, last, 12, now);
    expect(result.humanity).toBe(12);
    expect(result.regenApplied).toBe(2);
    expect(result.nextRegenAt).toBeNull();
  });
});