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
    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "alertRules" JSONB`;
    await sql`ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "alertRules" JSONB`;

    // ── Driving v2 ────────────────────────────────────────────────────────
    await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;

    await sql`
      CREATE TABLE IF NOT EXISTS "LineChannel" (
        "id" serial PRIMARY KEY NOT NULL,
        "organizationId" integer NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
        "name" varchar(64) NOT NULL,
        "accessToken" text NOT NULL,
        "groupId" varchar(64) NOT NULL,
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL,
        "updatedAt" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS "LineChannel_organizationId_idx" ON "LineChannel" ("organizationId")`;

    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "lineChannelId" integer REFERENCES "LineChannel"(id) ON DELETE SET NULL`;
    await sql`CREATE INDEX IF NOT EXISTS "Dashboard_lineChannelId_idx" ON "Dashboard" ("lineChannelId")`;

    await sql`
      CREATE TABLE IF NOT EXISTS "DrivingWarning" (
        "id" serial PRIMARY KEY NOT NULL,
        "dashboardId" integer NOT NULL REFERENCES "Dashboard"(id) ON DELETE CASCADE,
        "violationKey" varchar(64) NOT NULL,
        "driverName" varchar(128) NOT NULL,
        "vehicleNo" varchar(64) NOT NULL,
        "eventAt" timestamp with time zone NOT NULL,
        "metric" varchar(16) NOT NULL CHECK ("metric" IN ('drive_hrs','rest_hrs')),
        "threshold" numeric NOT NULL,
        "valueHours" numeric NOT NULL,
        "distanceKm" numeric,
        "loginAt" timestamp with time zone,
        "logoutAt" timestamp with time zone,
        "loginLocation" varchar(256),
        "logoutLocation" varchar(256),
        "lineChannelId" integer REFERENCES "LineChannel"(id) ON DELETE SET NULL,
        "sentByUserId" integer NOT NULL REFERENCES "User"(id),
        "sentAt" timestamp with time zone,
        "lineMessageId" varchar(64),
        "lineStatus" varchar(16) NOT NULL CHECK ("lineStatus" IN ('pending','sent','failed')),
        "errorMessage" text,
        "operatorNote" varchar(500),
        "createdAt" timestamp with time zone DEFAULT now() NOT NULL
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "DrivingWarning_dashboard_key_unique" ON "DrivingWarning" ("dashboardId","violationKey")`;
    await sql`CREATE INDEX IF NOT EXISTS "DrivingWarning_dashboard_sentAt_idx" ON "DrivingWarning" ("dashboardId","sentAt")`;

    // ── Driving dual-sheet tabs (migration 0008) ───────────────────────────
    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "sheetGidCntDrv" VARCHAR(24)`;
    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "sheetUrlCntDrv" VARCHAR(512)`;

    await sql`ALTER TABLE "Dashboard" ADD COLUMN IF NOT EXISTS "drivingThresholds" JSONB`;

    // Extend DrivingWarning.metric to include continuous-drive violations
    await sql`
      ALTER TABLE "DrivingWarning" DROP CONSTRAINT IF EXISTS "DrivingWarning_metric_check"
    `;
    await sql`
      ALTER TABLE "DrivingWarning"
      ADD CONSTRAINT "DrivingWarning_metric_check"
      CHECK ("metric" IN ('drive_hrs', 'rest_hrs', 'cnt_drv_hrs'))
    `;

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
