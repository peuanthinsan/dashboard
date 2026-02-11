import { drizzle } from 'drizzle-orm/postgres-js';
import { boolean, index, integer, pgTable, primaryKey, serial, text, varchar } from 'drizzle-orm/pg-core';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { genSalt, hash } from 'bcrypt-ts';
import { randomUUID } from 'crypto';
import { cache } from 'react';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
let db = drizzle(client);

const users = pgTable('User', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 64 }).notNull().unique(),
  password: varchar('password', { length: 64 }).notNull(),
  isAdmin: boolean('isAdmin').default(false),
  companyId: integer('companyId'),
  organizationId: integer('organizationId'),
}, (table) => ({
  companyIdIdx: index('User_companyId_idx').on(table.companyId),
  organizationIdIdx: index('User_organizationId_idx').on(table.organizationId),
}));

const userCompanies = pgTable('UserCompany', {
  userId: integer('userId').notNull(),
  companyId: integer('companyId').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.companyId] }),
  userIdIdx: index('UserCompany_userId_idx').on(table.userId),
  companyIdIdx: index('UserCompany_companyId_idx').on(table.companyId),
}));

const userOrganizations = pgTable('UserOrganization', {
  userId: integer('userId').notNull(),
  organizationId: integer('organizationId').notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.organizationId] }),
  userIdIdx: index('UserOrganization_userId_idx').on(table.userId),
  organizationIdIdx: index('UserOrganization_organizationId_idx').on(table.organizationId),
}));

const companies = pgTable('Company', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
});

const organizations = pgTable('Organization', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  companyId: integer('companyId'),
}, (table) => ({
  companyIdIdx: index('Organization_companyId_idx').on(table.companyId),
}));

const dashboards = pgTable('Dashboard', {
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
}, (table) => ({
  companyIdIdx: index('Dashboard_companyId_idx').on(table.companyId),
  organizationIdIdx: index('Dashboard_organizationId_idx').on(table.organizationId),
}));

const userSelect = {
  id: users.id,
  email: users.email,
  isAdmin: users.isAdmin,
  companyId: users.companyId,
  organizationId: users.organizationId,
};

export const getUser = cache(async (email: string) => {
  const userRows = await db
    .select(userSelect)
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (userRows.length === 0) {
    return [];
  }
  const assignmentsByUserId = await getUserAssignmentsByUserIds(
    userRows.map((user) => user.id),
  );
  return userRows.map((user) => {
    const assignment = assignmentsByUserId.get(user.id) ?? {
      companyIds: [],
      organizationIds: [],
    };
    return {
      ...user,
      companyIds:
        assignment.companyIds.length === 0 && user.companyId
          ? [user.companyId]
          : assignment.companyIds,
      organizationIds:
        assignment.organizationIds.length === 0 && user.organizationId
          ? [user.organizationId]
          : assignment.organizationIds,
    };
  });
});

export async function createUser(email: string, password: string) {
  return await createUserWithRole({ email, password, isAdmin: false });
}

export const getUserForAuth = async (email: string) => {
  return await db
    .select({
      ...userSelect,
      password: users.password,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
};

export async function createUserWithRole({
  email,
  password,
  isAdmin,
}: {
  email: string;
  password: string;
  isAdmin: boolean;
}) {
  const salt = await genSalt(10);
  const passwordHash = await hash(password, salt);

  return await db.transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).limit(1);
    return await tx.insert(users).values({
      email,
      password: passwordHash,
      isAdmin: isAdmin || existing.length === 0,
    });
  });
}

export const getUsers = cache(async () => {
  const userRows = await db.select(userSelect).from(users).orderBy(users.id);
  if (userRows.length === 0) {
    return [];
  }
  const assignmentsByUserId = await getUserAssignmentsByUserIds(
    userRows.map((user) => user.id),
  );
  return userRows.map((user) => {
    const assignment = assignmentsByUserId.get(user.id) ?? {
      companyIds: [],
      organizationIds: [],
    };
    return {
      ...user,
      companyIds:
        assignment.companyIds.length === 0 && user.companyId
          ? [user.companyId]
          : assignment.companyIds,
      organizationIds:
        assignment.organizationIds.length === 0 && user.organizationId
          ? [user.organizationId]
          : assignment.organizationIds,
    };
  });
});

export const getCompanies = cache(async () => {
  return await db.select().from(companies).orderBy(companies.name);
});

export const getOrganizations = cache(async () => {
  if (await hasOrganizationCompanyColumn()) {
    return await db.select().from(organizations).orderBy(organizations.name);
  }
  return await db.execute<{
    id: number;
    name: string;
    companyId: number | null;
  }>(sql`SELECT id, name, NULL::INTEGER AS "companyId" FROM "Organization" ORDER BY name`);
});

export const getOrganizationById = cache(async (id: number) => {
  if (await hasOrganizationCompanyColumn()) {
    return await db.select().from(organizations).where(eq(organizations.id, id));
  }
  return await db.execute<{
    id: number;
    name: string;
    companyId: number | null;
  }>(sql`SELECT id, name, NULL::INTEGER AS "companyId" FROM "Organization" WHERE id = ${id}`);
});

export const getDashboards = cache(async () => {
  return await db.select().from(dashboards).orderBy(dashboards.name);
});

export const getDashboardById = cache(async (id: number) => {
  return await db.select().from(dashboards).where(eq(dashboards.id, id));
});

export const getDashboardByPublicId = cache(async (publicId: string) => {
  return await db.select().from(dashboards).where(eq(dashboards.publicId, publicId));
});

export const getDashboardsForUser = cache(async ({
  companyIds,
  organizationIds,
}: {
  companyIds: number[];
  organizationIds: number[];
}) => {
  if (companyIds.length === 0) {
    return [];
  }
  const uniqueCompanyIds = Array.from(new Set(companyIds));
  const uniqueOrganizationIds = Array.from(new Set(organizationIds));
  const dashboardListSelect = {
    id: dashboards.id,
    publicId: dashboards.publicId,
    name: dashboards.name,
    template: dashboards.template,
    sheetUrl: dashboards.sheetUrl,
  };
  if (!(await hasOrganizationCompanyColumn())) {
    const companyFilter = inArray(dashboards.companyId, uniqueCompanyIds);
    const organizationFilter =
      uniqueOrganizationIds.length > 0
        ? inArray(dashboards.organizationId, uniqueOrganizationIds)
        : isNull(dashboards.organizationId);
    return await db
      .select(dashboardListSelect)
      .from(dashboards)
      .where(and(companyFilter, organizationFilter))
      .orderBy(dashboards.name);
  }

  const organizationRows =
    uniqueOrganizationIds.length > 0
      ? await db
          .select({ id: organizations.id, companyId: organizations.companyId })
          .from(organizations)
          .where(inArray(organizations.id, uniqueOrganizationIds))
      : [];

  const organizationIdsByCompanyId = new Map<number, number[]>();
  for (const row of organizationRows) {
    if (!row.companyId) continue;
    const organizationIdsForCompany = organizationIdsByCompanyId.get(row.companyId) ?? [];
    organizationIdsForCompany.push(row.id);
    organizationIdsByCompanyId.set(row.companyId, organizationIdsForCompany);
  }

  const visibilityFilters = uniqueCompanyIds.map((companyId) => {
    const scopedOrganizationIds = organizationIdsByCompanyId.get(companyId) ?? [];
    if (scopedOrganizationIds.length === 0) {
      return and(eq(dashboards.companyId, companyId), isNull(dashboards.organizationId));
    }
    return and(eq(dashboards.companyId, companyId), inArray(dashboards.organizationId, scopedOrganizationIds));
  });

  if (visibilityFilters.length === 0) {
    return [];
  }

  return await db
    .select(dashboardListSelect)
    .from(dashboards)
    .where(or(...visibilityFilters))
    .orderBy(dashboards.name);
});

export async function createCompany(name: string) {
  return await db.insert(companies).values({ name });
}

export async function updateCompany(id: number, name: string) {
  return await db.update(companies).set({ name }).where(eq(companies.id, id));
}

export async function deleteCompany(id: number) {
  return await db.delete(companies).where(eq(companies.id, id));
}

export async function createOrganization(name: string, companyId: number | null) {
  if (!(await hasOrganizationCompanyColumn())) {
    return await db.insert(organizations).values({ name });
  }
  return await db.insert(organizations).values({ name, companyId });
}

export async function updateOrganization(id: number, name: string, companyId: number | null) {
  if (!(await hasOrganizationCompanyColumn())) {
    return await db.update(organizations).set({ name }).where(eq(organizations.id, id));
  }
  return await db.update(organizations).set({ name, companyId }).where(eq(organizations.id, id));
}

export async function deleteOrganization(id: number) {
  return await db.delete(organizations).where(eq(organizations.id, id));
}

export async function createDashboard({
  name,
  companyId,
  organizationId,
  template,
  sheetId,
  sheetGid,
  sheetUrl,
  notes,
}: {
  name: string;
  companyId: number;
  organizationId: number | null;
  template: string;
  sheetId: string;
  sheetGid: string;
  sheetUrl: string;
  notes?: string | null;
}) {
  await assertOrganizationBelongsToCompany(companyId, organizationId);
  return await db.insert(dashboards).values({
    name,
    companyId,
    organizationId,
    template,
    sheetId,
    sheetGid,
    sheetUrl,
    notes: notes ?? null,
    publicId: randomUUID(),
  });
}

export async function updateDashboard({
  id,
  name,
  companyId,
  organizationId,
  template,
  sheetId,
  sheetGid,
  sheetUrl,
  notes,
}: {
  id: number;
  name: string;
  companyId: number;
  organizationId: number | null;
  template: string;
  sheetId: string;
  sheetGid: string;
  sheetUrl: string;
  notes?: string | null;
}) {
  await assertOrganizationBelongsToCompany(companyId, organizationId);
  return await db
    .update(dashboards)
    .set({
      name,
      companyId,
      organizationId,
      template,
      sheetId,
      sheetGid,
      sheetUrl,
      notes: notes ?? null,
    })
    .where(eq(dashboards.id, id));
}

export async function deleteDashboard(id: number) {
  return await db.delete(dashboards).where(eq(dashboards.id, id));
}

export async function updateUserProfile({
  id,
  email,
  password,
}: {
  id: number;
  email: string;
  password?: string | null;
}) {
  const updates: { email: string; password?: string } = { email };
  if (password) {
    const salt = await genSalt(10);
    updates.password = await hash(password, salt);
  }
  return await db.update(users).set(updates).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  return await db.delete(users).where(eq(users.id, id));
}

export async function updateUserAssignments(
  userId: number,
  {
    companyIds,
    organizationIds,
    isAdmin,
  }: {
    companyIds: number[];
    organizationIds: number[];
    isAdmin: boolean;
  },
) {
  const uniqueCompanyIds = Array.from(new Set(companyIds));
  const uniqueOrganizationIds = Array.from(new Set(organizationIds));
  if (!(await hasOrganizationCompanyColumn())) {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({
          companyId: uniqueCompanyIds[0] ?? null,
          organizationId: uniqueOrganizationIds[0] ?? null,
          isAdmin,
        })
        .where(eq(users.id, userId));

      await tx.delete(userCompanies).where(eq(userCompanies.userId, userId));
      await tx.delete(userOrganizations).where(eq(userOrganizations.userId, userId));

      if (uniqueCompanyIds.length > 0) {
        await tx.insert(userCompanies).values(
          uniqueCompanyIds.map((companyId) => ({
            userId,
            companyId,
          })),
        );
      }

      if (uniqueOrganizationIds.length > 0) {
        await tx.insert(userOrganizations).values(
          uniqueOrganizationIds.map((organizationId) => ({
            userId,
            organizationId,
          })),
        );
      }
    });
    return;
  }

  const organizationRows =
    uniqueOrganizationIds.length > 0
      ? await db
          .select({ id: organizations.id, companyId: organizations.companyId })
          .from(organizations)
          .where(inArray(organizations.id, uniqueOrganizationIds))
      : [];
  const validOrganizationIds = organizationRows
    .filter((row) => !!row.companyId && uniqueCompanyIds.includes(row.companyId))
    .map((row) => row.id);
  const uniqueValidOrganizationIds = Array.from(new Set(validOrganizationIds));

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        companyId: uniqueCompanyIds[0] ?? null,
        organizationId: uniqueValidOrganizationIds[0] ?? null,
        isAdmin,
      })
      .where(eq(users.id, userId));

    await tx.delete(userCompanies).where(eq(userCompanies.userId, userId));
    await tx.delete(userOrganizations).where(eq(userOrganizations.userId, userId));

    if (uniqueCompanyIds.length > 0) {
      await tx.insert(userCompanies).values(
        uniqueCompanyIds.map((companyId) => ({
          userId,
          companyId,
        })),
      );
    }

    if (uniqueValidOrganizationIds.length > 0) {
      await tx.insert(userOrganizations).values(
        uniqueValidOrganizationIds.map((organizationId) => ({
          userId,
          organizationId,
        })),
      );
    }
  });
}

async function assertOrganizationBelongsToCompany(
  companyId: number,
  organizationId: number | null,
) {
  if (!organizationId) {
    return;
  }
  if (!(await hasOrganizationCompanyColumn())) {
    return;
  }
  const organizationRows = await db
    .select({ companyId: organizations.companyId })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (organizationRows.length === 0 || organizationRows[0].companyId !== companyId) {
    throw new Error('Fleet does not belong to the selected company.');
  }
}

const hasOrganizationCompanyColumn = cache(async () => {
  try {
    await db.execute(sql`SELECT "companyId" FROM "Organization" LIMIT 1`);
    return true;
  } catch (error) {
    if (isMissingOrganizationCompanyIdError(error)) {
      return false;
    }
    throw error;
  }
});

function isMissingOrganizationCompanyIdError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if (!("code" in error) || (error as { code?: unknown }).code !== '42703') {
    return false;
  }
  const message = 'message' in error ? String((error as { message?: unknown }).message ?? '') : '';
  return message.includes('companyId');
}

async function getUserAssignmentsByUserIds(userIds: number[]) {
  const uniqueUserIds = Array.from(new Set(userIds));
  if (uniqueUserIds.length === 0) {
    return new Map<number, { companyIds: number[]; organizationIds: number[] }>();
  }
  const [companyRows, organizationRows] = await Promise.all([
    db
      .select({ userId: userCompanies.userId, companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(inArray(userCompanies.userId, uniqueUserIds)),
    db
      .select({
        userId: userOrganizations.userId,
        organizationId: userOrganizations.organizationId,
      })
      .from(userOrganizations)
      .where(inArray(userOrganizations.userId, uniqueUserIds)),
  ]);

  const assignments = new Map<number, { companyIds: Set<number>; organizationIds: Set<number> }>();
  for (const userId of uniqueUserIds) {
    assignments.set(userId, { companyIds: new Set(), organizationIds: new Set() });
  }

  for (const row of companyRows) {
    if (!row.userId || !row.companyId) continue;
    const entry = assignments.get(row.userId);
    if (entry) {
      entry.companyIds.add(row.companyId);
    }
  }

  for (const row of organizationRows) {
    if (!row.userId || !row.organizationId) continue;
    const entry = assignments.get(row.userId);
    if (entry) {
      entry.organizationIds.add(row.organizationId);
    }
  }

  return new Map(
    Array.from(assignments.entries()).map(([userId, entry]) => [
      userId,
      {
        companyIds: Array.from(entry.companyIds),
        organizationIds: Array.from(entry.organizationIds),
      },
    ]),
  );
}
