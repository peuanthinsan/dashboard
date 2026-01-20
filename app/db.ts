import { drizzle } from 'drizzle-orm/postgres-js';
import { boolean, integer, pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';
import { randomUUID } from 'crypto';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
let db = drizzle(client);

export async function getUser(email: string) {
  const { users } = await ensureTablesExist();
  const userRows = await db.select().from(users).where(eq(users.email, email));
  const assignments = await Promise.all(
    userRows.map(async (user) => ({
      ...user,
      ...(await getUserAssignments(user.id, user.companyId ?? null, user.organizationId ?? null)),
    })),
  );
  return assignments;
}

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
  const { users } = await ensureTablesExist();
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);
  const [{ count }] = await client`
    SELECT COUNT(*)::int AS count FROM "User";
  `;

  return await db.insert(users).values({
    email,
    password: hash,
    isAdmin: isAdmin || count === 0,
  });
}

export async function getUsers() {
  const { users } = await ensureTablesExist();
  const userRows = await db.select().from(users).orderBy(users.id);
  const assignments = await Promise.all(
    userRows.map(async (user) => ({
      ...user,
      ...(await getUserAssignments(user.id, user.companyId ?? null, user.organizationId ?? null)),
    })),
  );
  return assignments;
}

export async function getCompanies() {
  const { companies } = await ensureTablesExist();
  return await db.select().from(companies).orderBy(companies.name);
}

export async function getOrganizations() {
  const { organizations } = await ensureTablesExist();
  return await db.select().from(organizations).orderBy(organizations.name);
}

export async function getOrganizationById(id: number) {
  const { organizations } = await ensureTablesExist();
  return await db.select().from(organizations).where(eq(organizations.id, id));
}

export async function getDashboards() {
  const { dashboards } = await ensureTablesExist();
  return await db.select().from(dashboards).orderBy(dashboards.name);
}

export async function getDashboardById(id: number) {
  const { dashboards } = await ensureTablesExist();
  return await db.select().from(dashboards).where(eq(dashboards.id, id));
}

export async function getDashboardByPublicId(publicId: string) {
  const { dashboards } = await ensureTablesExist();
  return await db.select().from(dashboards).where(eq(dashboards.publicId, publicId));
}

export async function getDashboardsForUser({
  companyIds,
  organizationIds,
}: {
  companyIds: number[];
  organizationIds: number[];
}) {
  const { dashboards } = await ensureTablesExist();
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
}

export async function createCompany(name: string) {
  const { companies } = await ensureTablesExist();
  return await db.insert(companies).values({ name });
}

export async function updateCompany(id: number, name: string) {
  const { companies } = await ensureTablesExist();
  return await db.update(companies).set({ name }).where(eq(companies.id, id));
}

export async function deleteCompany(id: number) {
  const { companies } = await ensureTablesExist();
  return await db.delete(companies).where(eq(companies.id, id));
}

export async function createOrganization(name: string) {
  const { organizations } = await ensureTablesExist();
  return await db.insert(organizations).values({ name });
}

export async function updateOrganization(id: number, name: string) {
  const { organizations } = await ensureTablesExist();
  return await db.update(organizations).set({ name }).where(eq(organizations.id, id));
}

export async function deleteOrganization(id: number) {
  const { organizations } = await ensureTablesExist();
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
  const { dashboards } = await ensureTablesExist();
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
  const { dashboards } = await ensureTablesExist();
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
  const { dashboards } = await ensureTablesExist();
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
  const { users } = await ensureTablesExist();
  const updates: { email: string; password?: string } = { email };
  if (password) {
    let salt = genSaltSync(10);
    updates.password = hashSync(password, salt);
  }
  return await db.update(users).set(updates).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const { users } = await ensureTablesExist();
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
  const { users, userCompanies, userOrganizations } = await ensureTablesExist();
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

async function ensureTablesExist() {
  await client`
    CREATE TABLE IF NOT EXISTS "Company" (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) UNIQUE NOT NULL
    );
  `;
  await client`
    CREATE TABLE IF NOT EXISTS "Organization" (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) UNIQUE NOT NULL
    );
  `;
  await client`
    CREATE TABLE IF NOT EXISTS "User" (
      id SERIAL PRIMARY KEY,
      email VARCHAR(64),
      password VARCHAR(64),
      "isAdmin" BOOLEAN DEFAULT FALSE,
      "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL,
      "organizationId" INTEGER REFERENCES "Organization"(id) ON DELETE SET NULL
    );
  `;
  await client`
    CREATE TABLE IF NOT EXISTS "UserCompany" (
      "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
      "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE,
      PRIMARY KEY ("userId", "companyId")
    );
  `;
  await client`
    CREATE TABLE IF NOT EXISTS "UserOrganization" (
      "userId" INTEGER REFERENCES "User"(id) ON DELETE CASCADE,
      "organizationId" INTEGER REFERENCES "Organization"(id) ON DELETE CASCADE,
      PRIMARY KEY ("userId", "organizationId")
    );
  `;
  await client`
    CREATE TABLE IF NOT EXISTS "Dashboard" (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      template VARCHAR(32) NOT NULL,
      "sheetId" VARCHAR(128) NOT NULL,
      "sheetGid" VARCHAR(24) NOT NULL,
      "sheetUrl" VARCHAR(512) NOT NULL,
      "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE,
      "organizationId" INTEGER REFERENCES "Organization"(id) ON DELETE SET NULL
    );
  `;
  await client`
    ALTER TABLE "Dashboard"
    ADD COLUMN IF NOT EXISTS "publicId" VARCHAR(36);
  `;

  const users = pgTable('User', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 64 }),
    password: varchar('password', { length: 64 }),
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
    name: varchar('name', { length: 128 }),
  });

  const organizations = pgTable('Organization', {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 128 }),
  });

  const dashboards = pgTable('Dashboard', {
    id: serial('id').primaryKey(),
    publicId: varchar('publicId', { length: 36 }),
    name: varchar('name', { length: 128 }),
    template: varchar('template', { length: 32 }),
    sheetId: varchar('sheetId', { length: 128 }),
    sheetGid: varchar('sheetGid', { length: 24 }),
    sheetUrl: varchar('sheetUrl', { length: 512 }),
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
  });

  return { users, companies, organizations, dashboards, userCompanies, userOrganizations };
}

async function ensureDashboardPublicIds<T extends { id: number; publicId: string | null }>(
  dashboardsForUser: T[],
) {
  const { dashboards } = await ensureTablesExist();
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

async function getUserAssignments(
  userId: number,
  fallbackCompanyId: number | null,
  fallbackOrganizationId: number | null,
) {
  const { userCompanies, userOrganizations } = await ensureTablesExist();
  const [companyRows, organizationRows] = await Promise.all([
    db
      .select({ companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(eq(userCompanies.userId, userId)),
    db
      .select({ organizationId: userOrganizations.organizationId })
      .from(userOrganizations)
      .where(eq(userOrganizations.userId, userId)),
  ]);

  const companyIds = companyRows
    .map((row) => row.companyId)
    .filter((value): value is number => !!value);
  const organizationIds = organizationRows
    .map((row) => row.organizationId)
    .filter((value): value is number => !!value);

  return {
    companyIds:
      companyIds.length === 0 && fallbackCompanyId ? [fallbackCompanyId] : companyIds,
    organizationIds:
      organizationIds.length === 0 && fallbackOrganizationId
        ? [fallbackOrganizationId]
        : organizationIds,
  };
}
