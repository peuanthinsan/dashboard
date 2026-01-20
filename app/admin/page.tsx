import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import {
  createCompany,
  createDashboard,
  createOrganization,
  createUserWithRole,
  deleteCompany,
  deleteDashboard,
  deleteOrganization,
  deleteUser,
  getCompanies,
  getDashboards,
  getOrganizations,
  getUser,
  getUsers,
  updateCompany,
  updateDashboard,
  updateOrganization,
  updateUserAssignments,
  updateUserProfile,
} from 'app/db';

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video Samples'] as const;

type AdminNoticeStatus = 'success' | 'error';
type AdminNotice = {
  status: AdminNoticeStatus;
  message: string;
};

const parseSheetLink = (sheetUrl: string) => {
  const trimmed = sheetUrl.trim();
  const idMatch = trimmed.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const gidMatch = trimmed.match(/gid=([0-9]+)/);
  return {
    sheetId: idMatch?.[1] ?? null,
    sheetGid: gidMatch?.[1] ?? '0',
  };
};

const buildNoticeUrl = (status: AdminNoticeStatus, notice: string) => {
  const params = new URLSearchParams({ status, notice });
  return `/admin?${params.toString()}`;
};

const getNotice = (
  searchParams?: Record<string, string | string[] | undefined>,
): AdminNotice | null => {
  const rawNotice = searchParams?.notice;
  if (!rawNotice || typeof rawNotice !== 'string') {
    return null;
  }
  const rawStatus = searchParams?.status;
  const status: AdminNoticeStatus = rawStatus === 'success' ? 'success' : 'error';
  return {
    status,
    message: rawNotice,
  };
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    redirect('/protected');
  }

  const [users, companies, organizations, dashboards] = await Promise.all([
    getUsers(),
    getCompanies(),
    getOrganizations(),
    getDashboards(),
  ]);
  const notice = getNotice(searchParams);

  async function addCompany(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const name = (formData.get('companyName') as string)?.trim();
    if (!name) {
      redirect(buildNoticeUrl('error', 'Enter a company name before saving.'));
    }
    try {
      await createCompany(name);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Company created successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to create the company.'));
    }
  }

  async function saveCompany(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const companyId = Number(formData.get('companyId'));
    const name = (formData.get('companyName') as string)?.trim();
    if (!companyId || !name) {
      redirect(buildNoticeUrl('error', 'Select a company and provide a name before saving.'));
    }
    try {
      await updateCompany(companyId, name);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Company updated successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to update the company.'));
    }
  }

  async function removeCompany(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const companyId = Number(formData.get('companyId'));
    if (!companyId) {
      redirect(buildNoticeUrl('error', 'Select a company before deleting.'));
    }
    try {
      await deleteCompany(companyId);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Company deleted successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to delete the company.'));
    }
  }

  async function addOrganization(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const name = (formData.get('organizationName') as string)?.trim();
    if (!name) {
      redirect(buildNoticeUrl('error', 'Enter an organization name before saving.'));
    }
    try {
      await createOrganization(name);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Organization created successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to create the organization.'));
    }
  }

  async function saveOrganization(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const organizationId = Number(formData.get('organizationId'));
    const name = (formData.get('organizationName') as string)?.trim();
    if (!organizationId || !name) {
      redirect(buildNoticeUrl('error', 'Select an organization and provide a name before saving.'));
    }
    try {
      await updateOrganization(organizationId, name);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Organization updated successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to update the organization.'));
    }
  }

  async function removeOrganization(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const organizationId = Number(formData.get('organizationId'));
    if (!organizationId) {
      redirect(buildNoticeUrl('error', 'Select an organization before deleting.'));
    }
    try {
      await deleteOrganization(organizationId);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Organization deleted successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to delete the organization.'));
    }
  }

  async function addUser(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const email = (formData.get('userEmail') as string)?.trim();
    const password = (formData.get('userPassword') as string)?.trim();
    const isAdmin = formData.get('isAdmin') === 'on';
    if (!email || !password) {
      redirect(buildNoticeUrl('error', 'Provide both an email and temporary password.'));
    }
    const existing = await getUser(email);
    if (existing.length > 0) {
      redirect(buildNoticeUrl('error', 'That email is already in use.'));
    }
    try {
      await createUserWithRole({ email, password, isAdmin });
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'User created successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to create the user.'));
    }
  }

  async function updateUser(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const userId = Number(formData.get('userId'));
    const email = (formData.get('userEmail') as string)?.trim();
    const password = (formData.get('userPassword') as string)?.trim();
    const companyValues = formData.getAll('companyIds') as string[];
    const organizationValues = formData.getAll('organizationIds') as string[];
    const isAdmin = formData.get('isAdmin') === 'on';
    if (currentUser[0].id === userId && !isAdmin) {
      redirect(buildNoticeUrl('error', 'You cannot remove your own admin access.'));
    }
    if (!email) {
      redirect(buildNoticeUrl('error', 'Provide an email address before saving.'));
    }
    try {
      await updateUserProfile({
        id: userId,
        email,
        password: password ? password : null,
      });
      await updateUserAssignments(userId, {
        companyIds: companyValues.map(Number).filter((value) => !Number.isNaN(value)),
        organizationIds: organizationValues.map(Number).filter((value) => !Number.isNaN(value)),
        isAdmin,
      });
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'User updated successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to update the user.'));
    }
  }

  async function removeUser(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const userId = Number(formData.get('userId'));
    if (!userId || currentUser[0].id === userId) {
      redirect(buildNoticeUrl('error', 'Select a different user before deleting.'));
    }
    try {
      await deleteUser(userId);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'User deleted successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to delete the user.'));
    }
  }

  async function addDashboard(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const name = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim();
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    if (!name || !template || !sheetUrl || !companyId) {
      redirect(buildNoticeUrl('error', 'Complete every required dashboard field.'));
    }
    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      redirect(buildNoticeUrl('error', 'Provide a valid Google Sheet link.'));
    }
    try {
      await createDashboard({
        name,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId: organizationValue ? Number(organizationValue) : null,
      });
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Dashboard created successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to create the dashboard.'));
    }
  }

  async function saveDashboard(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const dashboardId = Number(formData.get('dashboardId'));
    const name = (formData.get('dashboardName') as string)?.trim();
    const template = (formData.get('template') as string)?.trim();
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    if (!dashboardId || !name || !template || !sheetUrl || !companyId) {
      redirect(buildNoticeUrl('error', 'Complete every required dashboard field.'));
    }
    const { sheetId, sheetGid } = parseSheetLink(sheetUrl);
    if (!sheetId) {
      redirect(buildNoticeUrl('error', 'Provide a valid Google Sheet link.'));
    }
    try {
      await updateDashboard({
        id: dashboardId,
        name,
        template,
        sheetUrl,
        sheetId,
        sheetGid,
        companyId,
        organizationId: organizationValue ? Number(organizationValue) : null,
      });
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Dashboard updated successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to update the dashboard.'));
    }
  }

  async function removeDashboard(formData: FormData) {
    'use server';
    const session = await auth();
    if (!session?.user?.email) {
      redirect('/login');
    }
    const currentUser = await getUser(session.user.email);
    if (currentUser.length === 0 || !currentUser[0].isAdmin) {
      redirect('/protected');
    }
    const dashboardId = Number(formData.get('dashboardId'));
    if (!dashboardId) {
      redirect(buildNoticeUrl('error', 'Select a dashboard before deleting.'));
    }
    try {
      await deleteDashboard(dashboardId);
      revalidatePath('/admin');
      redirect(buildNoticeUrl('success', 'Dashboard deleted successfully.'));
    } catch (error) {
      redirect(buildNoticeUrl('error', 'Unable to delete the dashboard.'));
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Administration</h1>
          <p className="text-sm text-slate-300">
            Assign users to one or more companies and organizations, and manage admin access.
          </p>
        </header>

        {notice ? (
          <div
            role="status"
            className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
              notice.status === 'success'
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                : 'border-rose-500/40 bg-rose-500/10 text-rose-100'
            }`}
          >
            <span className="font-medium">{notice.message}</span>
            <a
              href="/admin"
              className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 hover:text-white"
            >
              Dismiss
            </a>
          </div>
        ) : null}

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="grid gap-4 md:grid-cols-2">
            <form
              action={addCompany}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <h2 className="text-lg font-medium">Create company</h2>
              <input
                name="companyName"
                placeholder="Acme Corp"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Add company
              </button>
            </form>

            <form
              action={addOrganization}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
            >
              <h2 className="text-lg font-medium">Create organization</h2>
              <input
                name="organizationName"
                placeholder="Operations Team"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Add organization
              </button>
            </form>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-base font-medium">Manage companies</h3>
              {companies.length === 0 ? (
                <p className="text-sm text-slate-400">No companies yet.</p>
              ) : (
                companies.map((company) => (
                  <form
                    key={company.id}
                    action={saveCompany}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="companyId" value={company.id} />
                    <div className="flex flex-1 flex-col gap-2">
                      <label className="text-xs text-slate-400">Company name</label>
                      <input
                        name="companyName"
                        defaultValue={company.name ?? ''}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500"
                      >
                        Save
                      </button>
                      <button
                        type="submit"
                        formAction={removeCompany}
                        className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-base font-medium">Manage organizations</h3>
              {organizations.length === 0 ? (
                <p className="text-sm text-slate-400">No organizations yet.</p>
              ) : (
                organizations.map((organization) => (
                  <form
                    key={organization.id}
                    action={saveOrganization}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <input type="hidden" name="organizationId" value={organization.id} />
                    <div className="flex flex-1 flex-col gap-2">
                      <label className="text-xs text-slate-400">Organization name</label>
                      <input
                        name="organizationName"
                        defaultValue={organization.name ?? ''}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500"
                      >
                        Save
                      </button>
                      <button
                        type="submit"
                        formAction={removeOrganization}
                        className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">Users</h2>
          <form
            action={addUser}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1fr_auto]"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Email</label>
              <input
                name="userEmail"
                placeholder="user@acme.com"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Temporary password</label>
              <input
                type="password"
                name="userPassword"
                placeholder="Create a password"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
              <label className="flex items-center gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  name="isAdmin"
                  className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                />
                Admin access
              </label>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Create user
              </button>
            </div>
          </form>

          <div className="grid gap-4">
            {users.map((user) => (
              <form
                key={user.id}
                action={updateUser}
                className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.3fr_1.1fr_1fr_1fr_auto]"
              >
                <input type="hidden" name="userId" value={user.id} />
                <div className="flex flex-col gap-2 text-sm">
                  <label className="text-xs text-slate-400">Email</label>
                  <input
                    name="userEmail"
                    defaultValue={user.email ?? ''}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  />
                  <label className="text-xs text-slate-400">Reset password</label>
                  <input
                    type="password"
                    name="userPassword"
                    placeholder="Leave blank to keep"
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      name="isAdmin"
                      defaultChecked={!!user.isAdmin}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-900"
                    />
                    Admin access
                  </label>
                </div>

                <label className="flex flex-col gap-2 text-xs text-slate-400">
                  Companies
                  <select
                    name="companyIds"
                    multiple
                    defaultValue={(user.companyIds ?? []).map(String)}
                    className="min-h-[7rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500">
                    Hold Ctrl (Windows) or Command (Mac) to select multiple.
                  </span>
                </label>

                <label className="flex flex-col gap-2 text-xs text-slate-400">
                  Organizations
                  <select
                    name="organizationIds"
                    multiple
                    defaultValue={(user.organizationIds ?? []).map(String)}
                    className="min-h-[7rem] rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-500">
                    Leave empty to allow only company-level dashboards.
                  </span>
                </label>

                <div className="flex items-end gap-2">
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
                  >
                    Save
                  </button>
                  <button
                    type="submit"
                    formAction={removeUser}
                    className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                  >
                    Delete
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <header className="flex flex-col gap-2">
            <h2 className="text-lg font-medium">Dashboards</h2>
            <p className="text-sm text-slate-300">
              Create dashboards for a company, optionally filter by organization, and set the template + sheet link.
            </p>
          </header>

          <form
            action={addDashboard}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2"
          >
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Dashboard name</label>
              <input
                name="dashboardName"
                placeholder="Operations overview"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Google Sheet link</label>
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Company</label>
              <select
                name="companyId"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Organization (optional)</label>
              <select
                name="organizationId"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                <option value="">No organization</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs text-slate-400">Template</label>
              <select
                name="template"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
              >
                {DASHBOARD_TEMPLATES.map((template) => (
                  <option key={template} value={template}>
                    {template}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Create dashboard
              </button>
            </div>
          </form>

          <div className="grid gap-4">
            {dashboards.length === 0 ? (
              <p className="text-sm text-slate-400">
                No dashboards yet. Create one to make it available to users.
              </p>
            ) : (
              dashboards.map((dashboard) => (
                <div
                  key={dashboard.id}
                  className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1.4fr_1fr_1fr_0.8fr_auto]"
                >
                  <form action={saveDashboard} className="contents">
                    <input type="hidden" name="dashboardId" value={dashboard.id} />
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Dashboard name</label>
                      <input
                        name="dashboardName"
                        defaultValue={dashboard.name ?? ''}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Sheet link</label>
                      <input
                        name="sheetUrl"
                        defaultValue={dashboard.sheetUrl ?? ''}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Company</label>
                      <select
                        name="companyId"
                        defaultValue={dashboard.companyId ?? ''}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="">Select company</option>
                        {companies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Organization</label>
                      <select
                        name="organizationId"
                        defaultValue={dashboard.organizationId ?? ''}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        <option value="">No organization</option>
                        {organizations.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs text-slate-400">Template</label>
                      <select
                        name="template"
                        defaultValue={dashboard.template ?? 'Summary'}
                        className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                      >
                        {DASHBOARD_TEMPLATES.map((template) => (
                          <option key={template} value={template}>
                            {template}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
                      >
                        Save
                      </button>
                      <button
                        type="submit"
                        formAction={removeDashboard}
                        className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </div>
                  </form>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
