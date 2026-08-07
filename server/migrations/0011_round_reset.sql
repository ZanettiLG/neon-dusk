-- ND-017: Round System — rounds, round_stats, and attrs_total constraint removal
-- ============================================================================
-- 14-day rounds with a full server-side reset. `rounds` tracks the lifecycle;
-- `round_stats` stores a snapshot captured at reset time (BEFORE the wipe).
-- ADR-1: the characters_attrs_total CHECK only applies at character creation
-- (3 base x 5 + 7 free = 22). Post-reset attributes return to base 3 each
-- (sum = 15), so the constraint is dropped. Per-attribute range checks stay.

CREATE TYPE "public"."round_status" AS ENUM('active', 'ended');--> statement-breakpoint
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_number" integer NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"status" "public"."round_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rounds_round_number_unique" UNIQUE("round_number")
);--> statement-breakpoint
CREATE TABLE "round_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"round_id" uuid NOT NULL,
	"total_gigs_completed" integer DEFAULT 0 NOT NULL,
	"total_eddies_earned" bigint DEFAULT 0 NOT NULL,
	"total_pvp_fights" integer DEFAULT 0 NOT NULL,
	"total_active_characters" integer DEFAULT 0 NOT NULL,
	"top_crew_id" uuid,
	"top_crew_name" text,
	"top_sc_character_id" uuid,
	"top_sc_character_name" text,
	"top_sc_value" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_stats_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
CREATE INDEX "idx_rounds_status" ON "rounds" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rounds_active" ON "rounds" USING btree ("status") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_round_stats_round_id" ON "round_stats" USING btree ("round_id");--> statement-breakpoint
ALTER TABLE "characters" DROP CONSTRAINT IF EXISTS "characters_attrs_total";--> statement-breakpoint
-- Seed round 1 as active (fresh installs start mid-round; the cron triggers
-- the first reset when the duration elapses).
INSERT INTO "rounds" ("round_number", "started_at", "status") VALUES (1, now(), 'active');

-- ============================================================================
-- DOWN (manual rollback — drizzle migrations are up-only, run in order)
-- ============================================================================
-- DELETE FROM "rounds" WHERE "round_number" = 1;
-- ALTER TABLE "characters" ADD CONSTRAINT "characters_attrs_total"
--   CHECK ("characters"."body" + "characters"."reflexes" + "characters"."intelligence"
--        + "characters"."technical" + "characters"."cool" = 22);
-- DROP INDEX "idx_round_stats_round_id";
-- DROP INDEX "idx_rounds_active";
-- DROP INDEX "idx_rounds_status";
-- DROP TABLE "round_stats";
-- DROP TABLE "rounds";
-- DROP TYPE "public"."round_status";
