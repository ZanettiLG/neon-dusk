-- ND-016: Crews Básicas — gang social system
ALTER TYPE "transaction_type" ADD VALUE 'CREW_CREATION';--> statement-breakpoint
CREATE TABLE "crews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tag" text NOT NULL,
	"leader_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crews_name_unique" UNIQUE("name"),
	CONSTRAINT "crews_tag_unique" UNIQUE("tag"),
	CONSTRAINT "crews_name_length" CHECK (char_length("name") BETWEEN 3 AND 20),
	CONSTRAINT "crews_tag_format" CHECK ("tag" ~ '^[A-Z0-9]{3}$'),
	CONSTRAINT "crews_leader_id_characters_id_fk" FOREIGN KEY ("leader_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action
);--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "crew_id" uuid;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "crew_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "crew_members_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crew_members_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crew_members_character_id_unique" UNIQUE("character_id")
);--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_crew_member_limit()
RETURNS TRIGGER AS $$
BEGIN
    IF (SELECT COUNT(*) FROM "crew_members" WHERE "crew_id" = NEW."crew_id") >= 4 THEN
        RAISE EXCEPTION 'crew is full (max 4 members)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "trg_crew_member_limit"
    BEFORE INSERT ON "crew_members"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_crew_member_limit();--> statement-breakpoint
CREATE TABLE "crew_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"crew_id" uuid NOT NULL,
	"character_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "crew_invites_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crew_invites_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crew_invites_invited_by_characters_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "crew_invites_crew_character_unique" UNIQUE("crew_id", "character_id")
);--> statement-breakpoint
CREATE INDEX "idx_crew_members_crew_id" ON "crew_members" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "idx_crew_invites_character_id" ON "crew_invites" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_crew_invites_crew_id" ON "crew_invites" USING btree ("crew_id");--> statement-breakpoint
CREATE INDEX "idx_characters_crew_id" ON "characters" USING btree ("crew_id") WHERE "crew_id" IS NOT NULL;

-- DOWN
-- DROP INDEX "idx_characters_crew_id";
-- DROP INDEX "idx_crew_invites_crew_id";
-- DROP INDEX "idx_crew_invites_character_id";
-- DROP INDEX "idx_crew_members_crew_id";
-- DROP TABLE "crew_invites";
-- DROP TRIGGER "trg_crew_member_limit" ON "crew_members";
-- DROP FUNCTION enforce_crew_member_limit();
-- DROP TABLE "crew_members";
-- ALTER TABLE "characters" DROP CONSTRAINT "characters_crew_id_crews_id_fk";
-- ALTER TABLE "characters" DROP COLUMN "crew_id";
-- DROP TABLE "crews";
