import type Redis from "ioredis";
import type {
  AdminEconomy,
  AdminPlayer,
  AdminPlayersResponse,
  AdminTransaction,
  AdminTransactionsResponse,
  AdminAuditResponse,
} from "@neon-dusk/shared";
import { AppError } from "../middleware/error-handler";
import { characterRepository as characters } from "../repositories/character-repository";
import { transactionRepository as transactions } from "../repositories/transaction-repository";
import { gameEventRepository as gameEvents } from "../repositories/game-event-repository";
import { gameParamRepository as gameParams } from "../repositories/game-param-repository";
import { auditRepository as audit } from "../repositories/audit-repository";

// Neon Dusk — Admin service (ND-052)
// ============================================================================
// Read-only and write operations for the admin panel. All write operations
// log to the audit_log table. Economy queries aggregate across wallets,
// transaction_log, and game_events.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

  const rows = await characters.listAdminPlayers({
    offset,
    pageSize,
    search: opts.search,
    sort: opts.sort,
  });
  const total = await characters.countWithNameSearch(opts.search);

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
  const updated = await characters.updateBan(characterId, true);

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "Personagem não encontrado");
  }

  // Fire-and-forget audit log.
  audit.record({
    characterId,
    action: "admin.ban",
    ip: "admin",
    userAgent: "admin-panel",
    payload: { reason, adminUserId },
    result: "allowed",
  });
}

/**
 * Unban a character by ID. Sets is_banned = false, logs to audit.
 */
export async function unbanPlayer(
  characterId: string,
  adminUserId: string,
): Promise<void> {
  const updated = await characters.updateBan(characterId, false);

  if (!updated) {
    throw new AppError(404, "NOT_FOUND", "Personagem não encontrado");
  }

  audit.record({
    characterId,
    action: "admin.unban",
    ip: "admin",
    userAgent: "admin-panel",
    payload: { adminUserId },
    result: "allowed",
  });
}

// ---------------------------------------------------------------------------
// Economy dashboard
// ---------------------------------------------------------------------------

/**
 * Economy overview: aggregate balances, top faucets/sinks, DAU, hourly activity.
 */
export async function getEconomy(): Promise<AdminEconomy> {
  const [
    eddiesInCirculation,
    faucets,
    sinks,
    dailyActiveCharacters,
    transactions24h,
    hourly,
  ] = await Promise.all([
    transactions.sumBalances(),
    transactions.topFaucets24h(),
    transactions.topSinks24h(),
    gameEvents.countDistinctActors(24),
    transactions.count24h(),
    gameEvents.listHourlyCounts(24),
  ]);

  return {
    eddiesInCirculation,
    topFaucets24h: faucets.map((f) => ({ source: f.source, amount: f.amount })),
    topSinks24h: sinks.map((s) => ({ source: s.source, amount: s.amount })),
    dailyActiveCharacters,
    transactions24h,
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

  const { transactions: rows, total } = await transactions.listAdmin({
    type: opts.type,
    limit,
    offset: offsetVal,
  });

  const mapped: AdminTransaction[] = rows.map((r) => ({
    id: r.id,
    characterName: r.characterName ?? "unknown",
    type: r.type,
    amount: Number(r.amount),
    balanceBefore: Number(r.balanceBefore),
    balanceAfter: Number(r.balanceAfter),
    source: r.source,
    createdAt: new Date(r.createdAt).toISOString(),
  }));

  return { transactions: mapped, total };
}

// ---------------------------------------------------------------------------
// Game params
// ---------------------------------------------------------------------------

/** Get all game params as a flat record. */
export async function getParams(): Promise<Record<string, string>> {
  return gameParams.get();
}

/** Update game params. Only existing keys can be updated. Logs old→new diffs. */
export async function updateParams(
  params: Record<string, string>,
  adminUserId: string,
): Promise<Record<string, string>> {
  const existingKeys = new Set(
    (await gameParams.list()).map((r) => r.key),
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
    await gameParams.set(key, value, adminUserId);
  }

  // Audit log the change (no characterId — system action).
  audit.record({
    characterId: null,
    action: "admin.update_params",
    ip: "admin",
    userAgent: "admin-panel",
    payload: { diffs, adminUserId },
    result: "allowed",
  });

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

  const rows = await audit.list({
    action: opts.action,
    result: opts.result,
    cursor: opts.cursor,
    limit,
  });

  const hasMore = rows.length > limit;
  const entries = rows.slice(0, limit);

  return {
    entries: entries.map((r) => ({
      id: r.id,
      timestamp: new Date(r.timestamp).toISOString(),
      characterName: r.characterName ?? null,
      action: r.action,
      result: r.result,
      payload: r.payload ?? {},
      ip: maskIP(r.ip),
    })),
    nextCursor: hasMore ? entries[entries.length - 1].id : null,
  };
}
