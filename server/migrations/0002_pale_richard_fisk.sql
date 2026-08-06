ALTER TABLE "characters" ADD COLUMN "nil" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "max_nil" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "nil_updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_nil_range" CHECK ("characters"."nil" >= 0 and "characters"."nil" <= "characters"."max_nil");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_max_nil_positive" CHECK ("characters"."max_nil" > 0);