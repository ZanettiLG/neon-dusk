import { auditRepository as audit } from "../repositories/audit-repository";
import type { AuditResult as RepositoryAuditResult } from "../repositories/audit-repository";

// Neon Dusk — Fire-and-forget audit logger (ND-053)
// ============================================================================
// Every mutating game action is logged to the `audit_log` table via this
// function. It uses the void pattern from auth.ts (trackActiveUser) — a DB
// hiccup must never fail or delay the main request. The write itself is
// delegated to the audit repository (#158).

export type AuditResult = RepositoryAuditResult;

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
  audit.record(entry);
}
