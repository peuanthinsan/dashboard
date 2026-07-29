export const dynamic = 'force-dynamic';

import Link from 'next/link';
import AdminShell from './AdminShell';
import { AdminSection, AdminSectionHeader, AdminStatCard } from './admin-components';
import { requireAdmin } from './admin-utils';
import { getCompanies, getOrganizations, getUsers, getDashboards } from 'app/db';
import { getDashboardLang } from 'app/dashboard/i18n';
import { getAdminCopy } from './i18n-copy';
import { btnPrimary, cardHover, badgeInfo, heading2, heading3, textSecondary } from 'app/ui/design-tokens';

function SetupCard({
  step,
  href,
  title,
  description,
  count,
  workflowHint,
  openSectionLabel,
}: {
  step: number;
  href: string;
  title: string;
  description: string;
  count: number;
  workflowHint: string;
  openSectionLabel: string;
}) {
  return (
    <Link href={href} className={`${cardHover} group flex flex-col gap-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 gap-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-sm font-semibold text-zinc-700 transition group-hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:group-hover:bg-zinc-600"
            aria-hidden
          >
            {step}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={heading2}>{title}</span>
              <span className={badgeInfo}>{count}</span>
            </div>
            <p className={`mt-2 leading-relaxed ${textSecondary}`}>{description}</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{workflowHint}</p>
          </div>
        </div>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition group-hover:bg-zinc-100 group-hover:text-zinc-600 dark:group-hover:bg-zinc-800 dark:group-hover:text-zinc-300"
          aria-hidden
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
      <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{openSectionLabel}</span>
    </Link>
  );
}

function AuditCheck({
  count,
  description,
  href,
  label,
}: {
  count: number;
  description: string;
  href: string;
  label: string;
}) {
  const healthy = count === 0;
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-xl border p-3.5 transition-all hover:-translate-y-px hover:shadow-md ${
        healthy
          ? 'border-emerald-200/70 bg-emerald-50/60 dark:border-emerald-900/60 dark:bg-emerald-950/25'
          : 'border-amber-200/80 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30'
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        healthy
          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
      }`}>
        {healthy ? (
          <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12l4 4L19 6" />
          </svg>
        ) : (
          <span className="text-xs font-bold tabular-nums">{count}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{label}</span>
          <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
          </svg>
        </span>
        <span className="mt-1 block text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</span>
      </span>
    </Link>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const lang = await getDashboardLang();
  const copy = getAdminCopy(lang);
  const [companies, organizations, users, dashboards] = await Promise.all([
    getCompanies(),
    getOrganizations(),
    getUsers(),
    getDashboards(),
  ]);

  const adminCount = users.filter((u) => u.isAdmin).length;
  const orphanFleetCount = organizations.filter((organization) => !organization.companyId).length;
  const unassignedDashboardCount = dashboards.filter((dashboard) => !dashboard.companyId).length;
  const missingSourceCount = dashboards.filter((dashboard) => !dashboard.sheetId || !dashboard.sheetUrl).length;
  const organizationCompanyById = new Map(
    organizations.map((organization) => [organization.id, organization.companyId]),
  );
  const unassignedUserCount = users.filter((user) => {
    if (user.isAdmin) return false;
    const companyIds = user.companyIds ?? [];
    const organizationIds = user.organizationIds ?? [];
    if (companyIds.length === 0) return true;
    return organizationIds.some((organizationId) => {
      const companyId = organizationCompanyById.get(organizationId);
      return companyId == null || !companyIds.includes(companyId);
    });
  }).length;
  const failingChecks = [
    orphanFleetCount,
    unassignedDashboardCount,
    missingSourceCount,
    unassignedUserCount,
  ].filter((count) => count > 0).length;
  const passingChecks = 4 - failingChecks;
  const auditCopy =
    lang === 'th'
      ? {
          description: 'ตรวจหาการตั้งค่าที่อาจทำให้ข้อมูลหรือสิทธิ์การเข้าถึงไม่สมบูรณ์',
          dashboards: 'แดชบอร์ดที่ไม่มีบริษัท',
          dashboardsHint: 'ควรกำหนดบริษัทให้แดชบอร์ดทุกตัวเพื่อควบคุมการเข้าถึง',
          fleets: 'ฟลีทที่ไม่มีบริษัท',
          fleetsHint: 'ฟลีทควรอยู่ภายใต้บริษัทเพื่อให้การกำหนดขอบเขตถูกต้อง',
          healthy: 'การตรวจสอบทั้งหมดผ่าน',
          passing: 'รายการตรวจสอบผ่าน',
          review: 'มีรายการที่ต้องตรวจสอบ',
          sources: 'แหล่งข้อมูลไม่สมบูรณ์',
          sourcesHint: 'ตรวจสอบ Sheet ID และลิงก์ของแดชบอร์ด',
          title: 'สุขภาพการตั้งค่า',
          users: 'ขอบเขตผู้ใช้ไม่สมบูรณ์',
          usersHint: 'ผู้ใช้ทั่วไปต้องมีบริษัท และฟลีททุกตัวต้องอยู่ในบริษัทที่ได้รับสิทธิ์',
        }
      : {
          description: 'Catch configuration gaps that can weaken data coverage or access control.',
          dashboards: 'Dashboards without a company',
          dashboardsHint: 'Assign every dashboard to a company to keep access scoped.',
          fleets: 'Fleets without a company',
          fleetsHint: 'Fleets should sit under a company for predictable scoping.',
          healthy: 'All configuration checks pass',
          passing: 'checks passing',
          review: 'Review required',
          sources: 'Incomplete data sources',
          sourcesHint: 'Check each dashboard for a Sheet ID and source link.',
          title: 'Configuration health',
          users: 'Invalid user scopes',
          usersHint: 'Standard users need a company, and every fleet must belong to an assigned company.',
        };

  return (
    <AdminShell
      backHref="/dashboard"
      backLabel={copy.backToDashboards}
      eyebrow={copy.adminHub}
      title={copy.administration}
      description={copy.adminDescription}
      lang={lang}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label={copy.companies} value={companies.length} description={copy.activeCompanyProfiles} />
        <AdminStatCard label={copy.fleets} value={organizations.length} description={copy.fleetGroupsConfigured} />
        <AdminStatCard label={copy.users} value={users.length} description={copy.adminsCount(adminCount)} />
        <AdminStatCard label={copy.dashboardsNav} value={dashboards.length} description={copy.acrossAllCompanies} />
      </div>

      <AdminSection>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className={heading3}>{auditCopy.title}</h2>
              <span className={failingChecks === 0 ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900' : 'rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900'}>
                {failingChecks === 0 ? auditCopy.healthy : auditCopy.review}
              </span>
            </div>
            <p className={`mt-1 ${textSecondary}`}>{auditCopy.description}</p>
          </div>
          <div className="min-w-52 rounded-xl border border-zinc-200/70 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50">
            <div className="flex items-end justify-between gap-4">
              <span className="text-2xl font-bold tracking-tight tabular-nums text-zinc-950 dark:text-white">{passingChecks}/4</span>
              <span className="pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">{auditCopy.passing}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <div className={`h-full rounded-full ${failingChecks === 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${passingChecks * 25}%` }} />
            </div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <AuditCheck count={orphanFleetCount} label={auditCopy.fleets} description={auditCopy.fleetsHint} href="/admin/organizations" />
          <AuditCheck count={unassignedDashboardCount} label={auditCopy.dashboards} description={auditCopy.dashboardsHint} href="/admin/dashboards" />
          <AuditCheck count={missingSourceCount} label={auditCopy.sources} description={auditCopy.sourcesHint} href="/admin/dashboards" />
          <AuditCheck count={unassignedUserCount} label={auditCopy.users} description={auditCopy.usersHint} href="/admin/users" />
        </div>
      </AdminSection>

      <AdminSection>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className={heading3}>{copy.newCustomerCta}</h2>
            <p className={`mt-1 ${textSecondary}`}>{copy.quickSetupDesc}</p>
          </div>
          <Link href="/admin/quick-setup" className={btnPrimary}>
            {copy.startQuickSetup}
          </Link>
        </div>
      </AdminSection>

      <AdminSection>
        <AdminSectionHeader
          title={copy.administrationSections}
          description={copy.setupFlowSummary}
          count={4}
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <SetupCard
            step={1}
            href="/admin/companies"
            title={copy.companies}
            description={copy.createAndManage}
            count={companies.length}
            workflowHint={copy.workflowCompanies}
            openSectionLabel={copy.openSection}
          />
          <SetupCard
            step={2}
            href="/admin/organizations"
            title={copy.fleets}
            description={copy.createAndManageFleets}
            count={organizations.length}
            workflowHint={copy.workflowFleets}
            openSectionLabel={copy.openSection}
          />
          <SetupCard
            step={3}
            href="/admin/dashboards"
            title={copy.dashboardsNav}
            description={copy.setTemplatesAndLinks}
            count={dashboards.length}
            workflowHint={copy.workflowDashboards}
            openSectionLabel={copy.openSection}
          />
          <SetupCard
            step={4}
            href="/admin/users"
            title={copy.users}
            description={copy.assignUsersCompaniesFleets}
            count={users.length}
            workflowHint={copy.workflowUsers}
            openSectionLabel={copy.openSection}
          />
        </div>
      </AdminSection>
    </AdminShell>
  );
}
