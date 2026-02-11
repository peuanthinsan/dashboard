ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL;

UPDATE "Organization"
SET "companyId" = sub."companyId"
FROM (
  SELECT d."organizationId", MIN(d."companyId") AS "companyId"
  FROM "Dashboard" d
  WHERE d."organizationId" IS NOT NULL
  GROUP BY d."organizationId"
) AS sub
WHERE "Organization".id = sub."organizationId"
  AND "Organization"."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "Organization_companyId_idx" ON "Organization" ("companyId");
