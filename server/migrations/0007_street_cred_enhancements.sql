-- ND-011.2: Street Cred decay + leaderboard
-- max_street_cred_achieved is the lifetime max and decay floor (never falls
-- below the highest threshold reached); last_activity_at is the decay clock
-- (7-day grace, -5 SC/day). STREET_CRED_AWARD records admin/system awards in
-- the economy audit trail (transaction_log.type is a pg enum).
ALTER TYPE "public"."transaction_type" ADD VALUE IF NOT EXISTS 'STREET_CRED_AWARD';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "max_street_cred_achieved" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "last_activity_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
UPDATE "characters" SET "max_street_cred_achieved" = "street_cred";--> statement-breakpoint
CREATE INDEX "idx_characters_street_cred_desc" ON "characters" USING btree ("street_cred" DESC);

-- ============================================================================
-- DOWN (manual rollback — drizzle migrations are up-only, run in order)
-- ============================================================================
-- DROP INDEX "idx_characters_street_cred_desc";
-- ALTER TABLE "characters" DROP COLUMN "last_activity_at";
-- ALTER TABLE "characters" DROP COLUMN "max_street_cred_achieved";
-- ALTER TYPE "public"."transaction_type" DROP VALUE 'STREET_CRED_AWARD';
