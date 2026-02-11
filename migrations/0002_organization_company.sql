ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Organization_companyId_idx'
  ) THEN
    CREATE INDEX "Organization_companyId_idx" ON "Organization" ("companyId");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Organization_companyId_name_idx'
  ) THEN
    CREATE UNIQUE INDEX "Organization_companyId_name_idx"
      ON "Organization" ("companyId", "name");
  END IF;
END $$;
