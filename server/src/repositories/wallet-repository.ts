import { db, type Queryable } from "../db";
import { AppError } from "../middleware/error-handler";
import type { WalletState } from "../game/economy";

// Neon Dusk — Wallet repository (#158 DB repository layer)
// ============================================================================
// Carteiras de grana com optimistic locking (version CAS). O `ensure` semeia
// o capital inicial de 500 grana + a entrada de auditoria ADMIN_ADJUSTMENT
// exatamente uma vez, sobrevivendo à corrida SELECT-depois-INSERT via
// ON CONFLICT DO NOTHING.

/** Seed capital granted when a character's wallet is first created. */
const INITIAL_BALANCE = 500;

/** Database row shape for the `character_wallets` table (snake_case columns). */
export interface WalletRow {
  id: string;
  character_id: string;
  balance: number;
  escrow: number;
  lifetime_earned: number;
  lifetime_spent: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

/** Patchable columns for an optimistic wallet update. */
export interface WalletPatch {
  balance?: number;
  escrow?: number;
  lifetime_earned?: number;
  lifetime_spent?: number;
}

/** Row → internal WalletState mapping (game/economy contract). */
export function toWalletState(row: WalletRow): WalletState {
  return {
    balance: row.balance,
    escrow: row.escrow,
    lifetimeEarned: row.lifetime_earned,
    lifetimeSpent: row.lifetime_spent,
    version: row.version,
  };
}

export interface WalletRepository {
  /**
   * Ensure the character has a wallet — creates it with the seed capital
   * (+ ADMIN_ADJUSTMENT entry) on first use; otherwise returns it as-is.
   * Must run inside a transaction (`q`).
   */
  ensure(characterId: string, q?: Queryable): Promise<WalletState>;
  /** Read the wallet (no lock), or null when it does not exist yet. */
  getById(characterId: string, q?: Queryable): Promise<WalletRow | null>;
  /** Read + lock the wallet row for the transaction's duration. */
  getForUpdate(characterId: string, q?: Queryable): Promise<WalletRow | null>;
  /** Read only the balance (or undefined when there is no wallet). */
  getBalance(characterId: string, q?: Queryable): Promise<number | undefined>;
  /**
   * Optimistic write (CAS by version): updates the row only when `version`
   * still matches, bumping it to `expectedVersion + 1`. Returns the updated
   * row, or undefined when a concurrent writer won the race.
   */
  updateOptimistic(
    characterId: string,
    expectedVersion: number,
    patch: WalletPatch,
    q?: Queryable,
  ): Promise<WalletRow | undefined>;
  /** Same CAS update, addressed by wallet row id (PvP loser path). */
  updateOptimisticById(
    walletId: string,
    expectedVersion: number,
    patch: WalletPatch,
    q?: Queryable,
  ): Promise<WalletRow | undefined>;
  /** Plain insert (test/seed fixtures only — production goes through ensure). */
  insert(characterId: string, input: WalletPatch, q?: Queryable): Promise<WalletRow>;
}

export function createWalletRepository(q: Queryable = db): WalletRepository {
  return {
    async ensure(characterId, tx = q) {
      const existing = await tx("character_wallets")
        .select()
        .where("character_id", characterId)
        .limit(1);

      if (existing.length > 0) {
        return toWalletState(existing[0] as WalletRow);
      }

      // Create wallet with seed capital. Concurrent requests may both reach
      // this INSERT (SELECT-then-INSERT race); ON CONFLICT DO NOTHING makes
      // the loser a no-op instead of a UNIQUE(character_id) violation.
      const insertResult = await tx("character_wallets")
        .insert({
          character_id: characterId,
          balance: INITIAL_BALANCE,
          lifetime_earned: INITIAL_BALANCE,
          escrow: 0,
          lifetime_spent: 0,
          version: 0,
        })
        .onConflict("character_id")
        .ignore()
        .returning("*");

      const wallet = insertResult[0] as WalletRow | undefined;

      if (!wallet) {
        // A concurrent request created the wallet first — re-read it. The
        // conflict means the row is committed, so this select always finds it.
        const rows = await tx("character_wallets")
          .select()
          .where("character_id", characterId)
          .limit(1);

        if (!rows.length) {
          throw new AppError(500, "WALLET_CREATE_FAILED", "Falha ao criar carteira");
        }
        return toWalletState(rows[0] as WalletRow);
      }

      // Record seed transaction (only when THIS call created the wallet, so a
      // concurrent loser never writes a duplicate ADMIN_ADJUSTMENT entry).
      await tx("transaction_log").insert({
        character_id: characterId,
        type: "ADMIN_ADJUSTMENT",
        amount: INITIAL_BALANCE,
        balance_before: 0,
        balance_after: INITIAL_BALANCE,
        source: "Initial seed capital",
        reference_type: "system",
      });

      return toWalletState(wallet);
    },

    async getById(characterId, tx = q) {
      const rows = await tx("character_wallets")
        .select()
        .where("character_id", characterId)
        .limit(1);
      return rows.length ? (rows[0] as WalletRow) : null;
    },

    async getForUpdate(characterId, tx = q) {
      const rows = await tx("character_wallets")
        .select()
        .where("character_id", characterId)
        .forUpdate()
        .limit(1);
      return rows.length ? (rows[0] as WalletRow) : null;
    },

    async getBalance(characterId, tx = q) {
      const rows = await tx("character_wallets")
        .select("balance")
        .where("character_id", characterId)
        .limit(1);
      return rows.length ? Number((rows[0] as { balance: number }).balance) : undefined;
    },

    async updateOptimistic(characterId, expectedVersion, patch, tx = q) {
      const rows = await tx("character_wallets")
        .update({
          ...patch,
          version: expectedVersion + 1,
          updated_at: new Date(),
        })
        .where("character_id", characterId)
        .where("version", expectedVersion)
        .returning("*");
      return rows.length ? (rows[0] as WalletRow) : undefined;
    },

    async updateOptimisticById(walletId, expectedVersion, patch, tx = q) {
      const rows = await tx("character_wallets")
        .update({
          ...patch,
          version: expectedVersion + 1,
          updated_at: new Date(),
        })
        .where("id", walletId)
        .where("version", expectedVersion)
        .returning("*");
      return rows.length ? (rows[0] as WalletRow) : undefined;
    },

    async insert(characterId, input, tx = q) {
      const [row] = await tx("character_wallets")
        .insert({
          character_id: characterId,
          balance: input.balance ?? 0,
          escrow: input.escrow ?? 0,
          lifetime_earned: input.lifetime_earned ?? 0,
          lifetime_spent: input.lifetime_spent ?? 0,
          version: 0,
        })
        .returning("*");
      return row as WalletRow;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const walletRepository = createWalletRepository();
