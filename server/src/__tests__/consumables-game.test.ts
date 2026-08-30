import { describe, it, expect } from "vitest";
import {
  BAND_CAP,
  CONSUMABLE_MULTIPLIERS,
  MAX_DAILY_USES,
  canUseConsumable,
  computeRestore,
  computeRestoreMultiplier,
  isValidConsumable,
} from "../game/consumables";
import { CONSUMABLE_CATALOG } from "../content/consumables";
import { VENDOR_SEED } from "../content/vendor-inventories";

// Issue #28 — unit tests for the itens anti-insanidade game logic (pure
// functions, no DB). Follows the design delta: global rolling-24h diminishing
// returns (100/60/30%, 4th use blocked), BAND_CAP=70, flatline gate, and the
// economic ratio anchor (G$/pt between 1.5x and 2.0x the clinic anchor).

// ─── Constants ──────────────────────────────────────────────────────────────

describe("consumables constants", () => {
  it("should define the diminishing-returns multipliers [1.0, 0.6, 0.3]", () => {
    expect(CONSUMABLE_MULTIPLIERS).toEqual([1.0, 0.6, 0.3]);
  });

  it("should cap daily uses at 3 and the band gate at 70", () => {
    expect(MAX_DAILY_USES).toBe(3);
    expect(BAND_CAP).toBe(70);
  });
});

// ─── computeRestoreMultiplier ───────────────────────────────────────────────

describe("computeRestoreMultiplier", () => {
  it("should return 1.0 for the first use (0 uses in window)", () => {
    expect(computeRestoreMultiplier(0)).toBe(1.0);
  });

  it("should return 0.6 for the second use", () => {
    expect(computeRestoreMultiplier(1)).toBe(0.6);
  });

  it("should return 0.3 for the third use", () => {
    expect(computeRestoreMultiplier(2)).toBe(0.3);
  });

  it("should return 0 for the fourth use and beyond", () => {
    expect(computeRestoreMultiplier(3)).toBe(0);
    expect(computeRestoreMultiplier(10)).toBe(0);
  });

  it("should return 1.0 for a negative counter (defensive)", () => {
    expect(computeRestoreMultiplier(-1)).toBe(1.0);
  });
});

// ─── computeRestore ─────────────────────────────────────────────────────────

describe("computeRestore", () => {
  it("should restore the full base amount on the first use", () => {
    expect(computeRestore(5, 1.0, 50)).toBe(5);
  });

  it("should restore 60% rounded on the second use", () => {
    expect(computeRestore(5, 0.6, 50)).toBe(3); // round(3.0)
    expect(computeRestore(10, 0.6, 50)).toBe(6);
  });

  it("should restore 30% rounded on the third use", () => {
    expect(computeRestore(5, 0.3, 50)).toBe(2); // round(1.5)
    expect(computeRestore(10, 0.3, 50)).toBe(3);
  });

  it("should restore 0 when the multiplier is 0 (blocked use)", () => {
    expect(computeRestore(5, 0, 50)).toBe(0);
  });

  it("should cap the restore so humanity never exceeds 100", () => {
    expect(computeRestore(10, 1.0, 95)).toBe(5);
    expect(computeRestore(15, 1.0, 90)).toBe(10);
  });

  it("should restore 0 when humanity is already at 100", () => {
    expect(computeRestore(10, 1.0, 100)).toBe(0);
  });

  it("should allow the full restore for a negative humanity (defensive)", () => {
    expect(computeRestore(5, 1.0, -10)).toBe(5);
  });
});

// ─── canUseConsumable ───────────────────────────────────────────────────────

describe("canUseConsumable", () => {
  const now = new Date("2026-08-30T12:00:00.000Z");

  it("should allow a use when every gate is clear", () => {
    expect(
      canUseConsumable({ humanity: 50, isFlatlined: false, usesInWindow: 0, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: true });
  });

  it("should allow a use in Cyberpsycho (1-20) — the safety net where the danger is highest", () => {
    expect(
      canUseConsumable({ humanity: 10, isFlatlined: false, usesInWindow: 0, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: true });
  });

  it("should block a flatlined character even in Cyberpsycho", () => {
    expect(
      canUseConsumable({ humanity: 10, isFlatlined: true, usesInWindow: 0, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: false, reason: "FLATLINED" });
  });

  it("should block humanity above the band cap (Íntegro)", () => {
    expect(
      canUseConsumable({ humanity: 71, isFlatlined: false, usesInWindow: 0, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: false, reason: "BAND_TOO_HIGH" });
  });

  it("should allow humanity exactly at the band cap (70)", () => {
    expect(
      canUseConsumable({ humanity: 70, isFlatlined: false, usesInWindow: 0, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: true });
  });

  it("should block while the item cooldown is running", () => {
    const cooldownUntil = new Date(now.getTime() + 60_000);
    expect(
      canUseConsumable({ humanity: 50, isFlatlined: false, usesInWindow: 0, itemCooldownUntil: cooldownUntil, now }),
    ).toEqual({ allowed: false, reason: "COOLDOWN_ACTIVE" });
  });

  it("should allow a use when the item cooldown has expired", () => {
    const cooldownUntil = new Date(now.getTime() - 1_000);
    expect(
      canUseConsumable({ humanity: 50, isFlatlined: false, usesInWindow: 0, itemCooldownUntil: cooldownUntil, now }),
    ).toEqual({ allowed: true });
  });

  it("should block the 4th use in the rolling 24h window", () => {
    expect(
      canUseConsumable({ humanity: 50, isFlatlined: false, usesInWindow: 3, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: false, reason: "DIMINISHING_RETURNS_EXHAUSTED" });
  });

  it("should allow the 3rd use (2 in window) with the 30% multiplier", () => {
    expect(
      canUseConsumable({ humanity: 50, isFlatlined: false, usesInWindow: 2, itemCooldownUntil: null, now }),
    ).toEqual({ allowed: true });
  });
});

// ─── isValidConsumable ──────────────────────────────────────────────────────

describe("isValidConsumable", () => {
  const valid = {
    id: "00000000-0000-4000-8000-000000000000",
    slug: "estabilizador",
    name: "Estabilizador",
    tier: 1,
    restoreAmount: 5,
    cooldownHours: 0,
  };

  it("should accept a well-formed catalog entry", () => {
    expect(isValidConsumable(valid)).toBe(true);
  });

  it("should reject a zero restore amount", () => {
    expect(isValidConsumable({ ...valid, restoreAmount: 0 })).toBe(false);
  });

  it("should reject a negative cooldown", () => {
    expect(isValidConsumable({ ...valid, cooldownHours: -1 })).toBe(false);
  });

  it("should reject tiers outside 1-3", () => {
    expect(isValidConsumable({ ...valid, tier: 0 })).toBe(false);
    expect(isValidConsumable({ ...valid, tier: 4 })).toBe(false);
  });
});

// ─── Economic ratio (delta criterion 4) ─────────────────────────────────────
// G$/pt between 1.5x and 2.0x the clinic anchor (1.000 G$/pt). Prices live in
// vendor_inventory (ADR 28-C); the effect lives in the consumables catalog.

describe("economic ratio (G$/pt vs clinic anchor)", () => {
  const CLINIC_ANCHOR_G_PER_PT = 1000;

  it("should price every sanity item between 1.5x and 2.0x the clinic anchor", () => {
    // Build slug → price from the vendor seed (the canonical price source).
    const priceBySlug = new Map<string, number>();
    for (const vendor of VENDOR_SEED) {
      for (const inv of vendor.inventory) {
        if (inv.itemType === "CONSUMABLE") priceBySlug.set(inv.itemId, inv.price);
      }
    }

    for (const item of CONSUMABLE_CATALOG) {
      const price = priceBySlug.get(item.slug);
      expect(price, `preço de ${item.slug} deve existir em vendor_inventory`).toBeDefined();
      const gPerPt = price! / item.restoreAmount;
      expect(gPerPt).toBeGreaterThanOrEqual(1.5 * CLINIC_ANCHOR_G_PER_PT);
      expect(gPerPt).toBeLessThanOrEqual(2.0 * CLINIC_ANCHOR_G_PER_PT);
    }
  });

  it("should keep the clinic as the economical option (items are a convenience premium)", () => {
    const priceBySlug = new Map<string, number>();
    for (const vendor of VENDOR_SEED) {
      for (const inv of vendor.inventory) {
        if (inv.itemType === "CONSUMABLE") priceBySlug.set(inv.itemId, inv.price);
      }
    }
    for (const item of CONSUMABLE_CATALOG) {
      const gPerPt = priceBySlug.get(item.slug)! / item.restoreAmount;
      expect(gPerPt).toBeGreaterThan(CLINIC_ANCHOR_G_PER_PT);
    }
  });
});