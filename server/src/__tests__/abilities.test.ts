import { describe, it, expect } from "vitest";
import type { Role } from "@neon-dusk/shared";
import {
  ABILITY_COOLDOWNS,
  canActivateAbility,
  canRunSecondGig,
  computeActivation,
  computeConsumption,
  getCombatTranceBonus,
  getOverclockBonus,
  getSilverTongueBonus,
  resolveAbilityState,
} from "../game/abilities";

// ND-065 — unit tests for the pure role-ability game logic (no DB, no mocks).
// Conforme 04-sistemas-e-progressao.md: 5 role abilities with a
// READY → ACTIVE → COOLDOWN state machine. `now` is injected everywhere
// so every test is deterministic.

const NOW = new Date("2026-08-08T12:00:00.000Z");
const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** now + n ms */
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs);

// ─── resolveAbilityState ────────────────────────────────────────────────────

describe("resolveAbilityState", () => {
  it("should return ready when both timestamps are null", () => {
    expect(resolveAbilityState("bicho", null, null, NOW)).toEqual({
      state: "ready",
      activeUntil: null,
      cooldownUntil: null,
    });
  });

  it("should return active when activeUntil is in the future", () => {
    const activeUntil = at(5 * MIN);
    expect(resolveAbilityState("bicho", activeUntil, null, NOW)).toEqual({
      state: "active",
      activeUntil,
      cooldownUntil: null,
    });
  });

  it("should return cooldown when cooldownUntil is in the future", () => {
    const cooldownUntil = at(2 * HOUR);
    expect(resolveAbilityState("bicho", null, cooldownUntil, NOW)).toEqual({
      state: "cooldown",
      activeUntil: null,
      cooldownUntil,
    });
  });

  it("should return ready when the cooldown has expired", () => {
    expect(resolveAbilityState("bicho", null, at(-1), NOW)).toEqual({
      state: "ready",
      activeUntil: null,
      cooldownUntil: null,
    });
  });

  it("should auto-transition an expired Combat Trance to cooldown", () => {
    const activeUntil = at(-MIN); // expired 1 min ago
    const result = resolveAbilityState("bicho", activeUntil, null, NOW);
    expect(result.state).toBe("cooldown");
    expect(result.activeUntil).toBeNull();
    // cooldown starts when the effect ended: activeUntil + 4h
    expect(result.cooldownUntil).toEqual(
      new Date(activeUntil.getTime() + ABILITY_COOLDOWNS.combat_trance),
    );
    expect(result.cooldownUntil!.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it("should leave a one-shot ability active when activeUntil is in the past", () => {
    const activeUntil = at(-MIN); // overclock: consumed explicitly, not auto
    expect(resolveAbilityState("gambiarrista", activeUntil, null, NOW)).toEqual({
      state: "active",
      activeUntil,
      cooldownUntil: null,
    });
  });

  it("should return ready when both timestamps are in the past", () => {
    expect(resolveAbilityState("bicho", at(-HOUR), at(-MIN), NOW)).toEqual({
      state: "ready",
      activeUntil: null,
      cooldownUntil: null,
    });
  });
});

// ─── canActivateAbility ──────────────────────────────────────────────────────

describe("canActivateAbility", () => {
  it("should allow activation when ready", () => {
    expect(canActivateAbility("bicho", null, null, NOW)).toEqual({
      canActivate: true,
    });
  });

  it("should reject with reason 'cooldown' when cooling down", () => {
    expect(canActivateAbility("bicho", null, at(HOUR), NOW)).toEqual({
      canActivate: false,
      reason: "cooldown",
    });
  });

  it("should reject with reason 'already_active' when active", () => {
    expect(canActivateAbility("bicho", at(MIN), null, NOW)).toEqual({
      canActivate: false,
      reason: "already_active",
    });
  });

  it("should reject vulto with reason 'phase2' regardless of state", () => {
    expect(canActivateAbility("vulto", null, null, NOW)).toEqual({
      canActivate: false,
      reason: "phase2",
    });
    expect(canActivateAbility("vulto", at(MIN), null, NOW)).toEqual({
      canActivate: false,
      reason: "phase2",
    });
  });
});

// ─── computeActivation ───────────────────────────────────────────────────────

describe("computeActivation", () => {
  it("should give Combat Trance a 30-min window and a cooldown 4h after it ends", () => {
    const result = computeActivation("bicho", NOW);
    expect(result.abilityType).toBe("combat_trance");
    expect(result.activeUntil).toEqual(at(30 * MIN));
    expect(result.cooldownUntil).toEqual(at(30 * MIN + ABILITY_COOLDOWNS.combat_trance));
  });

  it("should give Overclock a one-shot flag and a 24h cooldown starting immediately", () => {
    const result = computeActivation("gambiarrista", NOW);
    expect(result.abilityType).toBe("overclock");
    expect(result.activeUntil).toEqual(NOW); // flag, not a timer
    expect(result.cooldownUntil).toEqual(at(DAY));
  });

  it("should give Silver Tongue a one-shot flag and a 12h cooldown", () => {
    const result = computeActivation("despachante", NOW);
    expect(result.abilityType).toBe("silver_tongue");
    expect(result.activeUntil).toEqual(NOW);
    expect(result.cooldownUntil).toEqual(at(12 * HOUR));
  });

  it("should give Long Haul a one-shot flag and a 6h cooldown", () => {
    const result = computeActivation("estradeiro", NOW);
    expect(result.abilityType).toBe("long_haul");
    expect(result.activeUntil).toEqual(NOW);
    expect(result.cooldownUntil).toEqual(at(6 * HOUR));
  });
});

// ─── getCombatTranceBonus ────────────────────────────────────────────────────

describe("getCombatTranceBonus", () => {
  it("should return 1.25 multipliers when a bicho's trance is active", () => {
    expect(getCombatTranceBonus("bicho", at(MIN), null, NOW)).toEqual({
      bodyMultiplier: 1.25,
      reflexesMultiplier: 1.25,
    });
  });

  it("should return null when not active", () => {
    expect(getCombatTranceBonus("bicho", null, null, NOW)).toBeNull();
  });

  it("should return null for a non-bicho role even when its ability is active", () => {
    expect(getCombatTranceBonus("gambiarrista", at(MIN), null, NOW)).toBeNull();
  });
});

// ─── getOverclockBonus ───────────────────────────────────────────────────────

describe("getOverclockBonus", () => {
  it("should return cost 0.5 and zero humanity cost when a gambiarrista is active", () => {
    expect(getOverclockBonus("gambiarrista", at(MIN), null, NOW)).toEqual({
      costMultiplier: 0.5,
      humanityCost: 0,
    });
  });

  it("should return null when not active", () => {
    expect(getOverclockBonus("gambiarrista", null, null, NOW)).toBeNull();
  });

  it("should return null for a non-gambiarrista role even when its ability is active", () => {
    expect(getOverclockBonus("bicho", at(MIN), null, NOW)).toBeNull();
  });
});

// ─── getSilverTongueBonus ────────────────────────────────────────────────────

describe("getSilverTongueBonus", () => {
  it("should return eddie 1.5 and SC 1.25 multipliers when a despachante is active", () => {
    expect(getSilverTongueBonus("despachante", at(MIN), null, NOW)).toEqual({
      eddieMultiplier: 1.5,
      scMultiplier: 1.25,
    });
  });

  it("should return null when not active", () => {
    expect(getSilverTongueBonus("despachante", null, null, NOW)).toBeNull();
  });

  it("should return null for a non-despachante role even when its ability is active", () => {
    expect(getSilverTongueBonus("estradeiro", at(MIN), null, NOW)).toBeNull();
  });
});

// ─── canRunSecondGig ─────────────────────────────────────────────────────────

describe("canRunSecondGig", () => {
  it("should return false when Long Haul is not active", () => {
    expect(canRunSecondGig("estradeiro", null, null, 1, NOW)).toBe(false);
  });

  it("should return false when already at 2 active trampos", () => {
    expect(canRunSecondGig("estradeiro", at(MIN), null, 2, NOW)).toBe(false);
  });

  it("should return true when active and below 2 active trampos", () => {
    expect(canRunSecondGig("estradeiro", at(MIN), null, 1, NOW)).toBe(true);
  });

  it("should return false for a non-estradeiro role even with an active ability", () => {
    expect(canRunSecondGig("despachante", at(MIN), null, 1, NOW)).toBe(false);
  });
});

// ─── computeConsumption ──────────────────────────────────────────────────────

describe("computeConsumption", () => {
  it("should clear activeUntil for every role", () => {
    for (const role of ["bicho", "vulto", "gambiarrista", "despachante", "estradeiro"] as const) {
      expect(computeConsumption(role, NOW).activeUntil).toBeNull();
    }
  });

  it("should set the cooldown per role (4h/8h/24h/12h/6h)", () => {
    const expected: Record<Role, number> = {
      bicho: 4 * HOUR,
      vulto: 8 * HOUR,
      gambiarrista: DAY,
      despachante: 12 * HOUR,
      estradeiro: 6 * HOUR,
    };
    for (const role of Object.keys(expected) as Role[]) {
      expect(computeConsumption(role, NOW).cooldownUntil).toEqual(at(expected[role]));
    }
  });
});
