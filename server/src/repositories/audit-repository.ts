import { db, type Queryable } from "../db";

// Neon Dusk — Audit repository (#158 DB repository layer)
// ============================================================================
// Fire-and-forget audit_log access. `record` never throws, never blocks the
// caller — a DB hiccup must never fail the game action it instruments.

export type AuditResult =
  | "allowed"
  | "blocked"
  | "rate_limited"
  | "validation_error"
  | "circuit_break"
  | "cooldown_active"
  | "server_error";

/** Input shape for an audit entry (characterId is null for system actions). */
export interface AuditEntry {
  characterId: string | null;
  action: string;
  ip: string;
  userAgent: string;
  payload: Record<string, unknown>;
  result: AuditResult;
}

/** Admin viewer row (audit_log ⋈ characters). */
export interface AuditLogRow {
  id: string;
  timestamp: Date;
  characterName: string | null;
  action: string;
  result: string;
  payload: Record<string, unknown>;
  ip: string;
}

export interface AuditRepository {
  /** Fire-and-forget audit write. Never throws, never blocks the caller. */
  record(entry: AuditEntry, q?: Queryable): void;
  /** Admin viewer: cursor-paginated entries, +1 row for pagination. */
  list(
    opts: { action?: string; result?: string; cursor?: string; limit: number },
    q?: Queryable,
  ): Promise<AuditLogRow[]>;
}

export function createAuditRepository(q: Queryable = db): AuditRepository {
  return {
    record(entry, tx = q) {
      void tx("audit_log")
        .insert({
          character_id: entry.characterId,
          action: entry.action,
          ip: entry.ip,
          user_agent: entry.userAgent,
          payload: entry.payload ?? {},
          result: entry.result,
        })
        .catch((err) => {
          // Best-effort only — audit must never fail the game.
          // ponytail: fora de contexto de request — logger injetável seria
          // over-engineering para o path de falha de audit.
          console.error("[audit-log] Failed to write audit entry:", err);
        });
    },

    async list(opts, tx = q) {
      const { action, result, cursor, limit } = opts;

      let query = tx("audit_log")
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

      if (action) {
        query = query.where("audit_log.action", action);
      }
      if (result) {
        query = query.where("audit_log.result", result);
      }
      if (cursor) {
        query = query.where("audit_log.id", "<", cursor);
      }

      return (await query
        .orderBy("audit_log.id", "desc")
        .limit(limit + 1)) as unknown as AuditLogRow[];
    },
  };
}

/** Shared singleton — production code should use this (or `repositories`). */
export const auditRepository = createAuditRepository();
