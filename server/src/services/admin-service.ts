import type { Knex } from "knex";
import type Redis from "ioredis";
import type {
  AdminEconomy,
  AdminPlayer,
  AdminPlayersResponse,
  AdminTransaction,
  AdminTransactionsResponse,
  AdminAuditEntry,
  AdminAuditResponse,
} from "@neon-dusk/shared";
import { db } from "../db";
import { AppError } from "../middleware/error-handler";

// Neon Dusk — Admin service (ND-052)
// ============================================================================
// Read-only and write operations for the admin panel. All write operations
// log to the audit_log table. Economy queries aggregate across wallets,
// transaction_log, and game_events.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Escape SQL LIKE wildcards so user search input cannot match all records. */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** Derive a PlayerStatus from ban flag + batched circuit-break state. */
function resolveStatus(
  isBanned: boolean,
  cbResult: string | null,
): AdminPlayer["status"] {
  if (isBanned) return "banned";
  if (cbResult !== null) return "circuit_broken";
  return "active";
}

/** Derive a character level from their street cred (every 10 SC = 1 level, min 1). */
function levelFromSC(sc: number): number {
  return Math.max(1, Math.floor(sc / 10) + 1);
}

/**
 * Get paginated player list with search, sort, and derived fields.
 * Joins characters → wallets → crews → game_events for a comprehensive view.
 */
export async function getPlayers(
  redis: Redis,
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    sort?: "sc" | "name" | "level" | "last_activity";
  } = {},
): Promise<AdminPlayersResponse> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  let query = db("characters")
    .select({
      id: "characters.id",
      userId: "characters.user_id",
      name: "characters.name",
      streetCred: "characters.street_cred",
      isBanned: "characters.is_banned",
      balance: db.raw("COALESCE(cw.balance, 0)"),
      crewName: "c.crew_name",
      lastEvent: db.raw("le.last_event::text"),
    })
    .leftJoin(
      db("character_wallets")
        .select("character_id", "balance")
        .as("cw"),
      "cw.character_id",
      "characters.id",
    )
    .leftJoin(
      db("crew_members")
        .select("crew_members.character_id", "crews.name as crew_name")
        .join("crews", "crews.id", "crew_members.crew_id")
        .as("c"),
      "c.character_id",
      "characters.id",
    )
    .leftJoin(
      db("game_events")
        .select({
          characterId: "actor_id",
          lastEvent: db.raw("max(game_events.created_at)"),
        })
        .whereNotNull("actor_id")
        .groupBy("actor_id")
        .as("le"),
      "le.characterId",
      "characters.id",
    );

  if (opts.search) {
    const safe = escapeLike(opts.search.toLowerCase());
    query = query.whereRaw("lower(characters.name) LIKE ?", [`%${safe}%`]);
  }

  // Count total
  let countQuery = db("characters");
  if (opts.search) {
    const safe = escapeLike(opts.search.toLowerCase());
    countQuery = countQuery.whereRaw("lower(characters.name) LIKE ?", [`%${safe}%`]);
  }
  const [countRow] = await countQuery.count("* as count");
  const total = Number(countRow?.count ?? 0);

  // Build sort order
  let orderCol: string;
  switch (opts.sort) {
    case "name":
      orderCol = "characters.name";
      break;
    case "level":
      orderCol = "characters.street_cred";
      break;
    case "last_activity":
      orderCol = "characters.created_at";
      break;
    default:
      orderCol = "characters.street_cred";
  }
  query = query.orderBy(orderCol, "desc").limit(pageSize).offset(offset);

  const rows = await query;

  // Batch circuit-break checks: one mget instead of N sequential gets.
  const userIds = [...new Set(rows.map((r) => r.userId as string))];
  const cbKeys = userIds.map((uid) => `circuit_break:${uid}`);
  const cbResults = userIds.length > 0 ? await redis.mget(...cbKeys) : [];
  const cbMap = new Map(userIds.map((uid, i) => [uid, cbResults[i] ?? null]));

  const players: AdminPlayer[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    level: levelFromSC(Number(row.streetCred)),
    sc: Number(row.streetCred),
    eddies: Number(row.balance ?? 0),
    crew: (row.crewName as string) ?? null,
    lastLogin: (row.lastEvent as string) ?? null,
    status: resolveStatus(Boolean(row.isBanned), cbMap.get(row.userId as string) ?? null),
  }));

  // Re-sort by last_activity if requested (lastEvent is string, sort by that).
  if (opts.sort === "last_activity") {
    players.sort((a, b) => {
      if (!a.lastLogin) return 1;
      if (!b.lastLogin) return -1;
      return b.lastLogin.localeCompare(a.lastLogin);
    });
  }

  return { players, total, page, pageSize };
}

/**
 * Ban a character by ID. Sets is_banned = true, logs to audit.
 */
export async function banPlayer(
  characterId: string,
  adminUserId: string,
  reason: string,
): Promise<void> {
  const [updated] = await db("characters")
    .update({ is_banned: true })
    .where("id", characterId)
    .returning("id");

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "Personagem não encontrado");
  }

  // Fire-and-forget audit log.
  void db("audit_log")
    .insert({
      character_id: characterId,
      action: "admin.ban",
      ip: "admin",
      user_agent: "admin-panel",
      payload: { reason, adminUserId },
      result: "allowed",
    })
    .catch((err) => console.error("[admin] audit-log write failed:", err));
}

/**
 * Unban a character by ID. Sets is_banned = false, logs to audit.
 */
export async function unbanPlayer(
  characterId: string,
  adminUserId: string,
): Promise<void> {
  const [updated] = await db("characters")
    .update({ is_banned: false })
    .where("id", characterId)
    .returning("id");

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "Personagem não encontrado");
  }

  void db("audit_log")
    .insert({
      character_id: characterId,
      action: "admin.unban",
      ip: "admin",
      user_agent: "admin-panel",
      payload: { adminUserId },
      result: "allowed",
    })
    .catch((err) => console.error("[admin] audit-log write failed:", err));
}

// ---------------------------------------------------------------------------
// Economy dashboard
// ---------------------------------------------------------------------------

/**
 * Economy overview: aggregate balances, top faucets/sinks, DAU, hourly activity.
 */
export async function getEconomy(): Promise<AdminEconomy> {
  // Eddies in circulation: SUM of all wallet balances.
  const [balanceRow] = await db("character_wallets")
    .select({ total: db.raw("coalesce(sum(balance), 0)::int") });
  const eddiesInCirculation = balanceRow?.total ?? 0;

  // Top faucets 24h (positive transactions, grouped by source).
  const faucets = await db("transaction_log")
    .select({
      source: "source",
      amount: db.raw("sum(amount)::int"),
    })
    .where("amount", ">", 0)
    .whereRaw("transaction_log.created_at > now() - interval '24 hours'")
    .groupBy("source")
    .orderByRaw("sum(amount) DESC")
    .limit(5);

  // Top sinks 24h (negative transactions, grouped by source).
  const sinks = await db("transaction_log")
    .select({
      source: "source",
      amount: db.raw("abs(sum(amount))::int"),
    })
    .where("amount", "<", 0)
    .whereRaw("transaction_log.created_at > now() - interval '24 hours'")
    .groupBy("source")
    .orderByRaw("abs(sum(amount)) DESC")
    .limit(5);

  // Daily Active Characters: distinct actors with game events in last 24h.
  const [dauRow] = await db("game_events")
    .select({ count: db.raw("count(distinct actor_id)::int") })
    .whereRaw("game_events.created_at > now() - interval '24 hours'")
    .whereNotNull("actor_id");

  // Transactions in last 24h.
  const [txRow] = await db("transaction_log")
    .select({ count: db.raw("count(*)::int") })
    .whereRaw("transaction_log.created_at > now() - interval '24 hours'");

  // Hourly breakdown: game events per hour for the last 24h.
  const hourly = await db("game_events")
    .select({
      hour: db.raw("date_trunc('hour', game_events.created_at)::text"),
      count: db.raw("count(*)::int"),
    })
    .whereRaw("game_events.created_at > now() - interval '24 hours'")
    .groupByRaw("date_trunc('hour', game_events.created_at)")
    .orderByRaw("date_trunc('hour', game_events.created_at)");

  return {
    eddiesInCirculation,
    topFaucets24h: faucets.map((f) => ({ source: f.source, amount: f.amount })),
    topSinks24h: sinks.map((s) => ({ source: s.source, amount: s.amount })),
    dailyActiveCharacters: dauRow?.count ?? 0,
    transactions24h: txRow?.count ?? 0,
    hourlyBreakdown24h: hourly.map((h) => ({ hour: h.hour, count: h.count })),
  };
}

// ---------------------------------------------------------------------------
// Transaction viewer
// ---------------------------------------------------------------------------

/**
 * Get paginated transaction log with character name join.
 */
export async function getTransactions(
  opts: {
    type?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<AdminTransactionsResponse> {
  const limit = opts.limit ?? 50;
  const offsetVal = opts.offset ?? 0;

  let query = db("transaction_log")
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

  let countQuery = db("transaction_log");

  if (opts.type) {
    query = query.where("transaction_log.type", opts.type);
    countQuery = countQuery.where("type", opts.type);
  }

  const [countRow] = await countQuery.count("* as count");
  const total = Number(countRow?.count ?? 0);

  const rows = await query
    .orderBy("transaction_log.created_at", "desc")
    .limit(limit)
    .offset(offsetVal);

  const transactions: AdminTransaction[] = rows.map((r) => ({
    id: r.id,
    characterName: r.characterName ?? "unknown",
    type: r.type,
    amount: Number(r.amount),
    balanceBefore: Number(r.balanceBefore),
    balanceAfter: Number(r.balanceAfter),
    source: r.source,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  return { transactions, total };
}

// ---------------------------------------------------------------------------
// Game params
// ---------------------------------------------------------------------------

/** Get all game params as a flat record. */
export async function getParams(): Promise<Record<string, string>> {
  const rows = await db("game_params").select();
  return Object.fromEntries(rows.map((r: Record<string, unknown>) => [r.key as string, r.value as string]));
}

/** Update game params. Only existing keys can be updated. Logs old→new diffs. */
export async function updateParams(
  params: Record<string, string>,
  adminUserId: string,
): Promise<Record<string, string>> {
  const existingKeys = new Set(
    (await db("game_params").select("key")).map((r: Record<string, unknown>) => r.key as string),
  );

  const unknownKeys = Object.keys(params).filter((k) => !existingKeys.has(k));
  if (unknownKeys.length > 0) {
    throw new AppError(
      400,
      "UNKNOWN_PARAMS",
      `Unknown game param keys: ${unknownKeys.join(", ")}`,
    );
  }

  // Read current values for diffing.
  const current = await getParams();
  const diffs: Record<string, { old: string; new: string }> = {};

  for (const [key, value] of Object.entries(params)) {
    if (current[key] !== value) {
      diffs[key] = { old: current[key], new: value };
    }
  }

  if (Object.keys(diffs).length === 0) {
    return current;
  }

  // Update each param.
  for (const [key, value] of Object.entries(params)) {
    await db("game_params")
      .update({ value, updated_by: adminUserId, updated_at: new Date() })
      .where("key", key);
  }

  // Audit log the change (no characterId — system action).
  void db("audit_log")
    .insert({
      character_id: null,
      action: "admin.update_params",
      ip: "admin",
      user_agent: "admin-panel",
      payload: { diffs, adminUserId },
      result: "allowed",
    })
    .catch((err) => console.error("[admin] audit-log write failed:", err));

  return getParams();
}

// ---------------------------------------------------------------------------
// Audit log viewer
// ---------------------------------------------------------------------------

/** Mask the last two octets of an IP address for privacy. Non-IP strings are fully masked. */
function maskIP(ip: string): string {
  if (!ip.includes(".")) return "***.***.***";
  return ip.replace(/\.\d{1,3}\.\d{1,3}$/, ".***");
}

/**
 * Get cursor-paginated audit log entries with character name.
 */
export async function getAuditLog(
  opts: {
    action?: string;
    result?: string;
    cursor?: string;
    limit?: number;
  } = {},
): Promise<AdminAuditResponse> {
  const limit = opts.limit ?? 50;

  let query = db("audit_log")
    .select({
      id: "audit_log.id",
      timestamp: "audit_log.created_at",
      characterName: "characters.name",
      action: "audit_log.action",
      result: "audit_log.result",
      payload: "audit_log.payload",
      ip: "audit_log.ip",
    })
    .leftJoin("characters", "characters.id", "audit_log.character_id");

  if (opts.action) {
    query = query.where("audit_log.action", opts.action);
  }
  if (opts.result) {
    query = query.where("audit_log.result", opts.result);
  }
  if (opts.cursor) {
    query = query.where("audit_log.id", "<", opts.cursor);
  }

  const rows = await query
    .orderBy("audit_log.id", "desc")
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const entries = rows.slice(0, limit);

  return {
    entries: entries.map((r) => ({
      id: r.id,
      timestamp: new Date(r.timestamp).toISOString(),
      characterName: (r.characterName as string) ?? null,
      action: r.action,
      result: r.result,
      payload: (r.payload as Record<string, unknown>) ?? {},
      ip: maskIP(r.ip),
    })),
    nextCursor: hasMore ? entries[entries.length - 1].id : null,
  };
}
