-- Additive schema only. Apply before deploying the roster-enabled application.
ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "driverRosterSettings" JSONB;
