-- Additive and safe to apply before deploying the AfterHoursEntry application build.
-- Existing dashboards retain NULL and their current behavior.
ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "afterHoursSettings" JSONB;
