import { drizzle } from 'drizzle-orm/postgres-js';
import { boolean, integer, pgTable, primaryKey, serial, varchar } from 'drizzle-orm/pg-core';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
let db = drizzle(client);

type UserRecord = {
  id: number;
  email: string | null;
  password: string | null;
  isAdmin: boolean | null;
  companyId: number | null;
  organizationId: number | null;
};

export type UserWithAssignments = UserRecord & {
  companyIds: number[];
  organizationIds: number[];
};

export async function getUser(email: string): Promise<UserWithAssignments[]> {
  const { users, userCompanies, userOrganizations } = await ensureTablesExist();
  const userRows = (await db.select().from(users).where(eq(users.email, email))) as UserRecord[];
  if (userRows.length === 0) {
    return [];
  }
  const userId = userRows[0].id;
  const [companyRows, organizationRows] = await Promise.all([
    db.select().from(userCompanies).where(eq(userCompanies.userId, userId)),
    db.select().from(userOrganizations).where(eq(userOrganizations.userId, userId)),
  ]);
  const companyIds =
    companyRows.length > 0
      ? companyRows.map((row) => row.companyId)
      : userRows[0].companyId
        ? [userRows[0].companyId]
        : [];
  const organizationIds =
    organizationRows.length > 0
      ? organizationRows.map((row) => row.organizationId)
      : userRows[0].organizationId
        ? [userRows[0].organizationId]
        : [];
  return [
    {
      ...userRows[0],
      companyIds,
      organizationIds,
    },
  ];
}

export async function createUser(email: string, password: string) {
  const { users } = await ensureTablesExist();
  let salt = genSaltSync(10);
  let hash = hashSync(password, salt);
  const [{ count }] = await client`
    SELECT COUNT(*)::int AS count FROM "User";
  `;

  return await db.insert(users).values({
    email,
    password: hash,
    isAdmin: count === 0,
  });
}

export async function getUsers(): Promise<UserWithAssignments[]> {
  const { users, userCompanies, userOrganizations } = await ensureTablesExist();
  const [userRows, companyRows, organizationRows] = await Promise.all([
    db.select().from(users).orderBy(users.id),
    db.select().from(userCompanies),
    db.select().from(userOrganizations),
  ]);

  const typedUsers = userRows as UserRecord[];
  const companyMap = new Map<number, number[]>();
  for (const row of companyRows) {
    const list = companyMap.get(row.userId) ?? [];
    list.push(row.companyId);
    companyMap.set(row.userId, list);
  }

  const organizationMap = new Map<number, number[]>();
  for (const row of organizationRows) {
    const list = organizationMap.get(row.userId) ?? [];
    list.push(row.organizationId);
    organizationMap.set(row.userId, list);
  }

  return typedUsers.map((user) => ({
    ...user,
    companyIds:
      companyMap.get(user.id) ?? (user.companyId !== null ? [user.companyId] : []),
    organizationIds:
      organizationMap.get(user.id) ?? (user.organizationId !== null ? [user.organizationId] : []),
  }));
}

export async function getCompanies() {
  const { companies } = await ensureTablesExist();
  return await db.select().from(companies).orderBy(companies.name);
}

export async function getOrganizations() {
  const { organizations } = await ensureTablesExist();
  return await db.select().from(organizations).orderBy(organizations.name);
}

export async function getDashboards() {
  const { dashboards } = await ensureTablesExist();
  return await db.select().from(dashboards).orderBy(dashboards.name);
}

export async function getDashboardById(id: number) {
  const { dashboards } = await ensureTablesExist();
  return await db.select().from(dashboards).where(eq(dashboards.id, id));
}

export async function getDashboardsForUser({
  companyIds,
  organizationIds,
}: {
  companyIds: number[];
  organizationIds: number[];
}) {
  const { dashboards } = await ensureTablesExist();
  if (!companyIds.length) {
    return [];
  }
  const organizationFilter = organizationIds.length
    ? or(inArray(dashboards.organizationId, organizationIds), isNull(dashboards.organizationId))
    : isNull(dashboards.organizationId);
  return await db
    .select()
    .from(dashboards)
    .where(and(inArray(dashboards.companyId, companyIds), organizationFilter))
    .orderBy(dashboards.name);
}

export async function createCompany(name: string) {
  const { companies } = await ensureTablesExist();
  return await db.insert(companies).values({ name });
}

export async function createOrganization(name: string) {
  const { organizations } = await ensureTablesExist();
  return await db.insert(organizations).values({ name });
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
  await db.transaction(async (tx) => {
    await tx.delete(userCompanies).where(eq(userCompanies.userId, userId));
    await tx.delete(userOrganizations).where(eq(userOrganizations.userId, userId));
    if (companyIds.length > 0) {
      await tx.insert(userCompanies).values(
        companyIds.map((companyId) => ({
          userId,
          companyId,
        })),
      );
    }
    if (organizationIds.length > 0) {
      await tx.insert(userOrganizations).values(
        organizationIds.map((organizationId) => ({
          userId,
          organizationId,
        })),
      );
    }
    await tx
      .update(users)
      .set({
        companyId: companyIds[0] ?? null,
        organizationId: organizationIds[0] ?? null,
        isAdmin,
      })
      .where(eq(users.id, userId));
  });
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

  const users = pgTable('User', {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 64 }),
    password: varchar('password', { length: 64 }),
    isAdmin: boolean('isAdmin').default(false),
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
  });

  const userCompanies = pgTable(
    'UserCompany',
    {
      userId: integer('userId').notNull(),
      companyId: integer('companyId').notNull(),
    },
    (table) => ({
      pk: primaryKey({ columns: [table.userId, table.companyId] }),
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
    }),
  );

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
