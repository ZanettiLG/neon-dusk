-- ND-011: Gigs T1-T2 + Fixer Cupim
-- Static gig catalog, one active gig per character, append-only history and
-- per-district heat accumulation. Street Cred column on characters gates tiers.
ALTER TABLE "characters" ADD COLUMN "street_cred" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_street_cred_range" CHECK ("characters"."street_cred" >= 0 AND "characters"."street_cred" <= 100);--> statement-breakpoint
CREATE TYPE "public"."gig_type" AS ENUM('extraction', 'delivery', 'sabotage');--> statement-breakpoint
CREATE TYPE "public"."gig_tier" AS ENUM('t1', 't2');--> statement-breakpoint
CREATE TYPE "public"."gig_phase" AS ENUM('meet', 'legwork', 'execute', 'escape', 'wrap_up');--> statement-breakpoint
CREATE TYPE "public"."gig_outcome" AS ENUM('success', 'failure');--> statement-breakpoint
CREATE TYPE "public"."history_outcome" AS ENUM('success', 'failure', 'abandoned');--> statement-breakpoint
CREATE TABLE "gigs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"tier" "public"."gig_tier" NOT NULL,
	"type" "public"."gig_type" NOT NULL,
	"district" text NOT NULL,
	"difficulty" integer NOT NULL,
	"escape_difficulty" integer DEFAULT 40 NOT NULL,
	"required_stats" jsonb NOT NULL,
	"required_street_cred" integer DEFAULT 0 NOT NULL,
	"base_reward" integer NOT NULL,
	"nil_cost" integer NOT NULL,
	"heat_generated" integer DEFAULT 5 NOT NULL,
	"legwork_minutes" integer NOT NULL,
	"cooldown_minutes" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gigs_name_unique" UNIQUE("name"),
	CONSTRAINT "gigs_difficulty_range" CHECK ("gigs"."difficulty" BETWEEN 1 AND 100),
	CONSTRAINT "gigs_escape_difficulty_range" CHECK ("gigs"."escape_difficulty" BETWEEN 1 AND 100),
	CONSTRAINT "gigs_base_reward_positive" CHECK ("gigs"."base_reward" > 0),
	CONSTRAINT "gigs_nil_cost_positive" CHECK ("gigs"."nil_cost" > 0),
	CONSTRAINT "gigs_heat_positive" CHECK ("gigs"."heat_generated" >= 0),
	CONSTRAINT "gigs_legwork_minutes_range" CHECK ("gigs"."legwork_minutes" BETWEEN 5 AND 30),
	CONSTRAINT "gigs_sc_non_negative" CHECK ("gigs"."required_street_cred" >= 0)
);
--> statement-breakpoint
CREATE INDEX "idx_gigs_tier" ON "gigs" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "idx_gigs_type" ON "gigs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_gigs_district" ON "gigs" USING btree ("district");--> statement-breakpoint
CREATE TABLE "active_gigs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"gig_id" uuid NOT NULL,
	"phase" "public"."gig_phase" DEFAULT 'meet' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"legwork_started_at" timestamp,
	"legwork_completed" boolean DEFAULT false NOT NULL,
	"execute_outcome" "public"."gig_outcome",
	"escape_outcome" "public"."gig_outcome",
	"actual_payout" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "active_gigs_character_id_unique" UNIQUE("character_id"),
	CONSTRAINT "active_gigs_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "active_gigs_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "idx_active_gigs_character" ON "active_gigs" USING btree ("character_id");--> statement-breakpoint
CREATE TABLE "gig_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"gig_id" uuid NOT NULL,
	"outcome" "public"."history_outcome" NOT NULL,
	"phases_completed" text[] NOT NULL,
	"payout" integer DEFAULT 0 NOT NULL,
	"street_cred_gained" integer DEFAULT 0 NOT NULL,
	"heat_accumulated" integer DEFAULT 0 NOT NULL,
	"district" text NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gig_history_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "gig_history_gig_id_gigs_id_fk" FOREIGN KEY ("gig_id") REFERENCES "public"."gigs"("id") ON DELETE restrict ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "idx_gig_history_character" ON "gig_history" USING btree ("character_id","completed_at" desc);--> statement-breakpoint
CREATE INDEX "idx_gig_history_completed_at" ON "gig_history" USING btree ("completed_at");--> statement-breakpoint
CREATE TABLE "heat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"district" text NOT NULL,
	"amount" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "heat_character_district" UNIQUE("character_id","district"),
	CONSTRAINT "heat_amount_non_negative" CHECK ("heat"."amount" >= 0),
	CONSTRAINT "heat_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX "idx_heat_character" ON "heat" USING btree ("character_id");

-- ============================================================================
-- DOWN (manual rollback — drizzle migrations are up-only, run in order)
-- ============================================================================
-- DROP INDEX "idx_heat_character";
-- DROP TABLE "heat";
-- DROP TABLE "gig_history";
-- DROP TABLE "active_gigs";
-- DROP TABLE "gigs";
-- DROP TYPE "public"."history_outcome";
-- DROP TYPE "public"."gig_outcome";
-- DROP TYPE "public"."gig_phase";
-- DROP TYPE "public"."gig_tier";
-- DROP TYPE "public"."gig_type";
-- ALTER TABLE "characters" DROP CONSTRAINT "characters_street_cred_range";
-- ALTER TABLE "characters" DROP COLUMN "street_cred";
