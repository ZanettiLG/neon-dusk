-- ND-052: Admin Panel — user roles, character bans, game_params, audit_log nullable
-- ============================================================================
-- Adds role-based admin auth (ADR-1: JWT role as primary admin auth,
-- x-api-key as fallback). Manual character bans (ADR-3: is_banned column,
-- separate from circuit breaker). Game parameters table for runtime tuning.
-- Makes audit_log.character_id nullable so non-character admin actions
-- (param changes, system ops) can be logged.

-- 1. User role enum + column --------------------------------------------------
CREATE TYPE "public"."user_role" AS ENUM('player', 'admin');--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "role" "public"."user_role" DEFAULT 'player' NOT NULL;--> statement-breakpoint

-- 2. Character is_banned flag (ADR-3) ----------------------------------------
ALTER TABLE "characters" ADD COLUMN "is_banned" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE INDEX "idx_characters_is_banned" ON "characters" USING btree ("is_banned")
  WHERE "is_banned" = true;--> statement-breakpoint

-- 3. Make audit_log.character_id nullable ------------------------------------
-- Drop FK first (the cascade behavior is config-only; audit rows should survive
-- character deletion, not cascade, but that migration predates ND-052).
ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_character_id_characters_id_fk";--> statement-breakpoint

ALTER TABLE "audit_log" ALTER COLUMN "character_id" DROP NOT NULL;--> statement-breakpoint

-- Re-add FK as nullable-friendly (SET NULL when character is deleted).
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_character_id_characters_id_fk"
  FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;--> statement-breakpoint

-- 4. Game parameters table ---------------------------------------------------
CREATE TABLE "game_params" (
  "key" text PRIMARY KEY NOT NULL,
  "value" text NOT NULL,
  "updated_by" uuid,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "game_params_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id")
    ON DELETE SET NULL ON UPDATE NO ACTION
);--> statement-breakpoint

-- Seed default params (ND-052 spec values).
INSERT INTO "game_params" ("key", "value") VALUES
  ('ROUND_DURATION_DAYS', '14'),
  ('NIL_REGEN_MINUTES', '5'),
  ('GIG_COOLDOWN_MINUTES', '10'),
  ('PVP_NIL_COST', '10'),
  ('INITIAL_BALANCE', '500'),
  ('MAX_CREW_SIZE', '4');

-- ============================================================================
-- DOWN (manual rollback)
-- ============================================================================
-- DELETE FROM "game_params";
-- DROP TABLE "game_params";
-- ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_character_id_characters_id_fk";
-- ALTER TABLE "audit_log" ALTER COLUMN "character_id" SET NOT NULL;
-- ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_character_id_characters_id_fk"
--   FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id")
--   ON DELETE CASCADE ON UPDATE NO ACTION;
-- DROP INDEX "idx_characters_is_banned";
-- ALTER TABLE "characters" DROP COLUMN "is_banned";
-- ALTER TABLE "users" DROP COLUMN "role";
-- DROP TYPE "public"."user_role";
