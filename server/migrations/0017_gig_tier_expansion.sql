-- UP
ALTER TYPE "public"."gig_tier" ADD VALUE IF NOT EXISTS 't3';
ALTER TYPE "public"."gig_tier" ADD VALUE IF NOT EXISTS 't4';
ALTER TYPE "public"."gig_tier" ADD VALUE IF NOT EXISTS 't5';

-- DOWN
-- Enum values cannot be removed from PG enums. To rollback:
-- 1. Rename gig_tier to gig_tier_old
-- 2. Create new gig_tier with only t1, t2
-- 3. Migrate gigs table data (cast + filter out t3-t5)
-- 4. Drop gig_tier_old
-- Not automated — run manually if needed.
