-- ND-076: Chrome neural implants increase NIL max by 10/tier.
-- Updates the Neural Booster (frontal_cortex) to grant +10 NIL max.
-- Uses JSONB merge so re-runs are idempotent.
UPDATE "chrome_definitions"
SET "bonuses" = "bonuses" || '{"nil_max": 10}'::jsonb
WHERE "slug" = 'neural-booster';
