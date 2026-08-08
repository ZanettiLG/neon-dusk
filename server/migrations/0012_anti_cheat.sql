-- ND-053: Anti-Cheat Foundation — audit_log table with typed result enum
-- ============================================================================
-- Every game mutation action is logged with character_id, IP, user-agent,
-- request payload and a typed result for analytics and abuse investigation.
-- The `result` enum classifies each log entry so the ops dashboard can
-- filter by rate_limited/blocked/circuit_break for real-time monitoring.
-- Fire-and-forget writes via the audit-log.ts lib (void pattern, never
-- blocks the main request).

CREATE TYPE "public"."audit_result" AS ENUM(
  'allowed',
  'blocked',
  'rate_limited',
  'validation_error',
  'circuit_break',
  'cooldown_active',
  'server_error'
);--> statement-breakpoint

CREATE TABLE "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" uuid NOT NULL,
  "action" text NOT NULL,
  "ip" text NOT NULL,
  "user_agent" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "result" "audit_result" NOT NULL DEFAULT 'allowed',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "audit_log_character_id_characters_id_fk"
    FOREIGN KEY ("character_id")
    REFERENCES "public"."characters"("id")
    ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint

CREATE INDEX "idx_audit_log_character" ON "audit_log" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_audit_log_action" ON "audit_log" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_audit_log_result" ON "audit_log" USING btree ("result");--> statement-breakpoint
CREATE INDEX "idx_audit_log_created" ON "audit_log" USING btree ("created_at" DESC);--> statement-breakpoint

-- ============================================================================
-- DOWN (manual rollback)
-- ============================================================================
-- DROP INDEX "idx_audit_log_created";
-- DROP INDEX "idx_audit_log_result";
-- DROP INDEX "idx_audit_log_action";
-- DROP INDEX "idx_audit_log_character";
-- DROP TABLE "audit_log";
-- DROP TYPE "public"."audit_result";
