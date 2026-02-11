ALTER TABLE "Organization"
ADD COLUMN "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE;

CREATE INDEX "Organization_companyId_idx" ON "Organization" ("companyId");

DELETE FROM "UserOrganization" uo
USING "Organization" o
WHERE uo."organizationId" = o.id
  AND o."companyId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "UserCompany" uc
    WHERE uc."userId" = uo."userId"
      AND uc."companyId" = o."companyId"
  );

UPDATE "User" u
SET "organizationId" = NULL
WHERE u."organizationId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Organization" o
    WHERE o.id = u."organizationId"
      AND o."companyId" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM "UserCompany" uc
        WHERE uc."userId" = u.id
          AND uc."companyId" = o."companyId"
      )
  );

UPDATE "Dashboard" d
SET "organizationId" = NULL
WHERE d."organizationId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "Organization" o
    WHERE o.id = d."organizationId"
      AND o."companyId" IS DISTINCT FROM d."companyId"
  );
