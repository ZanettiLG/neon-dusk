-- ND-014: PvP Combat
-- Player-vs-player combat log. Records attacker/defender stats, winner, loot
-- stolen, and griefer penalty flag. Supports leaderboard queries and audit.
CREATE TABLE "pvp_combats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attacker_id" uuid NOT NULL,
	"defender_id" uuid NOT NULL,
	"attacker_power" integer NOT NULL,
	"defender_power" integer NOT NULL,
	"winner_id" uuid NOT NULL,
	"loot_amount" integer DEFAULT 0 NOT NULL,
	"griefer_penalty" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pvp_combats_attacker_id_characters_id_fk" FOREIGN KEY ("attacker_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "pvp_combats_defender_id_characters_id_fk" FOREIGN KEY ("defender_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "pvp_combats_loot_amount_non_negative" CHECK ("pvp_combats"."loot_amount" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_pvp_combats_attacker" ON "pvp_combats" USING btree ("attacker_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_pvp_combats_defender" ON "pvp_combats" USING btree ("defender_id","created_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_pvp_combats_attacker_defender" ON "pvp_combats" USING btree ("attacker_id","defender_id","created_at" DESC);

-- ============================================================================
-- DOWN (manual rollback — drizzle migrations are up-only, run in order)
-- ============================================================================
-- DROP INDEX "idx_pvp_combats_attacker_defender";
-- DROP INDEX "idx_pvp_combats_defender";
-- DROP INDEX "idx_pvp_combats_attacker";
-- DROP TABLE "pvp_combats";
