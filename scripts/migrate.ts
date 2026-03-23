/**
 * Run migrations (Organization.companyId, Dashboard.alertTypes/remarks, User.showBothCompanyAndFleet).
 * Run with: bun run db:migrate  or  npx tsx scripts/migrate.ts
 * Requires POSTGRES_URL in env (from .env.local or .env).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

// Load .env.local or .env into process.env
for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path)) {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
      }
    }
    break;
  }
}

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
    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "alertTypes" JSONB`;
    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "remarks" JSONB`;
    await sql`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "showBothCompanyAndFleet" BOOLEAN DEFAULT false`;
    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
