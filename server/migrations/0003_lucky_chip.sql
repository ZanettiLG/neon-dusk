-- ND-008: Lucky Chip disposable test minigame
-- Tabelas temporárias — serão removidas/substituídas em ND-010 (Economia)

CREATE TABLE "character_eddie_balances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" uuid NOT NULL,
  "amount" integer DEFAULT 1000 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "character_eddie_balances_amount_non_negative" CHECK ("character_eddie_balances"."amount" >= 0)
);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_character_eddie_balances_character" ON "character_eddie_balances" USING btree ("character_id");--> statement-breakpoint
CREATE TABLE "lucky_chip_bets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "character_id" uuid NOT NULL,
  "bet_amount" integer NOT NULL,
  "roll_result" integer NOT NULL,
  "payout" integer DEFAULT 0 NOT NULL,
  "balance_before" integer NOT NULL,
  "balance_after" integer NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_lucky_chip_bets_character" ON "lucky_chip_bets" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_lucky_chip_bets_created_at" ON "lucky_chip_bets" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
-- Down migration:
-- DROP TABLE IF EXISTS "lucky_chip_bets" CASCADE;
-- DROP TABLE IF EXISTS "character_eddie_balances" CASCADE;
