ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companyId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Organization_companyId_fkey'
      AND table_name = 'Organization'
  ) THEN
    ALTER TABLE "Organization"
      ADD CONSTRAINT "Organization_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Organization_companyId_idx" ON "Organization" ("companyId");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'Organization_name_key'
      AND table_name = 'Organization'
  ) THEN
    ALTER TABLE "Organization" DROP CONSTRAINT "Organization_name_key";
  END IF;
END $$;
