-- Driving dashboard: configurable violation thresholds (hours)
ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "drivingThresholds" jsonb;
