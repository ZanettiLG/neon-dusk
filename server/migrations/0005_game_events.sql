-- ND-007: Telemetry Foundation
-- Append-only audit log for game events (gigs, PVP, economy, NIL). Consumed by
-- the admin metrics endpoint and the Prometheus dashboard stack.
CREATE TYPE "public"."game_event_type" AS ENUM('CHARACTER_CREATED', 'GIG_STARTED', 'GIG_COMPLETED', 'GIG_FAILED', 'PVP_ATTACK', 'PVP_DEFEAT', 'EDDIES_EARNED', 'EDDIES_SPENT', 'NIL_SPENT', 'NIL_RESTORED', 'VENDOR_PURCHASE');--> statement-breakpoint
CREATE TABLE "game_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" "game_event_type" NOT NULL,
	"actor_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "idx_game_events_type_created_at" ON "game_events" USING btree ("event_type","created_at" desc);
