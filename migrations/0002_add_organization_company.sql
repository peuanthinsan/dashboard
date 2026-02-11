ALTER TABLE "Organization"
ADD COLUMN "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE;

CREATE INDEX "Organization_companyId_idx" ON "Organization" ("companyId");
