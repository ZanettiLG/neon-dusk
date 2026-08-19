import { db, type Queryable } from "../db";

// Neon Dusk — Transaction repository (#158 DB repository layer)
// ============================================================================
// Append-only transaction_log access (economy audit trail). The
// `balance_after - balance_before = amount` CHECK is enforced by the DB.

/** Insert input for a transaction_log row (snake_case columns). */
export interface TransactionInsert {
  character_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  source: string;
  reference_type?: string | null;
  reference_id?: string | null;
}

/** Raw row shape for transaction_log. */
export interface TransactionRow {
  id: string;
  character_id: string;
  type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  source: string;
  reference_type: string | null;
  reference_id: string | null;
  created_at: Date;
}

/** Admin viewer row (transaction_log ⋈ characters). */
export interface AdminTransactionRow {
  id: string;
  characterName: string;
  type: string;
  amount: number | string;
  balanceBefore: number | string;
  balanceAfter: number | string;
  source: string;
  createdAt: Date;
}

export interface TransactionRepository {
  insert(entry: TransactionInsert, q?: Queryable): Promise<TransactionRow | undefined>;
  /** Character transactions, newest first (+1 row internally for pagination). */
  listForCharacter(
    characterId: string,
    limit: number,
    cursor: string | undefined,
    q?: Queryable,
  ): Promise<TransactionRow[]>;
  /** Admin viewer: paginated rows with character names + total count. */
  listAdmin(
    opts: { type?: string; limit: number; offset: number },
    q?: Queryable,
  ): Promise<{ transactions: AdminTransactionRow[]; total: number }>;
  /** Economy dashboard: eddies in circulation (sum of wallet balances). */
  sumBalances(q?: Queryable): Promise<number>;
  /** Economy dashboard: top 5 positive transaction sources (24h). */
  topFaucets24h(q?: Queryable): Promise<Array<{ source: string; amount: number }>>;
  /** Economy dashboard: top 5 negative transaction sources (24h). */
  topSinks24h(q?: Queryable): Promise<Array<{ source: string; amount: number }>>;
  /** Economy dashboard: transaction count in the last 24h. */
  count24h(q?: Queryable): Promise<number>;
}

export function createTransactionRepository(q: Queryable = db): TransactionRepository {
  return {
    async insert(entry, tx = q) {
      const rows = await tx("transaction_log").insert(entry).returning("*");
      return rows.length ? (rows[0] as TransactionRow) : undefined;
    },

    async listForCharacter(characterId, limit, cursor, tx = q) {
      let query = tx("transaction_log")
        .select()
        .where("character_id", characterId);

      if (cursor) {
        query = query.where("created_at", "<", new Date(cursor));
      }

      return (await query
        .orderBy("created_at", "desc")
        .limit(limit + 1)) as TransactionRow[]; // one extra row to know if there's a next page
    },

    async listAdmin(opts, tx = q) {
      const { type, limit, offset } = opts;

      let query = tx("transaction_log")
        .select({
          id: "transaction_log.id",
          characterName: "characters.name",
          type: "transaction_log.type",
          amount: "transaction_log.amount",
          balanceBefore: "transaction_log.balance_before",
          balanceAfter: "transaction_log.balance_after",
          source: "transaction_log.source",
          createdAt: "transaction_log.created_at",
        })
        .leftJoin("characters", "characters.id", "transaction_log.character_id");

      let countQuery = tx("transaction_log");

      if (type) {
        query = query.where("transaction_log.type", type);
        countQuery = countQuery.where("type", type);
      }

      const [countRow] = await countQuery.count("* as count");
      const total = Number((countRow as { count?: string | number } | undefined)?.count ?? 0);

      const rows = (await query
        .orderBy("transaction_log.created_at", "desc")
        .limit(limit)
        .offset(offset)) as unknown as AdminTransactionRow[];

      return { transactions: rows, total };
    },

    async sumBalances(tx = q) {
      const rows = await tx("character_wallets").select({
        total: q.raw("coalesce(sum(balance), 0)::int"),
      });
      return rows[0]?.total ?? 0;
    },

    async topFaucets24h(tx = q) {
      return tx("transaction_log")
        .select({
          source: "source",
          amount: q.raw("sum(amount)::int"),
        })
        .where("amount", ">", 0)
        .whereRaw("transaction_log.created_at > now() - interval '24 hours'")
        .groupBy("source")
        .orderByRaw("sum(amount) DESC")
        .limit(5) as Promise<Array<{ source: string; amount: number }>>;
    },

    async topSinks24h(tx = q) {
      return tx("transaction_log")
        .select({
          source: "source",
          amount: q.raw("abs(sum(amount))::int"),
        })
        .where("amount", "<", 0)
        .whereRaw("transaction_log.created_at > now() - interval '24 hours'")
        .groupBy("source")
        .orderByRaw("abs(sum(amount)) DESC")
        .limit(5) as Promise<Array<{ source: string; amount: number }>>;
    },

    async count24h(tx = q) {
      const rows = await tx("transaction_log")
        .select({ count: q.raw("count(*)::int") })
        .whereRaw("transaction_log.created_at > now() - interval '24 hours'");
      return rows[0]?.count ?? 0;
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const transactionRepository = createTransactionRepository();
