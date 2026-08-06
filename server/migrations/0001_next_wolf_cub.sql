CREATE TYPE "public"."origin" AS ENUM('a_paraiso', 'o_fervo', 'o_fluxo', 'a_quebrada', 'babilonia', 'as_mortas', 'o_ponto');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('solo', 'netrunner', 'tech', 'fixer', 'nomad');--> statement-breakpoint
CREATE TABLE "characters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"origin" "origin" NOT NULL,
	"role" "role" NOT NULL,
	"body" integer DEFAULT 3 NOT NULL,
	"reflexes" integer DEFAULT 3 NOT NULL,
	"intelligence" integer DEFAULT 3 NOT NULL,
	"technical" integer DEFAULT 3 NOT NULL,
	"cool" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "characters_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "characters_body_range" CHECK ("characters"."body" between 1 and 20),
	CONSTRAINT "characters_reflexes_range" CHECK ("characters"."reflexes" between 1 and 20),
	CONSTRAINT "characters_intelligence_range" CHECK ("characters"."intelligence" between 1 and 20),
	CONSTRAINT "characters_technical_range" CHECK ("characters"."technical" between 1 and 20),
	CONSTRAINT "characters_cool_range" CHECK ("characters"."cool" between 1 and 20),
	CONSTRAINT "characters_attrs_total" CHECK ("characters"."body" + "characters"."reflexes" + "characters"."intelligence" + "characters"."technical" + "characters"."cool" = 22)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "characters_name_lower_idx" ON "characters" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));