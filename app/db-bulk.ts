'use server';

import { requireAdmin } from './admin/admin-utils';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  varchar,
} from 'drizzle-orm/pg-core';
import { inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { genSalt, hash } from 'bcrypt-ts';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { normalizeDrivingThresholds } from './dashboards/drivingThresholds';

const dbUrl = process.env.POSTGRES_URL || 'postgresql://localhost:5432/placeholder?sslmode=require';
const client = postgres(dbUrl);
const db = drizzle(client);

// --- Schema re-declarations (mirrors app/db.ts) ---

const users = pgTable(
  'User',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 64 }).notNull().unique(),
    password: varchar('password', { length: 64 }).notNull(),
    isAdmin: boolean('isAdmin').default(false),
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
  },
  (table) => ({
    companyIdIdx: index('User_companyId_idx').on(table.companyId),
    organizationIdIdx: index('User_organizationId_idx').on(table.organizationId),
  }),
);

const userCompanies = pgTable(
  'UserCompany',
  {
    userId: integer('userId').notNull(),
    companyId: integer('companyId').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.companyId] }),
    userIdIdx: index('UserCompany_userId_idx').on(table.userId),
    companyIdIdx: index('UserCompany_companyId_idx').on(table.companyId),
  }),
);

const userOrganizations = pgTable(
  'UserOrganization',
  {
    userId: integer('userId').notNull(),
    organizationId: integer('organizationId').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
    userIdIdx: index('UserOrganization_userId_idx').on(table.userId),
    organizationIdIdx: index('UserOrganization_organizationId_idx').on(table.organizationId),
  }),
);

const companies = pgTable('Company', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  alertRules: jsonb('alertRules').$type<import('./dashboards/dashboardDataUtils').AlertRule[]>(),
});

const organizations = pgTable(
  'Organization',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 128 }).notNull().unique(),
    companyId: integer('companyId'),
  },
  (table) => ({
    companyIdIdx: index('Organization_companyId_idx').on(table.companyId),
  }),
);

const dashboards = pgTable(
  'Dashboard',
  {
    id: serial('id').primaryKey(),
    publicId: varchar('publicId', { length: 36 }).unique(),
    name: varchar('name', { length: 128 }).notNull(),
    template: varchar('template', { length: 32 }).notNull(),
    sheetId: varchar('sheetId', { length: 128 }).notNull(),
    sheetGid: varchar('sheetGid', { length: 24 }).notNull(),
    sheetUrl: varchar('sheetUrl', { length: 512 }).notNull(),
    notes: text('notes'),
    alertTypes: jsonb('alertTypes').$type<string[]>(),
    remarks: jsonb('remarks').$type<string[]>(),
    drivingThresholds: jsonb('drivingThresholds').$type<{
      continuousDrivingMaxHours: number;
      restMinimumHours: number;
      workingHoursMax: number;
    }>(),
    alertRules: jsonb('alertRules').$type<import('./dashboards/dashboardDataUtils').AlertRule[]>(),
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
    lineChannelId: integer('lineChannelId'),
  },
  (table) => ({
    companyIdIdx: index('Dashboard_companyId_idx').on(table.companyId),
    organizationIdIdx: index('Dashboard_organizationId_idx').on(table.organizationId),
    lineChannelIdIdx: index('Dashboard_lineChannelId_idx').on(table.lineChannelId),
  }),
);

// --- Companies ---

export async function bulkCreateCompanies(names: string[]) {
  await requireAdmin();
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  for (const name of trimmed) {
    try {
      await db.insert(companies).values({ name });
      created++;
    } catch (err) {
      // Most common cause is a unique-constraint violation (expected for
      // "skip duplicate names" semantics). Anything else is worth seeing
      // in logs so unexpected failures don't silently count as "skipped".
      if (!(err instanceof Error) || !/unique|duplicate/i.test(err.message)) {
        console.error('bulk insert failed:', err);
      }
      skipped++;
    }
  }

  revalidatePath('/admin');
  return { created, skipped };
}

export async function bulkDeleteCompanies(ids: number[]) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.delete(companies).where(inArray(companies.id, ids));
  revalidatePath('/admin');
}

// --- Organizations (Fleets) ---

export async function bulkCreateOrganizations(names: string[], companyId: number) {
  await requireAdmin();
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  for (const name of trimmed) {
    try {
      await db.insert(organizations).values({ name, companyId });
      created++;
    } catch (err) {
      // Most common cause is a unique-constraint violation (expected for
      // "skip duplicate names" semantics). Anything else is worth seeing
      // in logs so unexpected failures don't silently count as "skipped".
      if (!(err instanceof Error) || !/unique|duplicate/i.test(err.message)) {
        console.error('bulk insert failed:', err);
      }
      skipped++;
    }
  }

  revalidatePath('/admin');
  return { created, skipped };
}

export async function bulkReassignOrganizations(ids: number[], companyId: number) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db
    .update(organizations)
    .set({ companyId })
    .where(inArray(organizations.id, ids));
  revalidatePath('/admin');
}

export async function bulkDeleteOrganizations(ids: number[]) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.delete(organizations).where(inArray(organizations.id, ids));
  revalidatePath('/admin');
}

// --- Users ---

export async function bulkCreateUsers(emails: string[], password: string) {
  await requireAdmin();
  const trimmed = emails.map((e) => e.trim()).filter(Boolean);
  if (trimmed.length === 0) return { created: 0, skipped: 0 };
  if (typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters.');
  }

  const salt = await genSalt(10);
  const passwordHash = await hash(password, salt);

  let created = 0;
  let skipped = 0;

  for (const email of trimmed) {
    try {
      await db.insert(users).values({ email, password: passwordHash, isAdmin: false });
      created++;
    } catch (err) {
      // Most common cause is a unique-constraint violation (expected for
      // "skip duplicate names" semantics). Anything else is worth seeing
      // in logs so unexpected failures don't silently count as "skipped".
      if (!(err instanceof Error) || !/unique|duplicate/i.test(err.message)) {
        console.error('bulk insert failed:', err);
      }
      skipped++;
    }
  }

  revalidatePath('/admin');
  return { created, skipped };
}

export async function bulkAssignUsersToCompany(userIds: number[], companyId: number) {
  await requireAdmin();
  if (userIds.length === 0) return;

  for (const userId of userIds) {
    try {
      await db.insert(userCompanies).values({ userId, companyId });
    } catch (err) {
      if (!(err instanceof Error) || !/unique|duplicate/i.test(err.message)) {
        console.error('bulkAssignUsersToCompany failed:', err);
      }
    }
  }

  revalidatePath('/admin');
}

export async function bulkAssignUsersToOrganization(userIds: number[], orgId: number) {
  await requireAdmin();
  if (userIds.length === 0) return;

  for (const userId of userIds) {
    try {
      await db.insert(userOrganizations).values({ userId, organizationId: orgId });
    } catch (err) {
      if (!(err instanceof Error) || !/unique|duplicate/i.test(err.message)) {
        console.error('bulkAssignUsersToOrganization failed:', err);
      }
    }
  }

  revalidatePath('/admin');
}

export async function bulkSetAdmin(userIds: number[], isAdmin: boolean) {
  await requireAdmin();
  if (userIds.length === 0) return;
  await db.update(users).set({ isAdmin }).where(inArray(users.id, userIds));
  revalidatePath('/admin');
}

export async function bulkDeleteUsers(userIds: number[]) {
  await requireAdmin();
  if (userIds.length === 0) return;
  await db.delete(users).where(inArray(users.id, userIds));
  revalidatePath('/admin');
}

// --- Dashboards ---

export async function bulkCreateDashboards(
  items: {
    name: string;
    template: string;
    sheetId: string;
    sheetGid: string;
    sheetUrl: string;
    companyId: number;
    organizationId?: number;
    notes?: string;
    /** When set, restricts MDVR dashboards; null/undefined = use app defaults at runtime. */
    alertTypes?: string[] | null;
    remarks?: string[] | null;
  }[],
) {
  await requireAdmin();
  if (items.length === 0) return { created: 0 };

  let created = 0;

  for (const item of items) {
    try {
      const { alertTypes, remarks, ...rest } = item;
      await db.insert(dashboards).values({
        ...rest,
        organizationId: item.organizationId ?? null,
        notes: item.notes ?? null,
        alertTypes: alertTypes && alertTypes.length > 0 ? alertTypes : null,
        remarks: remarks && remarks.length > 0 ? remarks : null,
        publicId: randomUUID(),
      });
      created++;
    } catch (err) {
      console.error('bulkCreateDashboards: insert failed:', err);
    }
  }

  revalidatePath('/admin');
  return { created };
}

export async function bulkReassignDashboards(ids: number[], organizationId: number) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db
    .update(dashboards)
    .set({ organizationId })
    .where(inArray(dashboards.id, ids));
  revalidatePath('/admin');
}

export async function bulkDeleteDashboards(ids: number[]) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.delete(dashboards).where(inArray(dashboards.id, ids));
  revalidatePath('/admin');
}

type LegacyDrivingThresholdsShape = {
  continuousDrivingMaxHours: number;
  restMinimumHours: number;
  workingHoursMax: number;
};

export async function bulkUpdateDashboardFields(
  ids: number[],
  payload: {
    alertTypes?: string[] | null;
    remarks?: string[] | null;
    /** Pass any DrivingThresholds-like shape; normalized server-side. Omit to leave column untouched. */
    drivingThresholds?: unknown;
    /** number = assign, null = clear, undefined = leave untouched. */
    lineChannelId?: number | null;
  }
) {
  await requireAdmin();
  if (ids.length === 0) return;

  const setData: Partial<typeof dashboards.$inferInsert> = {};
  if (payload.alertTypes !== undefined) {
    setData.alertTypes = payload.alertTypes && payload.alertTypes.length > 0 ? payload.alertTypes : null;
  }
  if (payload.remarks !== undefined) {
    setData.remarks = payload.remarks && payload.remarks.length > 0 ? payload.remarks : null;
  }
  if (payload.drivingThresholds !== undefined) {
    // jsonb column; the runtime shape is the new {driveHours, restHours} form. The schema's
    // declared `$type` still reflects the legacy shape so we cast through unknown.
    setData.drivingThresholds = normalizeDrivingThresholds(
      payload.drivingThresholds,
    ) as unknown as LegacyDrivingThresholdsShape;
  }
  if (payload.lineChannelId !== undefined) {
    setData.lineChannelId = payload.lineChannelId;
  }

  if (Object.keys(setData).length === 0) return;

  await db.update(dashboards).set(setData).where(inArray(dashboards.id, ids));
  revalidatePath('/admin');
}

type AlertRule = import('./dashboards/dashboardDataUtils').AlertRule;

/** Invalidate the dashboard listing AND every /dashboard/[publicId] page. */
function revalidateDashboardPages() {
  revalidatePath('/admin');
  revalidatePath('/dashboard');
  revalidatePath('/dashboard/[id]', 'page');
}

export async function bulkApplyDashboardAlertRules(
  ids: number[],
  rules: AlertRule[],
  mode: 'append' | 'replace',
) {
  await requireAdmin();
  if (ids.length === 0) return { updated: 0 };
  const updated = await db.transaction(async (tx) => {
    if (mode === 'replace') {
      await tx
        .update(dashboards)
        .set({ alertRules: rules.length > 0 ? rules : null })
        .where(inArray(dashboards.id, ids));
      return ids.length;
    }
    const existing = await tx
      .select({ id: dashboards.id, alertRules: dashboards.alertRules })
      .from(dashboards)
      .where(inArray(dashboards.id, ids));
    for (const row of existing) {
      const merged = [...(row.alertRules ?? []), ...rules];
      await tx
        .update(dashboards)
        .set({ alertRules: merged.length > 0 ? merged : null })
        .where(inArray(dashboards.id, [row.id]));
    }
    return existing.length;
  });
  revalidateDashboardPages();
  return { updated };
}

async function rewriteAlertRulesByMatch<T extends { id: number; alertRules: AlertRule[] | null }>(
  rows: T[],
  targetSignature: string,
  replacement: AlertRule | null,
  signatureOf: (rule: AlertRule) => string,
) {
  return rows
    .map((row) => {
      const rules = row.alertRules ?? [];
      if (rules.length === 0) return null;
      let changed = false;
      const next: AlertRule[] = [];
      for (const r of rules) {
        if (signatureOf(r) === targetSignature) {
          changed = true;
          if (replacement) next.push({ ...replacement, id: r.id });
        } else {
          next.push(r);
        }
      }
      return changed ? { id: row.id, rules: next } : null;
    })
    .filter((x): x is { id: number; rules: AlertRule[] } => x !== null);
}

export async function bulkEditDashboardAlertRule(
  ids: number[],
  targetSignature: string,
  replacement: AlertRule,
) {
  await requireAdmin();
  if (ids.length === 0) return { updated: 0 };
  const { alertRuleSignature } = await import('./dashboards/dashboardDataUtils');
  const updatedCount = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: dashboards.id, alertRules: dashboards.alertRules })
      .from(dashboards)
      .where(inArray(dashboards.id, ids));
    const updates = await rewriteAlertRulesByMatch(rows, targetSignature, replacement, alertRuleSignature);
    for (const u of updates) {
      await tx.update(dashboards).set({ alertRules: u.rules }).where(inArray(dashboards.id, [u.id]));
    }
    return updates.length;
  });
  revalidateDashboardPages();
  return { updated: updatedCount };
}

export async function bulkRemoveDashboardAlertRule(ids: number[], targetSignature: string) {
  await requireAdmin();
  if (ids.length === 0) return { updated: 0 };
  const { alertRuleSignature } = await import('./dashboards/dashboardDataUtils');
  const updatedCount = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: dashboards.id, alertRules: dashboards.alertRules })
      .from(dashboards)
      .where(inArray(dashboards.id, ids));
    const updates = await rewriteAlertRulesByMatch(rows, targetSignature, null, alertRuleSignature);
    for (const u of updates) {
      await tx
        .update(dashboards)
        .set({ alertRules: u.rules.length > 0 ? u.rules : null })
        .where(inArray(dashboards.id, [u.id]));
    }
    return updates.length;
  });
  revalidateDashboardPages();
  return { updated: updatedCount };
}

export async function bulkEditCompanyAlertRule(
  ids: number[],
  targetSignature: string,
  replacement: AlertRule,
) {
  await requireAdmin();
  if (ids.length === 0) return { updated: 0 };
  const { alertRuleSignature } = await import('./dashboards/dashboardDataUtils');
  const updatedCount = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: companies.id, alertRules: companies.alertRules })
      .from(companies)
      .where(inArray(companies.id, ids));
    const updates = await rewriteAlertRulesByMatch(rows, targetSignature, replacement, alertRuleSignature);
    for (const u of updates) {
      await tx.update(companies).set({ alertRules: u.rules }).where(inArray(companies.id, [u.id]));
    }
    return updates.length;
  });
  revalidateDashboardPages();
  return { updated: updatedCount };
}

export async function bulkRemoveCompanyAlertRule(ids: number[], targetSignature: string) {
  await requireAdmin();
  if (ids.length === 0) return { updated: 0 };
  const { alertRuleSignature } = await import('./dashboards/dashboardDataUtils');
  const updatedCount = await db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: companies.id, alertRules: companies.alertRules })
      .from(companies)
      .where(inArray(companies.id, ids));
    const updates = await rewriteAlertRulesByMatch(rows, targetSignature, null, alertRuleSignature);
    for (const u of updates) {
      await tx
        .update(companies)
        .set({ alertRules: u.rules.length > 0 ? u.rules : null })
        .where(inArray(companies.id, [u.id]));
    }
    return updates.length;
  });
  revalidateDashboardPages();
  return { updated: updatedCount };
}

export async function bulkApplyCompanyAlertRules(
  ids: number[],
  rules: AlertRule[],
  mode: 'append' | 'replace',
) {
  await requireAdmin();
  if (ids.length === 0) return { updated: 0 };
  const updated = await db.transaction(async (tx) => {
    if (mode === 'replace') {
      await tx
        .update(companies)
        .set({ alertRules: rules.length > 0 ? rules : null })
        .where(inArray(companies.id, ids));
      return ids.length;
    }
    const existing = await tx
      .select({ id: companies.id, alertRules: companies.alertRules })
      .from(companies)
      .where(inArray(companies.id, ids));
    for (const row of existing) {
      const merged = [...(row.alertRules ?? []), ...rules];
      await tx
        .update(companies)
        .set({ alertRules: merged.length > 0 ? merged : null })
        .where(inArray(companies.id, [row.id]));
    }
    return existing.length;
  });
  revalidateDashboardPages();
  return { updated };
}
