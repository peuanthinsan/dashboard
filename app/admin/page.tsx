import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import {
  createCompany,
  createDashboard,
  createOrganization,
  getCompanies,
  getDashboards,
  getOrganizations,
  getUser,
  getUsers,
  updateUserAssignments,
} from 'app/db';
import { parseGoogleSheetUrl } from 'app/utils/googleSheet';

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user?.email) {
    redirect('/login');
  }

  const currentUser = await getUser(session.user.email);
  if (currentUser.length === 0 || !currentUser[0].isAdmin) {
    redirect('/protected');
  }

  const [users, companies, organizations] = await Promise.all([
    getUsers(),
    getCompanies(),
    getOrganizations(),
  ]);
  const dashboards = await getDashboards();

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
      return;
    }
    await createCompany(name);
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
      return;
    }
    await createOrganization(name);
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
    const sheetUrl = (formData.get('sheetUrl') as string)?.trim();
    const companyId = Number(formData.get('companyId'));
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    const organizationId = organizationValue ? Number(organizationValue) : null;
    if (!name || !sheetUrl || Number.isNaN(companyId)) {
      return;
    }
    const parsed = parseGoogleSheetUrl(sheetUrl);
    if (!parsed) {
      return;
    }
    await createDashboard({
      name,
      sheetUrl,
      sheetId: parsed.sheetId,
      sheetGid: parsed.gid,
      companyId,
      organizationId,
    });
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
    const companyValue = (formData.get('companyId') as string) ?? '';
    const organizationValue = (formData.get('organizationId') as string) ?? '';
    const isAdmin = formData.get('isAdmin') === 'on';
    if (currentUser[0].id === userId && !isAdmin) {
      return;
    }
    await updateUserAssignments(userId, {
      companyId: companyValue ? Number(companyValue) : null,
      organizationId: organizationValue ? Number(organizationValue) : null,
      isAdmin,
    });
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Administration</h1>
          <p className="text-sm text-slate-300">
            Assign users to companies or organizations and manage admin access.
          </p>
        </header>

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
        </section>

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="grid gap-3">
            <h2 className="text-lg font-medium">Create dashboard</h2>
            <p className="text-sm text-slate-300">
              Connect a Google Sheet and assign it to a company and organization.
            </p>
          </div>
          <form
            action={addDashboard}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2"
          >
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Dashboard name
              <input
                name="dashboardName"
                placeholder="PoonNok Safety Overview"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Google Sheet link
              <input
                name="sheetUrl"
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Company
              <select
                name="companyId"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                defaultValue=""
              >
                <option value="" disabled>
                  Select company
                </option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-slate-400">
              Organization (optional)
              <select
                name="organizationId"
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                defaultValue=""
              >
                <option value="">
                  All organizations
                </option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end md:col-span-2">
              <button
                type="submit"
                className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400"
              >
                Add dashboard
              </button>
            </div>
          </form>
          <div className="grid gap-3">
            <h3 className="text-sm font-semibold text-slate-200">Existing dashboards</h3>
            {dashboards.length === 0 ? (
              <p className="text-sm text-slate-400">No dashboards have been created yet.</p>
            ) : (
              <div className="grid gap-3">
                {dashboards.map((dashboard) => {
                  const companyName =
                    companies.find((company) => company.id === dashboard.companyId)?.name ?? 'Unknown company';
                  const organizationName =
                    dashboard.organizationId == null
                      ? 'All organizations'
                      : organizations.find((organization) => organization.id === dashboard.organizationId)?.name ??
                        'Unknown organization';
                  const sheetUrl = dashboard.sheetUrl ?? '';
                  return (
                    <div
                      key={dashboard.id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-base font-semibold text-white">{dashboard.name}</p>
                          <p className="text-xs text-slate-400">
                            {companyName} · {organizationName}
                          </p>
                        </div>
                        {sheetUrl ? (
                          <a
                            href={sheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-indigo-300 hover:text-indigo-200"
                          >
                            Open sheet
                          </a>
                        ) : (
                          <span className="text-xs font-semibold text-slate-500">Missing sheet link</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{sheetUrl || 'No sheet URL saved.'}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">User access</h2>
          <div className="grid gap-4">
            {users.map((user) => (
              <form
                key={user.id}
                action={updateUser}
                className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1fr_1fr_auto]"
              >
                <input type="hidden" name="userId" value={user.id} />
                <div className="flex flex-col gap-1 text-sm">
                  <span className="font-medium text-slate-200">{user.email}</span>
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
                  Company
                  <select
                    name="companyId"
                    defaultValue={user.companyId ?? ''}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">No company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-2 text-xs text-slate-400">
                  Organization
                  <select
                    name="organizationId"
                    defaultValue={user.organizationId ?? ''}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white"
                  >
                    <option value="">No organization</option>
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white hover:border-slate-500"
                  >
                    Save
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
