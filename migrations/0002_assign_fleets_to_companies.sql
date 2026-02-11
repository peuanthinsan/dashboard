ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL;


WITH fleet_company_guess AS (
  SELECT DISTINCT ON ("organizationId")
    "organizationId",
    "companyId"
  FROM "Dashboard"
  WHERE "organizationId" IS NOT NULL
    AND "companyId" IS NOT NULL
  ORDER BY "organizationId", id DESC
)
UPDATE "Organization" AS org
SET "companyId" = guess."companyId"
FROM fleet_company_guess AS guess
WHERE org.id = guess."organizationId"
  AND org."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "Organization_companyId_idx" ON "Organization" ("companyId");

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_companyId_name_idx"
  ON "Organization" ("companyId", "name")
  WHERE "companyId" IS NOT NULL;
