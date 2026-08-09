-- UP
ALTER TABLE "characters"
  ADD COLUMN IF NOT EXISTS "ability_active_until"   timestamptz,
  ADD COLUMN IF NOT EXISTS "ability_cooldown_until" timestamptz;

ALTER TYPE "game_event_type" ADD VALUE IF NOT EXISTS 'ABILITY_ACTIVATED';
ALTER TYPE "game_event_type" ADD VALUE IF NOT EXISTS 'ABILITY_CONSUMED';

-- DOWN
-- Enum values cannot be removed from PG enums, so the DOWN only drops columns.
ALTER TABLE "characters"
  DROP COLUMN IF EXISTS "ability_active_until",
  DROP COLUMN IF EXISTS "ability_cooldown_until";
