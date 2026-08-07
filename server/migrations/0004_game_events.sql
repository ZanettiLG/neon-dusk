CREATE TYPE "public"."game_event_type" AS ENUM (
  'CHARACTER_CREATED',
  'GIG_STARTED',
  'GIG_COMPLETED',
  'GIG_FAILED',
  'PVP_ATTACK',
  'PVP_DEFEAT',
  'EDDIES_EARNED',
  'EDDIES_SPENT',
  'NIL_SPENT',
  'NIL_RESTORED',
  'VENDOR_PURCHASE'
);

CREATE TABLE "game_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_type" "game_event_type" NOT NULL,
  "actor_id" uuid,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "idx_game_events_created_at_type" ON "game_events" ("created_at" DESC, "event_type");

-- Down
-- DROP TABLE "game_events";
-- DROP TYPE "game_event_type";
