import { describe, it, expect } from "vitest";
import {
  OS_ABILITIES,
  canActivateOs,
  computeOsActiveUntil,
  computeOsUsesRemaining,
  getOsActiveBonus,
  isSameUtcDay,
  startOfUtcDay,
} from "../game/os-abilities";

// Issue #28 — unit tests for the OS ability game logic (pure functions, no DB).
// Follows 04-sistemas-e-progressao.md §3: Fúria 3x/dia 60s +50% Body, Surto
// 5x/dia 30s +50% Reflexes +25% dodge, Gazuá inerte (RAM é Fase 2). Daily
// charges reset at UTC midnight (os_ability_used_date stores the UTC midnight
// of the last use day).

const FURY = OS_ABILITIES["os-fury"];
const SURGE = OS_ABILITIES["os-surge"];
const GAZUA = OS_ABILITIES["os-gazuah"];

// ─── Catalog ────────────────────────────────────────────────────────────────

describe("OS_ABILITIES", () => {
  it("should define Fúria as 60s, 3x/day, +50% Body", () => {
    expect(FURY).toMatchObject({
      slug: "os-fury",
      durationMs: 60 * 1000,
      maxUsesPerDay: 3,
      bodyMultiplier: 1.5,
    });
    expect(FURY.reflexesMultiplier).toBeUndefined();
    expect(FURY.dodgeMultiplier).toBeUndefined();
  });

  it("should define Surto as 30s, 5x/day, +50% Reflexes and +25% dodge", () => {
    expect(SURGE).toMatchObject({
      slug: "os-surge",
      durationMs: 30 * 1000,
      maxUsesPerDay: 5,
      reflexesMultiplier: 1.5,
      dodgeMultiplier: 1.25,
    });
    expect(SURGE.bodyMultiplier).toBeUndefined();
  });

  it("should define Gazuá as inert (0 duration, 0 uses — RAM is Fase 2)", () => {
    expect(GAZUA).toMatchObject({
      slug: "os-gazuah",
      durationMs: 0,
      maxUsesPerDay: 0,
    });
    expect(GAZUA.bodyMultiplier).toBeUndefined();
    expect(GAZUA.reflexesMultiplier).toBeUndefined();
    expect(GAZUA.dodgeMultiplier).toBeUndefined();
  });
});

// ─── Daily reset helpers ────────────────────────────────────────────────────

describe("startOfUtcDay", () => {
  it("should return the UTC midnight of the given day", () => {
    const now = new Date("2026-08-30T14:35:12.000Z");
    const day = startOfUtcDay(now);
    expect(day.toISOString()).toBe("2026-08-30T00:00:00.000Z");
  });

  it("should default to the current instant when no reference is given", () => {
    const day = startOfUtcDay();
    expect(day.getUTCHours()).toBe(0);
    expect(day.getUTCMinutes()).toBe(0);
    expect(day.getUTCSeconds()).toBe(0);
  });
});

describe("isSameUtcDay", () => {
  it("should return true for two instants on the same UTC day", () => {
    const a = new Date("2026-08-30T00:00:00.000Z");
    const b = new Date("2026-08-30T23:59:59.999Z");
    expect(isSameUtcDay(a, b)).toBe(true);
  });

  it("should return false across the UTC midnight boundary", () => {
    const a = new Date("2026-08-30T23:59:59.999Z");
    const b = new Date("2026-08-31T00:00:00.000Z");
    expect(isSameUtcDay(a, b)).toBe(false);
  });

  it("should return false for a null date (never used)", () => {
    expect(isSameUtcDay(null, new Date("2026-08-30T12:00:00.000Z"))).toBe(false);
  });
});

// ─── computeOsUsesRemaining ─────────────────────────────────────────────────

describe("computeOsUsesRemaining", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("should return the full cap when the OS was never used", () => {
    expect(computeOsUsesRemaining(FURY, 0, null, now)).toBe(3);
    expect(computeOsUsesRemaining(SURGE, 0, null, now)).toBe(5);
  });

  it("should subtract uses spent today", () => {
    const usedDate = new Date("2026-08-30T00:00:00.000Z");
    expect(computeOsUsesRemaining(FURY, 1, usedDate, now)).toBe(2);
    expect(computeOsUsesRemaining(FURY, 3, usedDate, now)).toBe(0);
  });

  it("should reset to the full cap when the last use was on a previous UTC day", () => {
    const usedDate = new Date("2026-08-29T00:00:00.000Z");
    expect(computeOsUsesRemaining(FURY, 3, usedDate, now)).toBe(3);
    expect(computeOsUsesRemaining(SURGE, 5, usedDate, now)).toBe(5);
  });

  it("should clamp a negative persisted counter to 0", () => {
    const usedDate = new Date("2026-08-30T00:00:00.000Z");
    expect(computeOsUsesRemaining(FURY, -2, usedDate, now)).toBe(3);
  });

  it("should never return a negative remainder", () => {
    const usedDate = new Date("2026-08-30T00:00:00.000Z");
    expect(computeOsUsesRemaining(FURY, 99, usedDate, now)).toBe(0);
  });
});

// ─── computeOsActiveUntil ───────────────────────────────────────────────────

describe("computeOsActiveUntil", () => {
  it("should return now + the effect window", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    expect(computeOsActiveUntil(FURY, now).toISOString()).toBe("2026-08-30T12:01:00.000Z");
    expect(computeOsActiveUntil(SURGE, now).toISOString()).toBe("2026-08-30T12:00:30.000Z");
  });

  it("should return now for an inert OS (never activated anyway)", () => {
    const now = new Date("2026-08-30T12:00:00.000Z");
    expect(computeOsActiveUntil(GAZUA, now).toISOString()).toBe(now.toISOString());
  });
});

// ─── canActivateOs ──────────────────────────────────────────────────────────

describe("canActivateOs", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");
  const today = new Date("2026-08-30T00:00:00.000Z");

  it("should allow activation when the OS is ready", () => {
    expect(canActivateOs(FURY, null, 0, null, now)).toEqual({ canActivate: true });
  });

  it("should reject an inert OS (Gazuá) with reason inert", () => {
    expect(canActivateOs(GAZUA, null, 0, null, now)).toEqual({
      canActivate: false,
      reason: "inert",
    });
  });

  it("should reject while the effect window is running", () => {
    const activeUntil = new Date(now.getTime() + 30_000);
    expect(canActivateOs(FURY, activeUntil, 0, null, now)).toEqual({
      canActivate: false,
      reason: "already_active",
    });
  });

  it("should allow activation when the window has expired", () => {
    const expired = new Date(now.getTime() - 1_000);
    expect(canActivateOs(FURY, expired, 0, null, now)).toEqual({ canActivate: true });
  });

  it("should reject when the daily charges are exhausted", () => {
    expect(canActivateOs(FURY, null, 3, today, now)).toEqual({
      canActivate: false,
      reason: "no_uses_left",
    });
  });

  it("should allow activation after the UTC-midnight reset even with a full counter", () => {
    const yesterday = new Date("2026-08-29T00:00:00.000Z");
    expect(canActivateOs(FURY, null, 3, yesterday, now)).toEqual({ canActivate: true });
  });
});

// ─── getOsActiveBonus ───────────────────────────────────────────────────────

describe("getOsActiveBonus", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("should return null when no OS is installed", () => {
    expect(getOsActiveBonus(null, new Date(now.getTime() + 10_000), now)).toBeNull();
  });

  it("should return null when the OS is not active", () => {
    expect(getOsActiveBonus("os-fury", null, now)).toBeNull();
  });

  it("should return null when the window has expired", () => {
    expect(getOsActiveBonus("os-fury", new Date(now.getTime() - 1_000), now)).toBeNull();
  });

  it("should return null for an unknown slug", () => {
    expect(
      getOsActiveBonus("os-fury" as never, new Date(now.getTime() + 10_000), now),
    ).not.toBeNull();
    expect(
      getOsActiveBonus("os-unknown" as never, new Date(now.getTime() + 10_000), now),
    ).toBeNull();
  });

  it("should return null for an inert OS even while its (zero) window is running", () => {
    expect(getOsActiveBonus("os-gazuah", new Date(now.getTime() + 10_000), now)).toBeNull();
  });

  it("should return Fúria multipliers while active (1.0 for unaffected stats)", () => {
    expect(getOsActiveBonus("os-fury", new Date(now.getTime() + 10_000), now)).toEqual({
      bodyMultiplier: 1.5,
      reflexesMultiplier: 1,
      dodgeMultiplier: 1,
    });
  });

  it("should return Surto multipliers while active", () => {
    expect(getOsActiveBonus("os-surge", new Date(now.getTime() + 10_000), now)).toEqual({
      bodyMultiplier: 1,
      reflexesMultiplier: 1.5,
      dodgeMultiplier: 1.25,
    });
  });
});