import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
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
    sheetGidCntDrv: varchar('sheetGidCntDrv', { length: 24 }),
    sheetUrlCntDrv: varchar('sheetUrlCntDrv', { length: 512 }),
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
    // Multi-fleet scope (source of truth); organizationId mirrors organizationIds[0].
    organizationIds: jsonb('organizationIds').$type<number[]>(),
    lineChannelId: integer('lineChannelId'),
  },
  (table) => ({
    companyIdIdx: index('Dashboard_companyId_idx').on(table.companyId),
    organizationIdIdx: index('Dashboard_organizationId_idx').on(table.organizationId),
    lineChannelIdIdx: index('Dashboard_lineChannelId_idx').on(table.lineChannelId),
  })
);

export const lineChannels = pgTable(
  'LineChannel',
  {
    id: serial('id').primaryKey(),
    organizationId: integer('organizationId').notNull(),
    name: varchar('name', { length: 64 }).notNull(),
    accessToken: text('accessToken').notNull(),
    groupId: varchar('groupId', { length: 64 }).notNull(),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    organizationIdIdx: index('LineChannel_organizationId_idx').on(table.organizationId),
  }),
);

export const alertDriverOverrides = pgTable(
  'AlertDriverOverride',
  {
    id: serial('id').primaryKey(),
    dashboardId: integer('dashboardId').notNull(),
    /** Stable content-derived key for a sheet alert row (sha1 of vehicle|time|alertType). */
    alertKey: varchar('alertKey', { length: 64 }).notNull(),
    driverName: varchar('driverName', { length: 128 }).notNull(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dashboardAlertKeyUnique: uniqueIndex('AlertDriverOverride_dashboard_key_unique')
      .on(table.dashboardId, table.alertKey),
  }),
);

export const drivingWarnings = pgTable(
  'DrivingWarning',
  {
    id: serial('id').primaryKey(),
    dashboardId: integer('dashboardId').notNull(),
    violationKey: varchar('violationKey', { length: 64 }).notNull(),
    driverName: varchar('driverName', { length: 128 }).notNull(),
    vehicleNo: varchar('vehicleNo', { length: 64 }).notNull(),
    eventAt: timestamp('eventAt', { withTimezone: true }).notNull(),
    metric: varchar('metric', { length: 16 }).notNull(),
    threshold: numeric('threshold').notNull(),
    valueHours: numeric('valueHours').notNull(),
    distanceKm: numeric('distanceKm'),
    loginAt: timestamp('loginAt', { withTimezone: true }),
    logoutAt: timestamp('logoutAt', { withTimezone: true }),
    loginLocation: varchar('loginLocation', { length: 256 }),
    logoutLocation: varchar('logoutLocation', { length: 256 }),
    lineChannelId: integer('lineChannelId'),
    sentByUserId: integer('sentByUserId').notNull(),
    sentAt: timestamp('sentAt', { withTimezone: true }),
    lineMessageId: varchar('lineMessageId', { length: 64 }),
    lineStatus: varchar('lineStatus', { length: 16 }).notNull(),
    errorMessage: text('errorMessage'),
    operatorNote: varchar('operatorNote', { length: 500 }),
    createdAt: timestamp('createdAt', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    dashboardViolationKeyUnique: uniqueIndex('DrivingWarning_dashboard_key_unique')
      .on(table.dashboardId, table.violationKey),
    dashboardSentAtIdx: index('DrivingWarning_dashboard_sentAt_idx')
      .on(table.dashboardId, table.sentAt),
  }),
);
