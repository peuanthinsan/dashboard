'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_FORM_PANEL,
  ADMIN_HINT_TEXT,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SELECT,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import type { ActionState, Company, Organization, User } from '../types';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;

type UsersClientProps = {
  users: User[];
  companies: Company[];
  organizations: Organization[];
  addUserAction: FormAction;
  manageUserAction: FormAction;
};

function UserRow({
  user,
  companies,
  organizations,
  action,
}: {
  user: User;
  companies: Company[];
  organizations: Organization[];
  action: FormAction;
}) {
  const [state, formAction] = useFormState(action, INITIAL_STATE);
  useRefreshOnSuccess(state);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-xl border border-slate-200/70 bg-white/95 p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-800/70 dark:bg-slate-950/60 md:grid-cols-[1.3fr_1.1fr_1fr_1fr_auto]"
    >
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex flex-col gap-2 text-sm">
        <label className={ADMIN_LABEL}>Email</label>
        <input
          name="userEmail"
          defaultValue={user.email ?? ''}
          className={ADMIN_INPUT}
        />
        <label className={ADMIN_LABEL}>Reset password</label>
        <input
          type="password"
          name="userPassword"
          placeholder="Leave blank to keep"
          className={ADMIN_INPUT}
        />
        <label className={`flex items-center gap-2 ${ADMIN_LABEL}`}>
          <input
            type="checkbox"
            name="isAdmin"
            defaultChecked={!!user.isAdmin}
            className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
          />
          Admin access
        </label>
      </div>

      <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
        Companies
        <select
          name="companyIds"
          multiple
          defaultValue={(user.companyIds ?? []).map(String)}
          className={`min-h-[7rem] ${ADMIN_SELECT}`}
        >
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        <span className={ADMIN_HINT_TEXT}>
          Hold Ctrl (Windows) or Command (Mac) to select multiple.
        </span>
      </label>

      <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
        Organizations
        <select
          name="organizationIds"
          multiple
          defaultValue={(user.organizationIds ?? []).map(String)}
          className={`min-h-[7rem] ${ADMIN_SELECT}`}
        >
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>
              {organization.name}
            </option>
          ))}
        </select>
        <span className={ADMIN_HINT_TEXT}>
          Leave empty to allow only company-level dashboards.
        </span>
      </label>

      <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
        <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
          Save
        </button>
        <ConfirmDeleteDialog
          title="Delete user"
          description="This will permanently delete the user account."
          triggerClassName={ADMIN_DELETE_BUTTON}
          confirmClassName={ADMIN_DELETE_BUTTON}
        />
      </div>
      <StatusMessage state={state} className="md:col-span-full" />
    </form>
  );
}

export default function UsersClient({
  users,
  companies,
  organizations,
  addUserAction,
  manageUserAction,
}: UsersClientProps) {
  const adminCount = users.filter((user) => user.isAdmin).length;
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [organizationFilter, setOrganizationFilter] = useState('all');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const [userCreateState, userCreateAction] = useFormState(addUserAction, INITIAL_STATE);
  useRefreshOnSuccess(userCreateState);

  const companyNameById = useMemo(
    () =>
      new Map(companies.map((company) => [String(company.id), company.name.toLowerCase()])),
    [companies],
  );
  const organizationNameById = useMemo(
    () =>
      new Map(
        organizations.map((organization) => [String(organization.id), organization.name.toLowerCase()]),
      ),
    [organizations],
  );

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      if (roleFilter === 'admins' && !user.isAdmin) {
        return false;
      }
      if (roleFilter === 'standard' && user.isAdmin) {
        return false;
      }
      if (
        companyFilter !== 'all' &&
        !(user.companyIds ?? []).map(String).includes(companyFilter)
      ) {
        return false;
      }
      if (
        organizationFilter !== 'all' &&
        !(user.organizationIds ?? []).map(String).includes(organizationFilter)
      ) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const emailMatch = (user.email ?? '').toLowerCase().includes(normalizedSearch);
      const companyMatch = (user.companyIds ?? []).some((companyId) =>
        companyNameById.get(String(companyId))?.includes(normalizedSearch),
      );
      const organizationMatch = (user.organizationIds ?? []).some((organizationId) =>
        organizationNameById.get(String(organizationId))?.includes(normalizedSearch),
      );

      return emailMatch || companyMatch || organizationMatch;
    });
  }, [
    companyFilter,
    companyNameById,
    organizationFilter,
    organizationNameById,
    roleFilter,
    searchTerm,
    users,
  ]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, companyFilter, organizationFilter, pageSize]);

  const totalFilteredUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredUsers / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = totalFilteredUsers === 0 ? 0 : (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalFilteredUsers);
  const pagedUsers = filteredUsers.slice(startIndex, endIndex);

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="User access"
        title="Users"
        description="Invite users, assign access, and keep permissions up to date."
        count={users.length}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total users"
          value={users.length}
          description="Active accounts with access."
        />
        <AdminStatCard label="Admins" value={adminCount} description="Accounts with admin privileges." />
        <AdminStatCard label="Onboarding tips" variant="gradient" className="sm:col-span-2">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Create a temporary password and share it securely.</li>
            <li>Assign companies and organizations to limit scope.</li>
          </ul>
        </AdminStatCard>
      </div>

      <div className="grid gap-6">
        <form
          action={userCreateAction}
          className={`${ADMIN_FORM_PANEL} grid gap-4`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Create user</h3>
            <span className={ADMIN_LABEL}>Required *</span>
          </div>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Email *
                <input
                  name="userEmail"
                  placeholder="user@acme.com"
                  className={ADMIN_INPUT}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Temporary password *
                <input
                  type="password"
                  name="userPassword"
                  placeholder="Create a password"
                  className={ADMIN_INPUT}
                />
              </label>
            </div>
            <label className={`flex items-center gap-2 ${ADMIN_LABEL}`}>
              <input
                type="checkbox"
                name="isAdmin"
                className="h-4 w-4 rounded border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900"
              />
              Admin access
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
              Provide a temporary password for first login.
            </p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create user
            </button>
          </div>
          <StatusMessage state={userCreateState} />
        </form>

        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Manage users</h3>
              <p className={`mt-1 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Update profiles, assign companies, and manage access.
              </p>
            </div>
          </div>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 xl:grid-cols-[1.6fr_1fr_1fr_1fr_0.7fr]">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Search
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search email, company, or organization"
                  className={ADMIN_INPUT}
                />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Role
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="all">All users</option>
                  <option value="admins">Admins only</option>
                  <option value="standard">Standard users</option>
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Company
                <select
                  value={companyFilter}
                  onChange={(event) => setCompanyFilter(event.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="all">All companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Organization
                <select
                  value={organizationFilter}
                  onChange={(event) => setOrganizationFilter(event.target.value)}
                  className={ADMIN_SELECT}
                >
                  <option value="all">All organizations</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Per page
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className={ADMIN_SELECT}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
                {totalFilteredUsers === 0
                  ? 'No users match these filters.'
                  : `Showing ${startIndex + 1}-${endIndex} of ${totalFilteredUsers} users.`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className={`${ADMIN_SAVE_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={currentPage === 1}
                  onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </button>
                <span className={`text-xs font-semibold ${ADMIN_TEXT_SUBTLE}`}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className={`${ADMIN_SAVE_BUTTON} disabled:cursor-not-allowed disabled:opacity-60`}
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                >
                  Next
                </button>
              </div>
            </div>
            {pagedUsers.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                Try adjusting the filters to find more users.
              </p>
            ) : (
              pagedUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  companies={companies}
                  organizations={organizations}
                  action={manageUserAction}
                />
              ))
            )}
          </div>
        </AdminPanel>
      </div>
    </AdminSection>
  );
}
