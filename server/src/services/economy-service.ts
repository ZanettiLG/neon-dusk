import type { TransactionRecord, TransactionType, VendorRecord } from "@neon-dusk/shared";
import { NIL_SYN_CAFE_AMOUNT } from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import { calculatePrice, transferEddies, type WalletState } from "../game/economy";
import { calculateRegen } from "./nil-service";
import { withTransaction } from "../db";
import { characterRepository as characters } from "../repositories/character-repository";
import { walletRepository as wallets } from "../repositories/wallet-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { vendorRepository as vendors } from "../repositories/vendor-repository";
import { consumableRepository as consumables } from "../repositories/consumable-repository";
import type { TransactionRow } from "../repositories/transaction-repository";

// Neon Dusk — Economy service (orchestration over the pure game logic)
// ============================================================================
// Wallets use optimistic locking: every write bumps `version` and only
// commits if the row still matches the version read earlier. Concurrent
// writers get a CONCURRENCY error and the caller retries.
// Wallet/character persistence lives in the repositories (#158). Callers
// resolve character ids via `characters.requireByUserId` and seed wallets
// via `wallets.ensure` directly — no service-level shims.

/** Max attempts for optimistic-lock write retries (exponential backoff). */
const MAX_RETRIES = 3;

/** Sleep helper for retry backoff. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Map a raw transaction_log row (snake_case) to the public camelCase contract. */
function toPublicTransaction(row: TransactionRow): TransactionRecord {
  return {
    id: row.id,
    characterId: row.character_id,
    type: row.type,
    amount: row.amount,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
    source: row.source,
    referenceType: row.reference_type ?? null,
    referenceId: row.reference_id ?? null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/**
 * Get wallet (read-only, no lock). Auto-creates with seed capital on first
 * read so a brand-new character can always see their balance.
 */
export async function getWallet(characterId: string): Promise<WalletState> {
  const row = await wallets.getById(characterId);

  if (!row) {
    return withTransaction(async (trx) => wallets.ensure(characterId, trx));
  }

  return {
    balance: row.balance,
    escrow: row.escrow,
    lifetimeEarned: row.lifetime_earned,
    lifetimeSpent: row.lifetime_spent,
    version: row.version,
  };
}

/**
 * Transfer Grana with optimistic locking (version compare-and-swap).
 * Retries up to MAX_RETRIES times with exponential backoff on conflicts.
 * Throws AppError(400) on insufficient funds, AppError(409) on persistent
 * concurrency conflicts.
 */
export async function transfer(
  characterId: string,
  amount: number,
  type: TransactionType,
  source: string,
  referenceType?: string,
  referenceId?: string,
): Promise<{ wallet: WalletState; transaction: TransactionRecord }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await withTransaction(async (trx) => {
        // Read current wallet state (or seed it on first use)
        const row = await wallets.getById(characterId, trx);

        const wallet: WalletState = row
          ? {
              balance: row.balance,
              escrow: row.escrow,
              lifetimeEarned: row.lifetime_earned,
              lifetimeSpent: row.lifetime_spent,
              version: row.version,
            }
          : await wallets.ensure(characterId, trx);

        // Apply transfer via game logic. Escrow is committed but not spendable:
        // check available funds (balance − escrow) BEFORE the debit so a
        // check(escrow <= balance) violation surfaces as a clean 400, not a 500.
        if (amount < 0) {
          const availableFunds = wallet.balance - wallet.escrow;
          if (Math.abs(amount) > availableFunds) {
            throw new AppError(
              400,
              "INSUFFICIENT_FUNDS",
              `Precisa de G$ ${Math.abs(amount)} disponível, tem G$ ${availableFunds}.`,
            );
          }
        }
        const result = transferEddies(wallet, amount, { type, source, referenceType, referenceId });

        // Optimistic update with version check
        const updated = await wallets.updateOptimistic(
          characterId,
          wallet.version,
          {
            balance: result.wallet.balance,
            escrow: result.wallet.escrow,
            lifetime_earned: result.wallet.lifetimeEarned,
            lifetime_spent: result.wallet.lifetimeSpent,
          },
          trx,
        );

        if (!updated) {
          throw new Error("CONCURRENCY");
        }

        // Append audit entry
        const txLog = await transactions.insert(
          {
            character_id: characterId,
            type: result.transaction.type,
            amount: result.transaction.amount,
            balance_before: result.transaction.balanceBefore,
            balance_after: result.transaction.balanceAfter,
            source: result.transaction.source,
            reference_type: result.transaction.referenceType ?? null,
            reference_id: result.transaction.referenceId ?? null,
          },
          trx,
        );

        return {
          wallet: { ...result.wallet, version: updated.version },
          transaction: toPublicTransaction(txLog!),
        };
      });
    } catch (err) {
      if (err instanceof Error && err.message === "CONCURRENCY") {
        if (attempt < MAX_RETRIES - 1) {
          await sleep(10 * Math.pow(2, attempt));
          continue;
        }
        // Retries exhausted — surface the documented client-facing error.
        throw new AppError(
          409,
          "CONCURRENCY_CONFLICT",
          "Muitas operações concorrentes. Tente novamente.",
        );
      }
      if (err instanceof Error && err.message === "Insufficient funds") {
        throw new AppError(400, "INSUFFICIENT_FUNDS", "Grana insuficiente");
      }
      throw err;
    }
  }

  // Defensive: the loop above always returns or throws, but TS control-flow
  // analysis cannot prove it — keep an explicit terminal throw.
  throw new AppError(409, "CONCURRENCY_CONFLICT", "Muitas operações concorrentes. Tente novamente.");
}

/**
 * Get a character's transactions, newest first, with cursor-based pagination.
 * Returns one extra row internally to detect whether a next page exists.
 */
export async function getTransactions(
  characterId: string,
  limit: number = 20,
  cursor?: string,
): Promise<{ transactions: TransactionRecord[]; nextCursor: string | null }> {
  const rows = await transactions.listForCharacter(characterId, limit, cursor);

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? new Date(page[page.length - 1].created_at).toISOString()
    : null;

  return {
    transactions: page.map(toPublicTransaction),
    nextCursor,
  };
}

/**
 * List active vendors (id, name, type, district), ordered by name.
 */
export async function listVendors(): Promise<VendorRecord[]> {
  return vendors.list();
}

/**
 * Get one vendor with its full inventory. Throws AppError(404) when the
 * vendor does not exist.
 */
export async function getVendor(vendorId: string): Promise<{
  vendor: VendorRecord;
  inventory: Array<{
    id: string;
    vendorId: string;
    itemType: string;
    itemId: string;
    price: number;
    stock: number;
    chromeDefinitionId: string | null;
    chromeDefinitionName: string | null;
    humanityCost: number | null;
  }>;
}> {
  const vendor = await vendors.getById(vendorId);

  if (!vendor) throw new AppError(404, "VENDOR_NOT_FOUND", "Vendedor não encontrado");

  const inventory = await vendors.listInventory(vendorId);

  return {
    vendor: {
      id: vendor.id,
      name: vendor.name,
      type: vendor.type,
      district: vendor.district,
      description: vendor.description,
    },
    inventory,
  };
}

/**
 * Buy an item from a vendor. Runs in one PostgreSQL transaction: checks
 * stock, validates funds against the available balance (balance − escrow),
 * applies the debit with optimistic locking and records the audit entry.
 */
export async function buyFromVendor(
  characterId: string,
  vendorId: string,
  itemType: string,
  itemId: string,
  quantity: number,
): Promise<{
  balanceBefore: number;
  balanceAfter: number;
  item: {
    itemType: string;
    itemId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  };
}> {
  // Validate input
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new AppError(400, "INVALID_QUANTITY", "Quantidade deve ser um número inteiro positivo");
  }

  return withTransaction(async (trx) => {
    // 1. Get vendor item
    const item = await vendors.findStockItem(vendorId, itemType, itemId, trx);

    if (!item) throw new AppError(404, "ITEM_NOT_FOUND", "Item não encontrado neste vendedor");

    // 2. Check stock (stock >= 0 means limited, -1 means unlimited)
    if (item.stock >= 0 && item.stock < quantity) {
      throw new AppError(400, "OUT_OF_STOCK", `Apenas ${item.stock} disponíveis`);
    }

    // 3. Get wallet (seed on first use)
    const wallet = await wallets.ensure(characterId, trx);

    // 4. Calculate price
    const totalPrice = calculatePrice(item.price) * quantity;

    // 5. Check funds (escrow is committed but not spendable)
    const availableFunds = wallet.balance - wallet.escrow;
    if (availableFunds < totalPrice) {
      throw new AppError(
        400,
        "INSUFFICIENT_FUNDS",
        `Precisa de G$ ${totalPrice} disponível, tem G$ ${availableFunds}.`,
      );
    }

    // 6. Apply transfer via game logic
    const result = transferEddies(wallet, -totalPrice, {
      type: "VENDOR_PURCHASE",
      source: `Purchased ${quantity}x ${itemType}/${itemId} from vendor ${vendorId}`,
    });

    // 7. Update wallet with optimistic lock
    const updated = await wallets.updateOptimistic(
      characterId,
      wallet.version,
      {
        balance: result.wallet.balance,
        lifetime_spent: result.wallet.lifetimeSpent,
      },
      trx,
    );

    if (!updated) {
      throw new AppError(
        409,
        "CONCURRENCY_CONFLICT",
        "Concurrent modification detected. Try again.",
      );
    }

    // 8. Insert audit entry
    await transactions.insert(
      {
        character_id: characterId,
        type: "VENDOR_PURCHASE",
        amount: -totalPrice,
        balance_before: result.transaction.balanceBefore,
        balance_after: result.transaction.balanceAfter,
        source: result.transaction.source,
      },
      trx,
    );

    // 9. Decrement stock atomically (relative, guarded against oversell).
    // The UPDATE serializes concurrent buyers on the vendor_inventory row lock:
    // the second UPDATE blocks until the first commits, then re-reads the
    // committed stock and re-evaluates the WHERE. A stale absolute value can
    // never overwrite a correct one (fixes the concurrent-buyer lost update).
    if (item.stock >= 0) {
      // Repository method decrements atomically (relative, guarded against
      // oversell) and throws OUT_OF_STOCK if a concurrent buyer drained the
      // remaining stock after the step-2 pre-check. The transaction rolls
      // back the wallet debit and the audit entry.
      await vendors.decrementStock(item.id, quantity, trx);
    }

    // 10. Paid Pingado (itemId "syn-cafe") restores +20 NIL instantly, no cooldown.
    if (itemType === "CONSUMABLE" && itemId === "syn-cafe") {
      const character = await characters.findNilSnapshot(characterId, trx);

      if (character) {
        const { newNil: current } = calculateRegen(
          character.nil,
          character.max_nil,
          new Date(character.nil_updated_at),
        );
        const restored = Math.min(character.max_nil, current + NIL_SYN_CAFE_AMOUNT);
        await characters.updateNilSet(characterId, restored, trx);
      }
    }

// 11. Issue #28: sanity consumables (itens anti-insanidade) grant inventory
//     — ON CONFLICT quantity + 1 (ADR 28-C: preço em vendor_inventory,
//     efeito no catálogo consumables). Pingado e ampolas legadas não existem
//     no catálogo consumables, então o grant é pulado para eles.
    if (itemType === "CONSUMABLE" && itemId !== "syn-cafe") {
      const consumable = await consumables.findActiveBySlug(itemId, trx);
      if (consumable) {
        await consumables.addQuantity(characterId, consumable.id, quantity, trx);
      }
    }

    return {
      balanceBefore: result.transaction.balanceBefore,
      balanceAfter: result.transaction.balanceAfter,
      item: {
        itemType,
        itemId,
        quantity,
        unitPrice: item.price,
        totalPrice,
      },
    };
  });
}
