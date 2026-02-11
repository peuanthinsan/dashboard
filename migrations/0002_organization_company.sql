ALTER TABLE "Organization"
ADD COLUMN "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL;

CREATE INDEX "Organization_companyId_idx" ON "Organization" ("companyId");
