import { describe, it, expect } from "vitest";
import type { ChromeBonuses } from "@neon-dusk/shared";
import {
  calculateChromePower,
  calculateCombatPower,
  calculateLoot,
  calculateLoserSC,
  calculateWinnerSC,
  hasNoobShield,
  isDefeatCapped,
  isGriefLimited,
  isImmune,
  resolveCombat,
} from "../game/pvp";
import { transferEddies } from "../game/economy";

// ND-014 — unit tests for the pure PvP game logic (no DB, no mocks).
// Conforme 04-sistemas-e-progressao.md §6: combat power, loot, Moral,
// grief/defeat protections. RNG is injected so every formula is deterministic.

const DAY_MS = 86_400_000;

function chrome(bonuses: ChromeBonuses) {
  return { bonuses };
}

// ─── calculateChromePower ────────────────────────────────────────────────────

describe("calculateChromePower", () => {
  it("should return 0 for no installed chrome", () => {
    expect(calculateChromePower([])).toBe(0);
  });

  it("should sum the body bonus of a single implant", () => {
    expect(calculateChromePower([chrome({ body: 2 })])).toBe(2);
  });

  it("should sum body and reflexes bonuses across multiple implants", () => {
    const installed = [chrome({ body: 2, reflexes: 3 }), chrome({ body: 1, reflexes: 1 })];
    expect(calculateChromePower(installed)).toBe(7);
  });

  it("should ignore bonuses to non-combat stats (intelligence, cool, technical)", () => {
    const installed = [chrome({ intelligence: 4, cool: 5, technical: 3 })];
    expect(calculateChromePower(installed)).toBe(0);
  });

  it("should treat missing/undefined body and reflexes as 0", () => {
    expect(calculateChromePower([chrome({})])).toBe(0);
    expect(calculateChromePower([chrome({ body: undefined })])).toBe(0);
    expect(calculateChromePower([chrome({ cool: 2, max_hp: 10 })])).toBe(0);
  });

  it("should mix combat and non-combat bonuses, summing only body + reflexes", () => {
    const installed = [chrome({ body: 2, intelligence: 9 }), chrome({ reflexes: 3, cool: 1 })];
    expect(calculateChromePower(installed)).toBe(5);
  });
});

// ─── calculateCombatPower ────────────────────────────────────────────────────

describe("calculateCombatPower", () => {
  it("should be body + reflexes + chrome + 1 on the minimum random roll (rng 0)", () => {
    const power = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 3,
      role: "netrunner",
      rng: () => 0,
    });
    expect(power).toBe(19); // 10 + 5 + 3 + 1
  });

  it("should be body + reflexes + chrome + 10 on the maximum random roll (rng 0.99)", () => {
    const power = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 3,
      role: "netrunner",
      rng: () => 0.99,
    });
    expect(power).toBe(28); // 10 + 5 + 3 + 10
  });

  it("should roll a middle value (rng 0.5 → +6)", () => {
    const power = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 0,
      role: "netrunner",
      rng: () => 0.5,
    });
    expect(power).toBe(21); // 15 + 6
  });

  it("should be 0 base + roll for zeroed attributes", () => {
    const power = calculateCombatPower({
      body: 0,
      reflexes: 0,
      chromePower: 0,
      role: "netrunner",
      rng: () => 0,
    });
    expect(power).toBe(1);
  });

  it("should stay within [base+1, base+10] over many rolls", () => {
    for (let i = 0; i < 200; i++) {
      const power = calculateCombatPower({
        body: 4,
        reflexes: 3,
        chromePower: 2,
        role: "netrunner",
        rng: Math.random,
      });
      expect(power).toBeGreaterThanOrEqual(10);
      expect(power).toBeLessThanOrEqual(19);
    }
  });
});

describe("calculateCombatPower — solo role bonus", () => {
  it("should apply the +10% bonus (rounded up) for solo role", () => {
    const solo = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 0,
      role: "solo",
      rng: () => 0.5, // random bonus 6 → base 21, crit check 0.5 > 0.05
    });
    expect(solo).toBe(24); // ceil(21 * 1.1)
  });

  it("should not apply the bonus for non-solo roles", () => {
    const netrunner = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 0,
      role: "netrunner",
      rng: () => 0.5,
    });
    expect(netrunner).toBe(21); // 21, no multiplier
  });

  it("should apply the same base roll to solo as non-solo before the multiplier", () => {
    const solo = calculateCombatPower({
      body: 8,
      reflexes: 4,
      chromePower: 2,
      role: "solo",
      rng: () => 0.5, // +6 → base 20
    });
    expect(solo).toBe(22); // ceil(20 * 1.1)
  });

  it("should apply Combat Trance +25% (rounded up) to body and reflexes before the solo multiplier", () => {
    // Feature #65: tranceActive boosts body and reflexes first: ceil(10 * 1.25) = 13 each
    const trance = calculateCombatPower({
      body: 10,
      reflexes: 10,
      chromePower: 0,
      role: "solo",
      tranceActive: true,
      rng: () => 0.5, // random bonus 6 → base 32
    });
    expect(trance).toBe(36); // ceil(32 * 1.1), no crit at 0.5
  });

  it("should ignore tranceActive for a non-solo role", () => {
    const fixer = calculateCombatPower({
      body: 10,
      reflexes: 10,
      chromePower: 0,
      role: "fixer",
      tranceActive: true,
      rng: () => 0.5, // random bonus 6 → base 26, no multipliers
    });
    expect(fixer).toBe(26);
  });
});

describe("calculateCombatPower — solo crit", () => {
  it("should trigger the crit (+50%) when rng lands at 4% (≤ 5%)", () => {
    const power = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 0,
      role: "solo",
      rng: () => 0.04, // roll +1 → 16, solo 18, crit → ceil(18 * 1.5)
    });
    expect(power).toBe(27);
  });

  it("should not trigger the crit when rng lands at 6% (> 5%)", () => {
    const power = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 0,
      role: "solo",
      rng: () => 0.06,
    });
    expect(power).toBe(18); // 16 → solo 18, no crit
  });

  it("should apply the multiplier only once when a crit triggers", () => {
    const power = calculateCombatPower({
      body: 2,
      reflexes: 2,
      chromePower: 0,
      role: "solo",
      rng: () => 0, // roll +1 → 5, solo ceil(5.5)=6, crit ceil(9)=9
    });
    expect(power).toBe(9);
  });

  it("should not crit for non-solo roles even at 4%", () => {
    const power = calculateCombatPower({
      body: 10,
      reflexes: 5,
      chromePower: 0,
      role: "fixer",
      rng: () => 0.04,
    });
    expect(power).toBe(16); // no multiplier, no crit path at all
  });
});

// ─── resolveCombat ───────────────────────────────────────────────────────────

describe("resolveCombat", () => {
  it("should declare the attacker the winner when power is strictly higher", () => {
    const result = resolveCombat({
      attacker: { body: 10, reflexes: 5, chromePower: 0, role: "netrunner", rng: () => 0 },
      defender: { body: 3, reflexes: 2, chromePower: 0, role: "netrunner", rng: () => 0 },
    });
    expect(result).toEqual({ winner: "attacker", attackerPower: 16, defenderPower: 6 });
  });

  it("should declare the defender the winner on a tie (equal power)", () => {
    const result = resolveCombat({
      attacker: { body: 5, reflexes: 4, chromePower: 0, role: "netrunner", rng: () => 0 },
      defender: { body: 5, reflexes: 4, chromePower: 0, role: "netrunner", rng: () => 0 },
    });
    expect(result.winner).toBe("defender");
    expect(result.attackerPower).toBe(10);
    expect(result.defenderPower).toBe(10);
  });

  it("should declare the defender the winner when the defender's power is higher", () => {
    const result = resolveCombat({
      attacker: { body: 3, reflexes: 2, chromePower: 0, role: "netrunner", rng: () => 0 },
      defender: { body: 10, reflexes: 5, chromePower: 0, role: "netrunner", rng: () => 0 },
    });
    expect(result.winner).toBe("defender");
  });

  it("should give the defender the win on a 0-0 stalemate", () => {
    const result = resolveCombat({
      attacker: { body: 0, reflexes: 0, chromePower: 0, role: "netrunner", rng: () => 0 },
      defender: { body: 0, reflexes: 0, chromePower: 0, role: "netrunner", rng: () => 0 },
    });
    expect(result.winner).toBe("defender");
  });
});

// ─── calculateLoot ───────────────────────────────────────────────────────────

describe("calculateLoot", () => {
  it("should take 10% of the loser's balance without a griefer penalty", () => {
    expect(calculateLoot(1000, false)).toBe(100);
  });

  it("should floor fractional loot (999 → 99)", () => {
    expect(calculateLoot(999, false)).toBe(99);
  });

  it("should return 0 for a zero balance", () => {
    expect(calculateLoot(0, false)).toBe(0);
  });

  it("should return 1% of the loser's balance with the griefer penalty", () => {
    expect(calculateLoot(1000, true)).toBe(10); // floor(100 * 0.1)
  });

  it("should floor the griefer loot too (999 → 9)", () => {
    expect(calculateLoot(999, true)).toBe(9); // floor(floor(99.9) * 0.1)
  });

  it("should never return a negative amount for a negative balance (defensive)", () => {
    expect(calculateLoot(-50, false)).toBe(0);
  });

  it("should return 0 for a tiny balance under both rates", () => {
    expect(calculateLoot(4, false)).toBe(0); // floor(0.4) = 0
    expect(calculateLoot(9, true)).toBe(0); // floor(floor(0.9) * 0.1) = 0
  });
});

// ─── calculateWinnerSC ───────────────────────────────────────────────────────

describe("calculateWinnerSC", () => {
  it("should award +5 to the winner", () => {
    expect(calculateWinnerSC(10)).toEqual({ newSC: 15, change: 5 });
  });

  it("should cap the winner at 100 (96 → 100, change 4)", () => {
    expect(calculateWinnerSC(96)).toEqual({ newSC: 100, change: 4 });
  });

  it("should award exactly the room left at 95", () => {
    expect(calculateWinnerSC(95)).toEqual({ newSC: 100, change: 5 });
  });

  it("should be a no-op at the 100 cap", () => {
    expect(calculateWinnerSC(100)).toEqual({ newSC: 100, change: 0 });
  });
});

// ─── calculateLoserSC ────────────────────────────────────────────────────────

describe("calculateLoserSC", () => {
  it("should lose 5% (min 1) without the noob shield: SC 50 → 48 (−2)", () => {
    expect(calculateLoserSC(50, 0)).toEqual({ newSC: 48, change: -2 });
  });

  it("should lose 1% (min 1) with the noob shield: SC 5 → 4 (−1)", () => {
    expect(calculateLoserSC(5, 0)).toEqual({ newSC: 4, change: -1 });
  });

  it("should lose a minimum of 1 from SC 1 → 0", () => {
    expect(calculateLoserSC(1, 0)).toEqual({ newSC: 0, change: -1 });
  });

  it("should be a no-op at SC 0", () => {
    expect(calculateLoserSC(0, 0)).toEqual({ newSC: 0, change: 0 });
  });

  it("should lose nothing when the defeat cap is active (≥ 3 losses today)", () => {
    expect(calculateLoserSC(50, 3)).toEqual({ newSC: 50, change: 0 });
    expect(calculateLoserSC(5, 3)).toEqual({ newSC: 5, change: 0 });
  });

  it("should apply normal loss on the 3rd loss boundary but not the 4th", () => {
    expect(calculateLoserSC(50, 2)).toEqual({ newSC: 48, change: -2 });
    expect(calculateLoserSC(50, 3)).toEqual({ newSC: 50, change: 0 });
  });

  it("should never drop below 0 even when the loss exceeds the balance", () => {
    const result = calculateLoserSC(1, 0);
    expect(result.newSC).toBeGreaterThanOrEqual(0);
  });
});

// ─── Protection guards ───────────────────────────────────────────────────────

describe("isImmune", () => {
  const now = new Date("2026-08-07T12:00:00.000Z");

  it("should return true for an account created 3 days ago (< 7 days)", () => {
    const created = new Date(now.getTime() - 3 * DAY_MS);
    expect(isImmune(created, now)).toBe(true);
  });

  it("should return false for an account created 10 days ago", () => {
    const created = new Date(now.getTime() - 10 * DAY_MS);
    expect(isImmune(created, now)).toBe(false);
  });

  it("should return false exactly at the 7-day boundary", () => {
    const created = new Date(now.getTime() - 7 * DAY_MS);
    expect(isImmune(created, now)).toBe(false);
  });

  it("should return true for a brand-new account (created now)", () => {
    expect(isImmune(now, now)).toBe(true);
  });

  it("should treat a future createdAt (clock skew) as immune", () => {
    const created = new Date(now.getTime() + DAY_MS);
    expect(isImmune(created, now)).toBe(true);
  });

  it("should accept ISO strings as well as Date objects", () => {
    expect(isImmune(new Date(now.getTime() - 3 * DAY_MS).toISOString(), now.toISOString())).toBe(true);
    expect(isImmune(new Date(now.getTime() - 10 * DAY_MS).toISOString(), now.toISOString())).toBe(false);
  });
});

describe("hasNoobShield", () => {
  it("should return true for SC below 10", () => {
    expect(hasNoobShield(0)).toBe(true);
    expect(hasNoobShield(5)).toBe(true);
    expect(hasNoobShield(9)).toBe(true);
  });

  it("should return false for SC at or above 10", () => {
    expect(hasNoobShield(10)).toBe(false);
    expect(hasNoobShield(15)).toBe(false);
    expect(hasNoobShield(50)).toBe(false);
  });
});

describe("isGriefLimited", () => {
  it("should return false below the 3-attack limit", () => {
    expect(isGriefLimited(0)).toBe(false);
    expect(isGriefLimited(2)).toBe(false);
  });

  it("should return true at the 3-attack limit and above", () => {
    expect(isGriefLimited(3)).toBe(true);
    expect(isGriefLimited(4)).toBe(true);
  });
});

describe("isDefeatCapped", () => {
  it("should return false below the 3-defeat limit", () => {
    expect(isDefeatCapped(0)).toBe(false);
    expect(isDefeatCapped(2)).toBe(false);
  });

  it("should return true at the 3-defeat limit and above", () => {
    expect(isDefeatCapped(3)).toBe(true);
    expect(isDefeatCapped(5)).toBe(true);
  });
});

// ─── Money conservation (loot math × transferEddies) ─────────────────────────

describe("PvP money conservation", () => {
  it("should preserve total wealth when loot moves from loser to winner", () => {
    const loserBalance = 1000;
    const winnerBalance = 500;
    const loot = calculateLoot(loserBalance, false);
    expect(loot).toBe(100);

    const loser = { balance: loserBalance, escrow: 0, lifetimeEarned: 1000, lifetimeSpent: 0, version: 0 };
    const winner = { balance: winnerBalance, escrow: 0, lifetimeEarned: 500, lifetimeSpent: 0, version: 0 };

    const debit = transferEddies(loser, -loot, { type: "PVP_LOSS", source: "Loot stolen in PvP" });
    const credit = transferEddies(winner, loot, { type: "PVP_REWARD", source: "Loot won in PvP" });

    // The loser's debit exactly equals the winner's credit.
    expect(loser.balance - debit.wallet.balance).toBe(loot);
    expect(credit.wallet.balance - winner.balance).toBe(loot);
    // Combined wealth is conserved.
    expect(debit.wallet.balance + credit.wallet.balance).toBe(loserBalance + winnerBalance);
    // Lifetime counters track the movement.
    expect(debit.wallet.lifetimeSpent).toBe(loot);
    expect(credit.wallet.lifetimeEarned).toBe(winnerBalance + loot);
  });

  it("should be unable to loot more than the loser holds (10% of balance)", () => {
    const loot = calculateLoot(999, false);
    expect(loot).toBeLessThanOrEqual(Math.floor(999 * 0.1));
    expect(loot).toBeGreaterThanOrEqual(0);
  });
});
