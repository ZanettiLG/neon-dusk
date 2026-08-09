import { db } from "../db";

// Neon Dusk — Fire-and-forget audit logger (ND-053)
// ============================================================================
// Every mutating game action is logged to the `audit_log` table via this
// function. It uses the void pattern from auth.ts (trackActiveUser) — a DB
// hiccup must never fail or delay the main request.

export type AuditResult =
  | "allowed"
  | "blocked"
  | "rate_limited"
  | "validation_error"
  | "circuit_break"
  | "cooldown_active"
  | "server_error";

export interface AuditLogEntry {
  characterId: string;
  action: string;
  ip: string;
  userAgent: string;
  payload: Record<string, unknown>;
  result: AuditResult;
}

/**
 * Fire-and-forget audit logger. Never throws, never blocks the caller.
 * Internally catches DB errors so the game continues even when audit storage
 * is unhealthy. Uses the globally shared db instance (no transaction needed —
 * audit writes are independent of the game operation's outcome).
 */
export function auditLog(entry: AuditLogEntry): void {
  void db("audit_log")
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
      console.error("[audit-log] Failed to write audit entry:", err);
    });
}
