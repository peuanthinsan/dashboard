import { redirect } from 'next/navigation';
import { auth } from 'app/auth';
import { getCompanies, getDashboards, getOrganizations, getUser, getUsers } from 'app/db';
import { AdminForm } from './AdminForm';
import {
  addCompany,
  addDashboard,
  addOrganization,
  addUser,
  removeCompany,
  removeDashboard,
  removeOrganization,
  removeUser,
  saveCompany,
  saveDashboard,
  saveOrganization,
  updateUser,
} from './actions';

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Video Samples'] as const;

export default async function AdminPage() {
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

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">Administration</h1>
          <p className="text-sm text-slate-300">
            Assign users to one or more companies and organizations, and manage admin access.
          </p>
        </header>

        <section className="grid gap-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <div className="grid gap-4 md:grid-cols-2">
            <AdminForm
              action={addCompany}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              statusClassName="text-xs text-slate-300"
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
            </AdminForm>

            <AdminForm
              action={addOrganization}
              className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              statusClassName="text-xs text-slate-300"
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
            </AdminForm>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-base font-medium">Manage companies</h3>
              {companies.length === 0 ? (
                <p className="text-sm text-slate-400">No companies yet.</p>
              ) : (
                companies.map((company) => (
                  <div key={company.id} className="flex flex-wrap items-end gap-3">
                    <AdminForm
                      action={saveCompany}
                      className="flex flex-1 flex-wrap items-end gap-3"
                      statusClassName="text-xs text-slate-300"
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
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500"
                      >
                        Save
                      </button>
                    </AdminForm>
                    <AdminForm
                      action={removeCompany}
                      className="flex items-center gap-2"
                      statusClassName="text-xs text-slate-300"
                    >
                      <input type="hidden" name="companyId" value={company.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </AdminForm>
                  </div>
                ))
              )}
            </div>

            <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
              <h3 className="text-base font-medium">Manage organizations</h3>
              {organizations.length === 0 ? (
                <p className="text-sm text-slate-400">No organizations yet.</p>
              ) : (
                organizations.map((organization) => (
                  <div key={organization.id} className="flex flex-wrap items-end gap-3">
                    <AdminForm
                      action={saveOrganization}
                      className="flex flex-1 flex-wrap items-end gap-3"
                      statusClassName="text-xs text-slate-300"
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
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-white hover:border-slate-500"
                      >
                        Save
                      </button>
                    </AdminForm>
                    <AdminForm
                      action={removeOrganization}
                      className="flex items-center gap-2"
                      statusClassName="text-xs text-slate-300"
                    >
                      <input type="hidden" name="organizationId" value={organization.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                      >
                        Delete
                      </button>
                    </AdminForm>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-medium">Users</h2>
          <AdminForm
            action={addUser}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.2fr_1fr_auto]"
            statusClassName="text-xs text-slate-300 md:col-span-full"
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
          </AdminForm>

          <div className="grid gap-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-[1.3fr_1.1fr_1fr_1fr_auto]"
              >
                <AdminForm
                  action={updateUser}
                  className="contents"
                  statusClassName="text-xs text-slate-300 md:col-span-full"
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
                  </div>
                </AdminForm>
                <AdminForm
                  action={removeUser}
                  className="flex items-end md:col-start-5"
                  statusClassName="text-xs text-slate-300"
                >
                  <input type="hidden" name="userId" value={user.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                  >
                    Delete
                  </button>
                </AdminForm>
              </div>
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

          <AdminForm
            action={addDashboard}
            className="grid gap-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4 md:grid-cols-2"
            statusClassName="text-xs text-slate-300 md:col-span-full"
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
          </AdminForm>

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
                  <AdminForm
                    action={saveDashboard}
                    className="contents"
                    statusClassName="text-xs text-slate-300 md:col-span-full"
                  >
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
                    </div>
                  </AdminForm>
                  <AdminForm
                    action={removeDashboard}
                    className="flex items-end md:col-start-6"
                    statusClassName="text-xs text-slate-300"
                  >
                    <input type="hidden" name="dashboardId" value={dashboard.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-rose-500/50 px-3 py-2 text-sm font-semibold text-rose-200 hover:border-rose-400"
                    >
                      Delete
                    </button>
                  </AdminForm>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
