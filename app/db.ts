import { drizzle } from 'drizzle-orm/postgres-js';
import { boolean, integer, pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
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
});

const userCompanies = pgTable('UserCompany', {
  userId: integer('userId'),
  companyId: integer('companyId'),
});

const userOrganizations = pgTable('UserOrganization', {
  userId: integer('userId'),
  organizationId: integer('organizationId'),
});

const companies = pgTable('Company', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
});

const organizations = pgTable('Organization', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
});

const dashboards = pgTable('Dashboard', {
  id: serial('id').primaryKey(),
  publicId: varchar('publicId', { length: 36 }).unique(),
  name: varchar('name', { length: 128 }).notNull(),
  template: varchar('template', { length: 32 }).notNull(),
  sheetId: varchar('sheetId', { length: 128 }).notNull(),
  sheetGid: varchar('sheetGid', { length: 24 }).notNull(),
  sheetUrl: varchar('sheetUrl', { length: 512 }).notNull(),
  companyId: integer('companyId'),
  organizationId: integer('organizationId'),
});

export const getUser = cache(async (email: string) => {
  const userRows = await db.select().from(users).where(eq(users.email, email)).limit(1);
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
  const [{ count }] = await client`
    SELECT COUNT(*)::int AS count FROM "User";
  `;

  return await db.insert(users).values({
    email,
    password: passwordHash,
    isAdmin: isAdmin || count === 0,
  });
}

export const getUsers = cache(async () => {
  const userRows = await db.select().from(users).orderBy(users.id);
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
  return await db.select().from(organizations).orderBy(organizations.name);
});

export const getOrganizationById = cache(async (id: number) => {
  return await db.select().from(organizations).where(eq(organizations.id, id));
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
  const companyFilter = inArray(dashboards.companyId, companyIds);
  const organizationFilter =
    organizationIds.length > 0
      ? or(isNull(dashboards.organizationId), inArray(dashboards.organizationId, organizationIds))
      : isNull(dashboards.organizationId);
  const dashboardsForUser = await db
    .select()
    .from(dashboards)
    .where(and(companyFilter, organizationFilter))
    .orderBy(dashboards.name);
  return await ensureDashboardPublicIds(dashboardsForUser);
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

export async function createOrganization(name: string) {
  return await db.insert(organizations).values({ name });
}

export async function updateOrganization(id: number, name: string) {
  return await db.update(organizations).set({ name }).where(eq(organizations.id, id));
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
}: {
  name: string;
  companyId: number;
  organizationId: number | null;
  template: string;
  sheetId: string;
  sheetGid: string;
  sheetUrl: string;
}) {
  return await db.insert(dashboards).values({
    name,
    companyId,
    organizationId,
    template,
    sheetId,
    sheetGid,
    sheetUrl,
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
}: {
  id: number;
  name: string;
  companyId: number;
  organizationId: number | null;
  template: string;
  sheetId: string;
  sheetGid: string;
  sheetUrl: string;
}) {
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

  await db
    .update(users)
    .set({
      companyId: uniqueCompanyIds[0] ?? null,
      organizationId: uniqueOrganizationIds[0] ?? null,
      isAdmin,
    })
    .where(eq(users.id, userId));

  await db.delete(userCompanies).where(eq(userCompanies.userId, userId));
  await db.delete(userOrganizations).where(eq(userOrganizations.userId, userId));

  if (uniqueCompanyIds.length > 0) {
    await db.insert(userCompanies).values(
      uniqueCompanyIds.map((companyId) => ({
        userId,
        companyId,
      })),
    );
  }

  if (uniqueOrganizationIds.length > 0) {
    await db.insert(userOrganizations).values(
      uniqueOrganizationIds.map((organizationId) => ({
        userId,
        organizationId,
      })),
    );
  }
}

async function ensureDashboardPublicIds<T extends { id: number; publicId: string | null }>(
  dashboardsForUser: T[],
) {
  return await Promise.all(
    dashboardsForUser.map(async (dashboard) => {
      if (dashboard.publicId) {
        return dashboard;
      }
      const publicId = randomUUID();
      await db.update(dashboards).set({ publicId }).where(eq(dashboards.id, dashboard.id));
      return { ...dashboard, publicId };
    }),
  );
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
