import { drizzle } from 'drizzle-orm/postgres-js';
import { boolean, integer, pgTable, serial, varchar } from 'drizzle-orm/pg-core';
import { and, eq, isNull, or } from 'drizzle-orm';
import postgres from 'postgres';
import { genSaltSync, hashSync } from 'bcrypt-ts';

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle
let client = postgres(`${process.env.POSTGRES_URL!}?sslmode=require`);
let db = drizzle(client);

export async function getUser(email: string) {
  const { users } = await ensureTablesExist();
  return await db.select().from(users).where(eq(users.email, email));
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

export async function getUsers() {
  const { users } = await ensureTablesExist();
  return await db.select().from(users).orderBy(users.id);
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
  companyId,
  organizationId,
  isAdmin,
}: {
  companyId: number | null;
  organizationId: number | null;
  isAdmin: boolean;
}) {
  const { dashboards } = await ensureTablesExist();
  if (isAdmin) {
    return await db.select().from(dashboards).orderBy(dashboards.name);
  }
  if (!companyId) {
    return [];
  }
  const organizationFilter = organizationId
    ? or(isNull(dashboards.organizationId), eq(dashboards.organizationId, organizationId))
    : isNull(dashboards.organizationId);
  return await db
    .select()
    .from(dashboards)
    .where(
      and(
        eq(dashboards.companyId, companyId),
        organizationFilter,
      ),
    )
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
  template,
  sheetUrl,
  sheetId,
  gid,
  companyId,
  organizationId,
}: {
  name: string;
  template: string;
  sheetUrl: string;
  sheetId: string;
  gid: string;
  companyId: number;
  organizationId: number | null;
}) {
  const { dashboards } = await ensureTablesExist();
  return await db.insert(dashboards).values({
    name,
    template,
    sheetUrl,
    sheetId,
    gid,
    companyId,
    organizationId,
  });
}

export async function updateUserAssignments(
  userId: number,
  {
    companyId,
    organizationId,
    isAdmin,
  }: {
    companyId: number | null;
    organizationId: number | null;
    isAdmin: boolean;
  },
) {
  const { users } = await ensureTablesExist();
  return await db
    .update(users)
    .set({
      companyId,
      organizationId,
      isAdmin,
    })
    .where(eq(users.id, userId));
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
    CREATE TABLE IF NOT EXISTS "Dashboard" (
      id SERIAL PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      template VARCHAR(32) NOT NULL,
      "sheetUrl" VARCHAR(512) NOT NULL,
      "sheetId" VARCHAR(128) NOT NULL,
      "gid" VARCHAR(32) NOT NULL,
      "companyId" INTEGER REFERENCES "Company"(id) ON DELETE CASCADE NOT NULL,
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
    sheetUrl: varchar('sheetUrl', { length: 512 }),
    sheetId: varchar('sheetId', { length: 128 }),
    gid: varchar('gid', { length: 32 }),
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
  });

  return { users, companies, organizations, dashboards };
}
