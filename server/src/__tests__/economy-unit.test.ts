import { describe, it, expect } from "vitest";
import {
  calculatePrice,
  rollLoot,
  transferEddies,
  type LootTableEntry,
  type WalletState,
} from "../game/economy";

// ND-010 — unit tests for the pure economy game logic (no DB, no mocks).
// Covers transferEddies, calculatePrice and rollLoot edge cases.

const baseWallet = (overrides: Partial<WalletState> = {}): WalletState => ({
  balance: 1000,
  escrow: 0,
  lifetimeEarned: 1000,
  lifetimeSpent: 0,
  version: 4,
  ...overrides,
});

const tx = { type: "GIG_PAYOUT" as const, source: "test" };

/** Deterministic seeded PRNG (mulberry32) so loot rolls are reproducible. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("transferEddies", () => {
  it("should credit the balance and lifetime_earned, leaving lifetime_spent unchanged", () => {
    const result = transferEddies(baseWallet(), 250, tx);

    expect(result.wallet.balance).toBe(1250);
    expect(result.wallet.lifetimeEarned).toBe(1250);
    expect(result.wallet.lifetimeSpent).toBe(0);
  });

  it("should debit the balance and lifetime_spent (absolute value), leaving lifetime_earned unchanged", () => {
    const result = transferEddies(baseWallet(), -300, tx);

    expect(result.wallet.balance).toBe(700);
    expect(result.wallet.lifetimeEarned).toBe(1000);
    expect(result.wallet.lifetimeSpent).toBe(300);
  });

  it("should throw when the balance would go negative", () => {
    expect(() => transferEddies(baseWallet(), -1001, tx)).toThrow("Insufficient funds");
    // Exact boundary is fine: 1000 - 1000 = 0
    expect(() => transferEddies(baseWallet(), -1000, tx)).not.toThrow();
  });

  it("should throw when the amount is zero", () => {
    expect(() => transferEddies(baseWallet(), 0, tx)).toThrow("Amount cannot be zero");
  });

  it("should not mutate the original wallet (immutability)", () => {
    const original = baseWallet();
    const snapshot = { ...original };

    transferEddies(original, 100, tx);
    transferEddies(original, -100, tx);

    expect(original).toEqual(snapshot);
  });

  it("should record correct balanceBefore and balanceAfter in the transaction", () => {
    const result = transferEddies(baseWallet({ balance: 500 }), -200, tx);

    expect(result.transaction.balanceBefore).toBe(500);
    expect(result.transaction.balanceAfter).toBe(300);
    expect(result.transaction.amount).toBe(-200);
    expect(result.transaction.source).toBe("test");
    expect(result.transaction.type).toBe("GIG_PAYOUT");
  });

  it("should allow a credit that brings a deficit balance exactly to zero", () => {
    const result = transferEddies(baseWallet({ balance: -50 }), 50, tx);

    expect(result.wallet.balance).toBe(0);
    expect(result.transaction.balanceBefore).toBe(-50);
    expect(result.transaction.balanceAfter).toBe(0);
  });

  it("should carry over escrow and version untouched", () => {
    const result = transferEddies(baseWallet({ escrow: 120, version: 9 }), 10, tx);

    expect(result.wallet.escrow).toBe(120);
    expect(result.wallet.version).toBe(9);
  });
});

describe("calculatePrice", () => {
  it("should return the rounded base price when no modifiers are given", () => {
    expect(calculatePrice(100)).toBe(100);
    expect(calculatePrice(99.5)).toBe(100);
    expect(calculatePrice(100, {})).toBe(100);
    expect(calculatePrice(100, undefined)).toBe(100);
  });

  it("should apply the role discount (0.9 = 10% off)", () => {
    expect(calculatePrice(100, { roleDiscount: 0.9 })).toBe(90);
  });

  it("should apply the district markup (1.2 = 20% extra)", () => {
    expect(calculatePrice(100, { districtMarkup: 1.2 })).toBe(120);
  });

  it("should apply the scarcity premium (1.5 = 50% extra)", () => {
    expect(calculatePrice(100, { scarcity: 1.5 })).toBe(150);
  });

  it("should multiply all modifiers together", () => {
    // 100 * 0.9 * 1.2 * 1.5 = 162
    expect(calculatePrice(100, { roleDiscount: 0.9, districtMarkup: 1.2, scarcity: 1.5 })).toBe(162);
  });

  it("should always return a whole number (Math.round)", () => {
    expect(calculatePrice(99, { districtMarkup: 1.07 })).toBe(106); // 105.93
    expect(Number.isInteger(calculatePrice(7, { scarcity: 1.37 }))).toBe(true); // 9.59
  });

  it("should return 0 for a zero base price even with modifiers", () => {
    expect(calculatePrice(0, { roleDiscount: 0.9, districtMarkup: 1.2, scarcity: 1.5 })).toBe(0);
  });

  it("should ignore modifiers that are absent (no implicit multipliers)", () => {
    expect(calculatePrice(200, { roleDiscount: 0.5 })).toBe(100);
  });
});

describe("rollLoot", () => {
  const entry = (overrides: Partial<LootTableEntry> = {}): LootTableEntry => ({
    itemType: "weapon",
    itemId: "nova-9",
    weight: 10,
    minQuantity: 1,
    maxQuantity: 1,
    ...overrides,
  });

  it("should always return the single entry of a single-entry table", () => {
    const rng = seededRng(1);
    for (let i = 0; i < 50; i++) {
      expect(rollLoot([entry()], rng)).toEqual([
        { itemType: "weapon", itemId: "nova-9", quantity: 1 },
      ]);
    }
  });

  it("should never select an entry with weight 0", () => {
    const table = [
      entry({ itemId: "never", weight: 0 }),
      entry({ itemId: "always", weight: 1 }),
    ];
    // Force many rolls over the full [0, totalWeight) range.
    for (let i = 0; i < 200; i++) {
      const [roll] = rollLoot(table, () => (i % 100) / 100);
      expect(roll.itemId).toBe("always");
    }
  });

  it("should return the correct itemType/itemId/quantity for a weighted selection", () => {
    const table = [entry({ itemType: "ammo", itemId: "ap-rounds", minQuantity: 2, maxQuantity: 2 })];
    const [roll] = rollLoot(table, seededRng(42));

    expect(roll.itemType).toBe("ammo");
    expect(roll.itemId).toBe("ap-rounds");
    expect(roll.quantity).toBe(2);
  });

  it("should keep quantity within [minQuantity, maxQuantity] inclusive", () => {
    const table = [entry({ minQuantity: 3, maxQuantity: 7 })];
    const rng = seededRng(7);

    for (let i = 0; i < 500; i++) {
      const [roll] = rollLoot(table, rng);
      expect(roll.quantity).toBeGreaterThanOrEqual(3);
      expect(roll.quantity).toBeLessThanOrEqual(7);
    }
  });

  it("should return an empty array for an empty table", () => {
    expect(rollLoot([])).toEqual([]);
  });

  it("should return an empty array when the total weight is zero or negative", () => {
    expect(rollLoot([entry({ weight: 0 }), entry({ weight: 0 })])).toEqual([]);
    expect(rollLoot([entry({ weight: -1 }), entry({ weight: 0 })])).toEqual([]);
  });

  it("should produce deterministic output for a seeded RNG", () => {
    const seed = 12345;
    const table = [
      entry({ itemId: "a", weight: 3, minQuantity: 1, maxQuantity: 2 }),
      entry({ itemId: "b", weight: 1, minQuantity: 4, maxQuantity: 9 }),
    ];

    const first = rollLoot(table, seededRng(seed));
    const second = rollLoot(table, seededRng(seed));

    expect(first).toEqual(second);
  });

  it("should have a roughly uniform distribution for equal weights (10k samples)", () => {
    const table = [
      entry({ itemId: "heads", weight: 1 }),
      entry({ itemId: "tails", weight: 1 }),
    ];
    const counts = { heads: 0, tails: 0 };

    for (let i = 0; i < 10_000; i++) {
      const [roll] = rollLoot(table, Math.random);
      counts[roll.itemId as "heads" | "tails"] += 1;
    }

    // p = 0.5, n = 10k → σ ≈ 50; a ±6σ band [4700, 5300] is safe from flakiness
    // while still catching a badly biased selection.
    expect(counts.heads).toBeGreaterThanOrEqual(4700);
    expect(counts.heads).toBeLessThanOrEqual(5300);
    expect(counts.tails).toBeGreaterThanOrEqual(4700);
    expect(counts.tails).toBeLessThanOrEqual(5300);
  });

  it("should fall back to the last entry when the roll lands exactly on the boundary", () => {
    // rng() returning 1.0 makes roll === totalWeight, which is never < cumulative.
    const table = [entry({ itemId: "first", weight: 5 }), entry({ itemId: "last", weight: 5 })];
    const [roll] = rollLoot(table, () => 1.0);

    expect(roll.itemId).toBe("last");
    expect(roll.quantity).toBe(1); // fallback uses minQuantity
  });
});
