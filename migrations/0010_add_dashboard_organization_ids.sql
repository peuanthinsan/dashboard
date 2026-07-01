-- Multi-fleet dashboard scoping: a dashboard can be limited to a set of fleets.
-- organizationIds is the source of truth for scope; organizationId stays as the
-- "primary" fleet (= organizationIds[0]) for LINE-channel binding, warning-send
-- permission, and access checks. Backfill the array from the existing scalar.
ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "organizationIds" JSONB;

UPDATE "Dashboard"
SET "organizationIds" = jsonb_build_array("organizationId")
WHERE "organizationId" IS NOT NULL
  AND "organizationIds" IS NULL;
