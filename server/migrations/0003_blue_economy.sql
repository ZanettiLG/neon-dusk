-- ND-010: Economy Foundation
-- Drop ND-008 mock tables (safe — never applied in production)
DROP TABLE IF EXISTS "lucky_chip_bets" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "character_eddie_balances" CASCADE;--> statement-breakpoint

CREATE TYPE "public"."transaction_type" AS ENUM('GIG_PAYOUT', 'VENDOR_PURCHASE', 'PVP_REWARD', 'PVP_LOSS', 'STIM_PURCHASE', 'CREW_BONUS', 'ADMIN_ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."vendor_type" AS ENUM('RIPPERDOC', 'STIM_DEALER', 'FIXER', 'BLACK_MARKET');--> statement-breakpoint
CREATE TABLE "character_wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"balance" bigint DEFAULT 0 NOT NULL,
	"escrow" bigint DEFAULT 0 NOT NULL,
	"lifetime_earned" bigint DEFAULT 0 NOT NULL,
	"lifetime_spent" bigint DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "character_wallets_character_id_unique" UNIQUE("character_id"),
	CONSTRAINT "character_wallets_balance_non_negative" CHECK ("character_wallets"."balance" >= 0),
	CONSTRAINT "character_wallets_escrow_non_negative" CHECK ("character_wallets"."escrow" >= 0),
	CONSTRAINT "character_wallets_escrow_lte_balance" CHECK ("character_wallets"."escrow" <= "character_wallets"."balance"),
	CONSTRAINT "character_wallets_lifetime_earned_non_negative" CHECK ("character_wallets"."lifetime_earned" >= 0),
	CONSTRAINT "character_wallets_lifetime_spent_non_negative" CHECK ("character_wallets"."lifetime_spent" >= 0)
);
--> statement-breakpoint
CREATE TABLE "loot_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gig_tier" text NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"weight" real NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"max_quantity" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "loot_tables_weight_positive" CHECK ("loot_tables"."weight" > 0),
	CONSTRAINT "loot_tables_quantity_range" CHECK ("loot_tables"."min_quantity" >= 1 AND "loot_tables"."max_quantity" >= "loot_tables"."min_quantity")
);
--> statement-breakpoint
CREATE TABLE "transaction_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"character_id" uuid NOT NULL,
	"type" "transaction_type" NOT NULL,
	"amount" bigint NOT NULL,
	"balance_before" bigint NOT NULL,
	"balance_after" bigint NOT NULL,
	"source" text NOT NULL,
	"reference_type" text,
	"reference_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "transaction_log_balance_check" CHECK ("transaction_log"."balance_after" - "transaction_log"."balance_before" = "transaction_log"."amount")
);
--> statement-breakpoint
CREATE TABLE "vendor_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"item_id" text NOT NULL,
	"price" bigint NOT NULL,
	"stock" integer DEFAULT -1 NOT NULL,
	CONSTRAINT "vendor_inventory_price_positive" CHECK ("vendor_inventory"."price" > 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "vendor_type" NOT NULL,
	"district" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "character_wallets" ADD CONSTRAINT "character_wallets_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_log" ADD CONSTRAINT "transaction_log_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_inventory" ADD CONSTRAINT "vendor_inventory_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transaction_log_character_id" ON "transaction_log" USING btree ("character_id","created_at" desc);--> statement-breakpoint
CREATE INDEX "idx_transaction_log_type" ON "transaction_log" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_inventory_unique_item" ON "vendor_inventory" USING btree ("vendor_id","item_type","item_id");