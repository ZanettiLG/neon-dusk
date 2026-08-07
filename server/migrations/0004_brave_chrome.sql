CREATE TYPE "public"."chrome_slot" AS ENUM('frontal_cortex', 'ocular', 'arms', 'skeleton', 'nervous_system', 'integumentary');--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'CHROME_PURCHASE';--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'CHROME_UNINSTALL';--> statement-breakpoint
CREATE TABLE "chrome_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"slot" "chrome_slot" NOT NULL,
	"tier" integer NOT NULL,
	"bonuses" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"humanity_cost" integer NOT NULL,
	"base_price" bigint NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chrome_definitions_slug_unique" UNIQUE("slug"),
	CONSTRAINT "chrome_definitions_tier_range" CHECK ("chrome_definitions"."tier" between 1 and 5),
	CONSTRAINT "chrome_definitions_humanity_cost_positive" CHECK ("chrome_definitions"."humanity_cost" > 0),
	CONSTRAINT "chrome_definitions_base_price_positive" CHECK ("chrome_definitions"."base_price" > 0)
);
--> statement-breakpoint
CREATE TABLE "installed_chrome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"chrome_definition_id" uuid NOT NULL,
	"installed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "humanity" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "installed_chrome" ADD CONSTRAINT "installed_chrome_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installed_chrome" ADD CONSTRAINT "installed_chrome_chrome_definition_id_chrome_definitions_id_fk" FOREIGN KEY ("chrome_definition_id") REFERENCES "public"."chrome_definitions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "installed_chrome_character_definition_unique" ON "installed_chrome" USING btree ("character_id","chrome_definition_id");--> statement-breakpoint
CREATE INDEX "idx_installed_chrome_character_id" ON "installed_chrome" USING btree ("character_id");--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_humanity_range" CHECK ("characters"."humanity" >= 0 and "characters"."humanity" <= 100);--> statement-breakpoint
-- Seed data: 5 starter implants (T1-T2, prices/humanity per 04-sistemas-e-progressao.md §3-4)--> statement-breakpoint
INSERT INTO "chrome_definitions" ("slug", "name", "slot", "tier", "bonuses", "humanity_cost", "base_price", "description") VALUES
	('neural-booster', 'Neural Booster', 'frontal_cortex', 1, '{"intelligence": 1}'::jsonb, 3, 800, 'Impulso neural que acelera o processamento cognitivo. +1 Inteligência.'),
	('reflex-tuner', 'Reflex Tuner', 'nervous_system', 1, '{"reflexes": 1}'::jsonb, 3, 800, 'Ajuste de sinapses para reação quase instantânea. +1 Reflexos.'),
	('kiroshi-optics', 'Kiroshi Optics', 'ocular', 1, '{"gig_success_rate": 2}'::jsonb, 2, 900, 'Óptica de combate Kiroshi com HUD tático. +2% de sucesso em gigs.'),
	('gorilla-arms', 'Gorilla Arms', 'arms', 2, '{"body": 2}'::jsonb, 6, 2500, 'Braços cibernéticos de impacto pesado. +2 Corpo.'),
	('subdermal-armor', 'Subdermal Armor', 'integumentary', 2, '{"max_hp": 15}'::jsonb, 7, 2000, 'Malha balística implantada sob a pele. +15 HP máximo.');--> statement-breakpoint
-- Seed data: ripperdoc "Doc Fios" (Babilônia) + inventory for all 5 implants.
-- Vendor price = base price, so the catalog and the checkout never disagree.
-- T1 (500-1000) is starter-affordable against the 1000-eddie seed balance.--> statement-breakpoint
INSERT INTO "vendors" ("id", "name", "type", "district", "description") VALUES ('00000000-0000-4000-8000-000000000001', 'Doc Fios', 'RIPPERDOC', 'babilonia', 'Ripperdoc veterano da Babilônia. Mão firme — se você sobreviver à cirurgia, o chrome funciona.');--> statement-breakpoint
INSERT INTO "vendor_inventory" ("vendor_id", "item_type", "item_id", "price", "stock") VALUES
	('00000000-0000-4000-8000-000000000001', 'CHROME', 'neural-booster', 800, -1),
	('00000000-0000-4000-8000-000000000001', 'CHROME', 'reflex-tuner', 800, -1),
	('00000000-0000-4000-8000-000000000001', 'CHROME', 'kiroshi-optics', 900, -1),
	('00000000-0000-4000-8000-000000000001', 'CHROME', 'gorilla-arms', 2500, -1),
	('00000000-0000-4000-8000-000000000001', 'CHROME', 'subdermal-armor', 2000, -1);