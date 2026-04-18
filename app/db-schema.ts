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

export const users = pgTable(
  'User',
  {
    id: serial('id').primaryKey(),
    email: varchar('email', { length: 64 }).notNull().unique(),
    password: varchar('password', { length: 64 }).notNull(),
    isAdmin: boolean('isAdmin').default(false),
    showBothCompanyAndFleet: boolean('showBothCompanyAndFleet').default(false),
    companyId: integer('companyId'),
    organizationId: integer('organizationId'),
  },
  (table) => ({
    companyIdIdx: index('User_companyId_idx').on(table.companyId),
    organizationIdIdx: index('User_organizationId_idx').on(table.organizationId),
  })
);

export const userCompanies = pgTable(
  'UserCompany',
  {
    userId: integer('userId').notNull(),
    companyId: integer('companyId').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.companyId] }),
    userIdIdx: index('UserCompany_userId_idx').on(table.userId),
    companyIdIdx: index('UserCompany_companyId_idx').on(table.companyId),
  })
);

export const userOrganizations = pgTable(
  'UserOrganization',
  {
    userId: integer('userId').notNull(),
    organizationId: integer('organizationId').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
    userIdIdx: index('UserOrganization_userId_idx').on(table.userId),
    organizationIdIdx: index('UserOrganization_organizationId_idx').on(table.organizationId),
  })
);

export const companies = pgTable('Company', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 128 }).notNull().unique(),
  alertRules: jsonb('alertRules').$type<import('./dashboards/dashboardDataUtils').AlertRule[]>(),
});

export const organizations = pgTable(
  'Organization',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 128 }).notNull().unique(),
    companyId: integer('companyId'),
  },
  (table) => ({
    companyIdIdx: index('Organization_companyId_idx').on(table.companyId),
  })
);

export const dashboards = pgTable(
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
  },
  (table) => ({
    companyIdIdx: index('Dashboard_companyId_idx').on(table.companyId),
    organizationIdIdx: index('Dashboard_organizationId_idx').on(table.organizationId),
  })
);
