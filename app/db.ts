import { drizzle } from 'drizzle-orm/postgres-js';
import { and, count, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';
import postgres from 'postgres';
import { genSalt, hash } from 'bcrypt-ts';
import { randomUUID } from 'crypto';
import { cache } from 'react';
import {
  users,
  userCompanies,
  userOrganizations,
  companies,
  organizations,
  dashboards,
  lineChannels,
  drivingWarnings,
} from './db-schema';
import { decryptLineTokenColumn } from './lib/lineTokenCrypto';
import type { DrivingThresholds } from './dashboards/drivingThresholds';

const dbUrl = process.env.POSTGRES_URL || 'postgresql://localhost:5432/placeholder?sslmode=require';
const client = postgres(dbUrl);
export const db = drizzle(client);

const userSelect = {
  id: users.id,
  email: users.email,
  isAdmin: users.isAdmin,
  showBothCompanyAndFleet: users.showBothCompanyAndFleet,
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
    const promotedAsFirst = !isAdmin && existing.length === 0;
    if (promotedAsFirst) {
      // Bootstrap behavior: the very first account in the system is auto-promoted
      // to admin so there's someone who can manage the install. Logged so this
      // elevation leaves an audit trail rather than happening silently.
      console.warn(`[bootstrap] First user "${email}" auto-promoted to admin.`);
    }
    const [result] = await tx.insert(users).values({
      email,
      password: passwordHash,
      isAdmin: isAdmin || existing.length === 0,
    }).returning({ id: users.id });
    return result;
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

export const USERS_PAGE_SIZE = 25;

export type GetUsersPaginatedParams = {
  page?: number;
  limit?: number;
  search?: string;
};

export async function getUsersPaginated(params: GetUsersPaginatedParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? USERS_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const search = params.search?.trim();

  const conds: Parameters<typeof and>[number][] = [];
  if (search) {
    const term = `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    conds.push(ilike(users.email, term));
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [totalResult, userRows] = await Promise.all([
    db.select({ count: count() }).from(users).where(whereClause),
    db
      .select(userSelect)
      .from(users)
      .where(whereClause)
      .orderBy(users.id)
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;
  if (userRows.length === 0) {
    return { items: [], total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  const assignmentsByUserId = await getUserAssignmentsByUserIds(userRows.map((u) => u.id));
  const items = userRows.map((user) => {
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

  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

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

export const DASHBOARDS_PAGE_SIZE = 25;

export type GetDashboardsPaginatedParams = {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: number | null;
  organizationId?: number | null;
};

export async function getDashboardsPaginated(params: GetDashboardsPaginatedParams = {}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? DASHBOARDS_PAGE_SIZE));
  const offset = (page - 1) * limit;
  const search = params.search?.trim();
  const companyId = params.companyId;
  const organizationId = params.organizationId;

  const conds: Parameters<typeof and>[number][] = [];
  if (search) {
    const term = `%${search.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`;
    conds.push(ilike(dashboards.name, term));
  }
  if (companyId != null) {
    conds.push(eq(dashboards.companyId, companyId));
  }
  if (organizationId != null) {
    conds.push(eq(dashboards.organizationId, organizationId));
  }
  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const [totalResult, items] = await Promise.all([
    db
      .select({ count: count() })
      .from(dashboards)
      .where(whereClause),
    db
      .select()
      .from(dashboards)
      .where(whereClause)
      .orderBy(dashboards.name)
      .limit(limit)
      .offset(offset),
  ]);

  const total = totalResult[0]?.count ?? 0;
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export const getDashboardById = cache(async (id: number) => {
  return await db.select().from(dashboards).where(eq(dashboards.id, id));
});

/**
 * SECURITY: This returns the full dashboard row by publicId with NO authorization.
 * Callers MUST verify the resulting `companyId` / `organizationId` against the
 * current user's access (see app/dashboard/[id]/page.tsx for the canonical pattern).
 */
export const getDashboardByPublicId = cache(async (publicId: string) => {
  return await db.select().from(dashboards).where(eq(dashboards.publicId, publicId));
});

/**
 * Returns true if a sheet (by sheetId + optional gid) belongs to a dashboard
 * the user can access via their company/org assignments. Used by /api/sheets/* to
 * gate the sheet-data proxy so it can't be used to scrape arbitrary Google Sheets.
 */
export async function userCanAccessSheet(
  sheetId: string,
  gid: string | null,
  userCompanyIds: number[],
  userOrganizationIds: number[],
): Promise<boolean> {
  const conditions = [eq(dashboards.sheetId, sheetId)];
  if (gid) conditions.push(sql`(${dashboards.sheetGid} = ${gid} OR ${dashboards.sheetGidCntDrv} = ${gid})`);
  const matching = await db
    .select({ companyId: dashboards.companyId, organizationId: dashboards.organizationId })
    .from(dashboards)
    .where(and(...conditions));
  if (matching.length === 0) return false;
  const companySet = new Set(userCompanyIds);
  const orgSet = new Set(userOrganizationIds);
  return matching.some((d) => {
    const matchesCompany = d.companyId == null || companySet.has(d.companyId);
    const matchesOrg = d.organizationId == null || orgSet.has(d.organizationId);
    return matchesCompany && matchesOrg;
  });
}

export const getDashboardsForUser = cache(async ({
  companyIds,
  organizationIds,
  showBoth = false,
}: {
  companyIds: number[];
  organizationIds: number[];
  showBoth?: boolean;
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
    companyId: dashboards.companyId,
    companyName: companies.name,
  };
  if (!(await hasOrganizationCompanyColumn())) {
    const organizationRows =
      uniqueOrganizationIds.length > 0
        ? await db
            .select({ organizationId: dashboards.organizationId, companyId: dashboards.companyId })
            .from(dashboards)
            .where(
              and(
                inArray(dashboards.companyId, uniqueCompanyIds),
                inArray(dashboards.organizationId, uniqueOrganizationIds),
              ),
            )
        : [];

    const organizationIdsByCompanyId = new Map<number, number[]>();
    for (const row of organizationRows) {
      if (!row.companyId || !row.organizationId) continue;
      const organizationIdsForCompany = organizationIdsByCompanyId.get(row.companyId) ?? [];
      organizationIdsForCompany.push(row.organizationId);
      organizationIdsByCompanyId.set(row.companyId, organizationIdsForCompany);
    }

    const visibilityFilters = uniqueCompanyIds.map((companyId) => {
      const scopedOrganizationIds = organizationIdsByCompanyId.get(companyId) ?? [];
      if (scopedOrganizationIds.length === 0) {
        return and(eq(dashboards.companyId, companyId), isNull(dashboards.organizationId));
      }
      if (showBoth) {
        return and(
          eq(dashboards.companyId, companyId),
          or(
            isNull(dashboards.organizationId),
            inArray(dashboards.organizationId, Array.from(new Set(scopedOrganizationIds))),
          ),
        );
      }
      return and(
        eq(dashboards.companyId, companyId),
        inArray(dashboards.organizationId, Array.from(new Set(scopedOrganizationIds))),
      );
    });

    return await db
      .select(dashboardListSelect)
      .from(dashboards)
      .leftJoin(companies, eq(dashboards.companyId, companies.id))
      .where(or(...visibilityFilters))
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
    if (showBoth) {
      return and(
        eq(dashboards.companyId, companyId),
        or(
          isNull(dashboards.organizationId),
          inArray(dashboards.organizationId, Array.from(new Set(scopedOrganizationIds))),
        ),
      );
    }
    return and(
      eq(dashboards.companyId, companyId),
      inArray(dashboards.organizationId, Array.from(new Set(scopedOrganizationIds))),
    );
  });

  if (visibilityFilters.length === 0) {
    return [];
  }

  return await db
    .select(dashboardListSelect)
    .from(dashboards)
    .leftJoin(companies, eq(dashboards.companyId, companies.id))
    .where(or(...visibilityFilters))
    .orderBy(dashboards.name);
});

export async function createCompany(name: string) {
  const [result] = await db.insert(companies).values({ name }).returning({ id: companies.id });
  return result;
}

export async function updateCompany(
  id: number,
  name: string,
  alertRules?: import('./dashboards/dashboardDataUtils').AlertRule[] | null,
) {
  return await db
    .update(companies)
    .set({ name, alertRules: alertRules && alertRules.length > 0 ? alertRules : null })
    .where(eq(companies.id, id));
}

export async function getCompanyById(id: number) {
  return await db.select().from(companies).where(eq(companies.id, id)).limit(1);
}

export async function setCompanyAlertRules(
  id: number,
  rules: import('./dashboards/dashboardDataUtils').AlertRule[] | null,
  mode: 'append' | 'replace' = 'replace',
) {
  if (mode === 'append' && rules && rules.length > 0) {
    const existing = await db.select({ alertRules: companies.alertRules }).from(companies).where(eq(companies.id, id)).limit(1);
    const merged = [...(existing[0]?.alertRules ?? []), ...rules];
    return await db.update(companies).set({ alertRules: merged }).where(eq(companies.id, id));
  }
  return await db
    .update(companies)
    .set({ alertRules: rules && rules.length > 0 ? rules : null })
    .where(eq(companies.id, id));
}

export async function deleteCompany(id: number) {
  return await db.delete(companies).where(eq(companies.id, id));
}

export async function createOrganization(name: string, companyId: number | null) {
  if (!(await ensureOrganizationCompanyColumn())) {
    throw new Error('Fleet company assignment requires the companyId migration to be applied.');
  }
  const [result] = await db.insert(organizations).values({ name, companyId }).returning({ id: organizations.id });
  return result;
}

export async function updateOrganization(id: number, name: string, companyId: number | null) {
  if (!(await ensureOrganizationCompanyColumn())) {
    throw new Error('Fleet company assignment requires the companyId migration to be applied.');
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
  sheetGidCntDrv,
  sheetUrlCntDrv,
  notes,
  alertTypes,
  remarks,
  drivingThresholds,
  alertRules,
  lineChannelId,
}: {
  name: string;
  companyId: number;
  organizationId: number | null;
  template: string;
  sheetId: string;
  sheetGid: string;
  sheetUrl: string;
  sheetGidCntDrv?: string | null;
  sheetUrlCntDrv?: string | null;
  notes?: string | null;
  alertTypes?: string[] | null;
  remarks?: string[] | null;
  drivingThresholds?: {
    continuousDrivingMaxHours: number;
    restMinimumHours: number;
    workingHoursMax: number;
  } | null;
  alertRules?: import('./dashboards/dashboardDataUtils').AlertRule[] | null;
  lineChannelId?: number | null;
}) {
  await assertOrganizationBelongsToCompany(companyId, organizationId);
  const [result] = await db.insert(dashboards).values({
    name,
    companyId,
    organizationId,
    template,
    sheetId,
    sheetGid,
    sheetUrl,
    sheetGidCntDrv: sheetGidCntDrv ?? null,
    sheetUrlCntDrv: sheetUrlCntDrv ?? null,
    notes: notes ?? null,
    alertTypes: alertTypes && alertTypes.length > 0 ? alertTypes : null,
    remarks: remarks && remarks.length > 0 ? remarks : null,
    drivingThresholds: drivingThresholds ?? null,
    alertRules: alertRules && alertRules.length > 0 ? alertRules : null,
    lineChannelId: lineChannelId ?? null,
    publicId: randomUUID(),
  }).returning({ id: dashboards.id });
  return result;
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
  sheetGidCntDrv,
  sheetUrlCntDrv,
  notes,
  alertTypes,
  remarks,
  drivingThresholds,
  alertRules,
  lineChannelId,
}: {
  id: number;
  name: string;
  companyId: number;
  organizationId: number | null;
  template: string;
  sheetId: string;
  sheetGid: string;
  sheetUrl: string;
  sheetGidCntDrv?: string | null;
  sheetUrlCntDrv?: string | null;
  notes?: string | null;
  alertTypes?: string[] | null;
  remarks?: string[] | null;
  drivingThresholds?: {
    continuousDrivingMaxHours: number;
    restMinimumHours: number;
    workingHoursMax: number;
  } | null;
  alertRules?: import('./dashboards/dashboardDataUtils').AlertRule[] | null;
  lineChannelId?: number | null;
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
      sheetGidCntDrv: sheetGidCntDrv ?? null,
      sheetUrlCntDrv: sheetUrlCntDrv ?? null,
      notes: notes ?? null,
      alertTypes: alertTypes && alertTypes.length > 0 ? alertTypes : null,
      remarks: remarks && remarks.length > 0 ? remarks : null,
      drivingThresholds: drivingThresholds ?? null,
      alertRules: alertRules && alertRules.length > 0 ? alertRules : null,
      lineChannelId: lineChannelId ?? null,
    })
    .where(eq(dashboards.id, id));
}

export async function deleteDashboard(id: number) {
  return await db.delete(dashboards).where(eq(dashboards.id, id));
}

export async function updateDashboardDrivingThresholds(
  id: number,
  thresholds: DrivingThresholds,
) {
  return await db
    .update(dashboards)
    .set({
      drivingThresholds: thresholds as unknown as {
        continuousDrivingMaxHours: number;
        restMinimumHours: number;
        workingHoursMax: number;
      },
    })
    .where(eq(dashboards.id, id));
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
    showBothCompanyAndFleet = false,
  }: {
    companyIds: number[];
    organizationIds: number[];
    isAdmin: boolean;
    showBothCompanyAndFleet?: boolean;
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
          showBothCompanyAndFleet,
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
        showBothCompanyAndFleet,
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

async function hasOrganizationCompanyColumn() {
  try {
    await db.execute(sql`SELECT "companyId" FROM "Organization" LIMIT 1`);
    return true;
  } catch (error) {
    if (isMissingOrganizationCompanyIdError(error)) {
      return false;
    }
    throw error;
  }
}

async function ensureOrganizationCompanyColumn() {
  if (await hasOrganizationCompanyColumn()) {
    return true;
  }
  try {
    await db.execute(sql`
      ALTER TABLE "Organization"
      ADD COLUMN IF NOT EXISTS "companyId" INTEGER REFERENCES "Company"(id) ON DELETE SET NULL
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "Organization_companyId_idx" ON "Organization" ("companyId")`);
    return await hasOrganizationCompanyColumn();
  } catch (err) {
    // DDL can fail for legitimate reasons (permissions, lock timeouts, etc.).
    // Surface it instead of masking behind a misleading "migration required" error upstream.
    console.error('ensureOrganizationCompanyColumn: DDL failed:', err);
    return false;
  }
}

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

export async function getLineChannelById(id: number) {
  const rows = await db
    .select({
      id: lineChannels.id,
      organizationId: lineChannels.organizationId,
      name: lineChannels.name,
      groupId: lineChannels.groupId,
      tokenPlaintext: decryptLineTokenColumn('accessToken'),
    })
    .from(lineChannels)
    .where(eq(lineChannels.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function listLineChannelsByOrganization(organizationId: number) {
  return db
    .select({
      id: lineChannels.id,
      organizationId: lineChannels.organizationId,
      name: lineChannels.name,
      groupId: lineChannels.groupId,
    })
    .from(lineChannels)
    .where(eq(lineChannels.organizationId, organizationId))
    .orderBy(lineChannels.name);
}

export const listLineChannels = cache(async () => {
  return db
    .select({
      id: lineChannels.id,
      name: lineChannels.name,
      organizationId: lineChannels.organizationId,
    })
    .from(lineChannels)
    .orderBy(lineChannels.name);
});

export async function insertPendingDrivingWarning(args: {
  dashboardId: number;
  violationKey: string;
  driverName: string;
  vehicleNo: string;
  eventAt: Date;
  metric: 'drive_hrs' | 'rest_hrs' | 'cnt_drv_hrs';
  threshold: number;
  valueHours: number;
  distanceKm: number | null;
  loginAt: Date | null;
  logoutAt: Date | null;
  loginLocation: string | null;
  logoutLocation: string | null;
  lineChannelId: number;
  sentByUserId: number;
  operatorNote: string | null;
}) {
  // Upsert: on conflict, reset to pending so a previously-failed warning can be retried.
  const result = await db.execute(sql`
    INSERT INTO "DrivingWarning"(
      "dashboardId", "violationKey", "driverName", "vehicleNo", "eventAt",
      metric, threshold, "valueHours", "distanceKm",
      "loginAt", "logoutAt", "loginLocation", "logoutLocation",
      "lineChannelId", "sentByUserId", "lineStatus", "operatorNote"
    ) VALUES (
      ${args.dashboardId}, ${args.violationKey}, ${args.driverName}, ${args.vehicleNo}, ${args.eventAt},
      ${args.metric}, ${args.threshold}, ${args.valueHours}, ${args.distanceKm},
      ${args.loginAt}, ${args.logoutAt}, ${args.loginLocation}, ${args.logoutLocation},
      ${args.lineChannelId}, ${args.sentByUserId}, 'pending', ${args.operatorNote}
    )
    ON CONFLICT ("dashboardId", "violationKey") DO UPDATE
      SET "lineStatus" = 'pending', "errorMessage" = NULL, "lineChannelId" = EXCLUDED."lineChannelId",
          "sentByUserId" = EXCLUDED."sentByUserId", "operatorNote" = EXCLUDED."operatorNote"
    RETURNING id, "lineStatus", "sentAt"
  `);
  const rows = (result as unknown as { rows?: Array<{ id: number; lineStatus: string; sentAt: Date | null }> }).rows
    ?? (result as unknown as Array<{ id: number; lineStatus: string; sentAt: Date | null }>);
  const row = Array.isArray(rows) ? rows[0] : rows;
  return row as { id: number; lineStatus: string; sentAt: Date | null };
}

export async function markWarningSent(args: { id: number; messageId: string | null }) {
  await db.execute(sql`
    UPDATE "DrivingWarning"
    SET "lineStatus" = 'sent', "sentAt" = NOW(), "lineMessageId" = ${args.messageId}, "errorMessage" = NULL
    WHERE id = ${args.id}
  `);
}

export async function markWarningFailed(args: { id: number; errorMessage: string }) {
  await db.execute(sql`
    UPDATE "DrivingWarning"
    SET "lineStatus" = 'failed', "errorMessage" = ${args.errorMessage}
    WHERE id = ${args.id}
  `);
}

export async function getWarningsForDashboard(args: {
  dashboardId: number;
  windowStart: Date | null;
  windowEnd: Date | null;
}) {
  // Range filters omitted in v2 — fetch all 'sent' warnings for a dashboard.
  return db
    .select({
      id: drivingWarnings.id,
      violationKey: drivingWarnings.violationKey,
      sentAt: drivingWarnings.sentAt,
      lineChannelId: drivingWarnings.lineChannelId,
      channelName: lineChannels.name,
    })
    .from(drivingWarnings)
    .leftJoin(lineChannels, eq(drivingWarnings.lineChannelId, lineChannels.id))
    .where(and(
      eq(drivingWarnings.dashboardId, args.dashboardId),
      eq(drivingWarnings.lineStatus, 'sent'),
    ))
    .orderBy(drivingWarnings.sentAt);
}
