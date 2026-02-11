ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "Organization_companyId_idx" ON "Organization" ("companyId");
