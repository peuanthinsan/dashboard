/**
 * Run the Organization.companyId migration.
 * Run with: npx tsx scripts/migrate.ts
 * Requires POSTGRES_URL in env.
 */
import postgres from 'postgres';

const url = process.env.POSTGRES_URL;
if (!url) {
  console.error('POSTGRES_URL is required');
  process.exit(1);
}

const sql = postgres(`${url}?sslmode=require`);

async function migrate() {
  try {
    await sql`
      ALTER TABLE "Organization"
      ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL
    `;
    await sql`CREATE INDEX IF NOT EXISTS "Organization_companyId_idx" ON "Organization" ("companyId")`;
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
