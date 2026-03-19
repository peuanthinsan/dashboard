'use server';

import { drizzle } from 'drizzle-orm/postgres-js';
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  varchar,
} from 'drizzle-orm/pg-core';
import { eq, inArray } from 'drizzle-orm';
import postgres from 'postgres';
import { genSalt, hash } from 'bcrypt-ts';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';

const dbUrl = process.env.POSTGRES_URL || 'postgresql://localhost:5432/placeholder?sslmode=require';
let client = postgres(dbUrl);
let db = drizzle(client);

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
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
  },
  (table) => ({
    companyIdIdx: index('Dashboard_companyId_idx').on(table.companyId),
    organizationIdIdx: index('Dashboard_organizationId_idx').on(table.organizationId),
  }),
);

// --- Companies ---

export async function bulkCreateCompanies(names: string[]) {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  for (const name of trimmed) {
    try {
      await db.insert(companies).values({ name });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath('/admin');
  return { created, skipped };
}

export async function bulkDeleteCompanies(ids: number[]) {
  if (ids.length === 0) return;
  await db.delete(companies).where(inArray(companies.id, ids));
  revalidatePath('/admin');
}

// --- Organizations (Fleets) ---

export async function bulkCreateOrganizations(names: string[], companyId: number) {
  const trimmed = names.map((n) => n.trim()).filter(Boolean);
  if (trimmed.length === 0) return { created: 0, skipped: 0 };

  let created = 0;
  let skipped = 0;

  for (const name of trimmed) {
    try {
      await db.insert(organizations).values({ name, companyId });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath('/admin');
  return { created, skipped };
}

export async function bulkReassignOrganizations(ids: number[], companyId: number) {
  if (ids.length === 0) return;
  await db
    .update(organizations)
    .set({ companyId })
    .where(inArray(organizations.id, ids));
  revalidatePath('/admin');
}

export async function bulkDeleteOrganizations(ids: number[]) {
  if (ids.length === 0) return;
  await db.delete(organizations).where(inArray(organizations.id, ids));
  revalidatePath('/admin');
}

// --- Users ---

export async function bulkCreateUsers(emails: string[], password: string) {
  const trimmed = emails.map((e) => e.trim()).filter(Boolean);
  if (trimmed.length === 0) return { created: 0, skipped: 0 };

  const salt = await genSalt(10);
  const passwordHash = await hash(password, salt);

  let created = 0;
  let skipped = 0;

  for (const email of trimmed) {
    try {
      await db.insert(users).values({ email, password: passwordHash, isAdmin: false });
      created++;
    } catch {
      skipped++;
    }
  }

  revalidatePath('/admin');
  return { created, skipped };
}

export async function bulkAssignUsersToCompany(userIds: number[], companyId: number) {
  if (userIds.length === 0) return;

  for (const userId of userIds) {
    try {
      await db.insert(userCompanies).values({ userId, companyId });
    } catch {
      // skip duplicates
    }
  }

  revalidatePath('/admin');
}

export async function bulkAssignUsersToOrganization(userIds: number[], orgId: number) {
  if (userIds.length === 0) return;

  for (const userId of userIds) {
    try {
      await db.insert(userOrganizations).values({ userId, organizationId: orgId });
    } catch {
      // skip duplicates
    }
  }

  revalidatePath('/admin');
}

export async function bulkSetAdmin(userIds: number[], isAdmin: boolean) {
  if (userIds.length === 0) return;
  await db.update(users).set({ isAdmin }).where(inArray(users.id, userIds));
  revalidatePath('/admin');
}

export async function bulkDeleteUsers(userIds: number[]) {
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
  }[],
) {
  if (items.length === 0) return { created: 0 };

  let created = 0;

  for (const item of items) {
    try {
      await db.insert(dashboards).values({
        ...item,
        organizationId: item.organizationId ?? null,
        notes: item.notes ?? null,
        publicId: randomUUID(),
      });
      created++;
    } catch {
      // skip on error
    }
  }

  revalidatePath('/admin');
  return { created };
}

export async function bulkReassignDashboards(ids: number[], organizationId: number) {
  if (ids.length === 0) return;
  await db
    .update(dashboards)
    .set({ organizationId })
    .where(inArray(dashboards.id, ids));
  revalidatePath('/admin');
}

export async function bulkDeleteDashboards(ids: number[]) {
  if (ids.length === 0) return;
  await db.delete(dashboards).where(inArray(dashboards.id, ids));
  revalidatePath('/admin');
}
