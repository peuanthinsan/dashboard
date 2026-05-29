/**
 * One-off verifier: confirm Driving v2 schema is applied to the live DB.
 * Run: npx tsx scripts/verify-driving-v2-schema.ts
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

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
if (!url) { console.error('POSTGRES_URL is required'); process.exit(1); }

const sql = postgres(`${url}?sslmode=require`);

async function main() {
  try {
    const tables = await sql<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema='public' AND table_name IN ('LineChannel','DrivingWarning')
      ORDER BY table_name
    `;
    console.log('Tables present:', tables.map((t) => t.table_name));

    const lineChannelCols = await sql<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='LineChannel'
      ORDER BY ordinal_position
    `;
    console.log('LineChannel columns:', lineChannelCols);

    const drivingWarningCols = await sql<{ column_name: string; data_type: string }[]>`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='DrivingWarning'
      ORDER BY ordinal_position
    `;
    console.log('DrivingWarning columns:', drivingWarningCols);

    const dashboardHasFk = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='Dashboard' AND column_name='lineChannelId'
    `;
    console.log('Dashboard.lineChannelId present:', dashboardHasFk.length === 1);

    const cntDrvCols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema='public' AND table_name='Dashboard'
        AND column_name IN ('sheetGidCntDrv', 'sheetUrlCntDrv')
      ORDER BY column_name
    `;
    console.log('Dashboard dual-sheet columns (0008):', cntDrvCols.map((c) => c.column_name));
    if (cntDrvCols.length !== 2) {
      console.error('Missing sheetGidCntDrv or sheetUrlCntDrv — run: npm run db:migrate');
      process.exit(1);
    }

    const pgcryptoExists = await sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname='pgcrypto'
    `;
    console.log('pgcrypto extension installed:', pgcryptoExists.length === 1);

    const indexes = await sql<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE schemaname='public'
        AND indexname IN (
          'LineChannel_organizationId_idx',
          'Dashboard_lineChannelId_idx',
          'DrivingWarning_dashboard_key_unique',
          'DrivingWarning_dashboard_sentAt_idx'
        )
      ORDER BY indexname
    `;
    console.log('Driving v2 indexes:', indexes.map((i) => i.indexname));
  } catch (err) {
    console.error('Verification failed:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
