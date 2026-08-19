import type { TransactionType } from "@neon-dusk/shared";

// Neon Dusk — Economy game logic (pure functions, no DB access)
// ============================================================================
// All eddie math lives here so it is unit-testable and shared by services.
// Money is integers only (Grana); never floats.

/** Wallet state as of a persisted version. `escrow` is committed-but-unspendable. */
export interface WalletState {
  balance: number;
  escrow: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  version: number;
}

/** Metadata describing why a transfer happened (audit trail payload). */
export interface TransactionInput {
  type: TransactionType;
  source: string;
  referenceType?: string;
  referenceId?: string;
}

/** One weighted entry in a gig loot table. */
export interface LootTableEntry {
  itemType: string;
  itemId: string;
  weight: number;
  minQuantity: number;
  maxQuantity: number;
}

/** A single loot roll result. */
export interface LootRoll {
  itemType: string;
  itemId: string;
  quantity: number;
}

/**
 * Apply credit or debit to wallet state (immutable — returns new state).
 * amount > 0 = credit (earned), amount < 0 = debit (spent).
 * Throws when the amount is zero or would drive the balance negative.
 */
export function transferEddies(
  wallet: WalletState,
  amount: number,
  tx: TransactionInput,
): {
  wallet: WalletState;
  transaction: {
    characterId: string; // placeholder, filled by the service layer
    type: TransactionType;
    amount: number;
    balanceBefore: number;
    balanceAfter: number;
    source: string;
    referenceType?: string;
    referenceId?: string;
  };
} {
  if (amount === 0) throw new Error("Amount cannot be zero");

  const newBalance = wallet.balance + amount;
  if (newBalance < 0) throw new Error("Insufficient funds");

  const newWallet: WalletState = {
    ...wallet,
    balance: newBalance,
    lifetimeEarned: amount > 0 ? wallet.lifetimeEarned + amount : wallet.lifetimeEarned,
    lifetimeSpent: amount < 0 ? wallet.lifetimeSpent + Math.abs(amount) : wallet.lifetimeSpent,
  };

  return {
    wallet: newWallet,
    transaction: {
      characterId: "", // filled by the service layer
      type: tx.type,
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: newBalance,
      source: tx.source,
      referenceType: tx.referenceType,
      referenceId: tx.referenceId,
    },
  };
}

/**
 * Calculate final price with market modifiers, rounded to the nearest eddie.
 * Each modifier multiplies the price: 0.9 = 10% off, 1.2 = 20% markup.
 */
export function calculatePrice(
  basePrice: number,
  modifiers?: {
    roleDiscount?: number; // e.g. 0.9 = 10% off
    districtMarkup?: number; // e.g. 1.2 = 20% markup
    scarcity?: number; // e.g. 1.5 = 50% scarcity premium
  },
): number {
  let price = basePrice;
  if (modifiers?.roleDiscount) price *= modifiers.roleDiscount;
  if (modifiers?.districtMarkup) price *= modifiers.districtMarkup;
  if (modifiers?.scarcity) price *= modifiers.scarcity;
  return Math.round(price);
}

/**
 * Roll one loot item from a weighted table using weighted random selection.
 * Returns an empty array when the table has no positive weights.
 * Quantity is uniform between minQuantity and maxQuantity (inclusive).
 */
export function rollLoot(table: LootTableEntry[], rng: () => number = Math.random): LootRoll[] {
  const totalWeight = table.reduce((sum, entry) => sum + entry.weight, 0);
  if (totalWeight <= 0) return [];

  const roll = rng() * totalWeight;
  let cumulative = 0;

  for (const entry of table) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      const quantity =
        entry.minQuantity === entry.maxQuantity
          ? entry.minQuantity
          : Math.floor(rng() * (entry.maxQuantity - entry.minQuantity + 1)) + entry.minQuantity;
      return [{ itemType: entry.itemType, itemId: entry.itemId, quantity }];
    }
  }

  // Fallback — floating-point edge case; last entry keeps the roll valid.
  const last = table[table.length - 1];
  return [{ itemType: last.itemType, itemId: last.itemId, quantity: last.minQuantity }];
}
