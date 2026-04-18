'use client';

import { useActionState, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AdminModal from '../AdminModal';
import { INITIAL_STATE, StatusMessage, useDeferredCloseOnSuccess, useRefreshOnSuccess } from '../admin-client-utils';
import ConfirmDeleteDialog from '../ConfirmDeleteDialog';
import { AdminPanel, AdminSection, AdminSectionHeader, AdminStatCard } from '../admin-components';
import {
  ADMIN_DELETE_BUTTON,
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_TEXTAREA,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import {
  tableHead,
  tableHeadCell,
  tableRow,
  tableCell,
  heading3,
  textSecondary,
  btnDanger,
  btnSmall,
} from 'app/ui/design-tokens';
import type { ActionState, Company } from '../types';
import type { bulkCreateCompanies, bulkDeleteCompanies, bulkApplyCompanyAlertRules, bulkEditCompanyAlertRule, bulkRemoveCompanyAlertRule } from 'app/db-bulk';
import AlertRulesEditor from '../AlertRulesEditor';
import ExistingRulesTable from '../ExistingRulesTable';
import ConfirmActionDialog from '../ConfirmActionDialog';

type FormAction = (prevState: ActionState, formData: FormData) => Promise<ActionState>;
type BulkCreateFn = typeof bulkCreateCompanies;
type BulkDeleteFn = typeof bulkDeleteCompanies;
type BulkApplyRulesFn = typeof bulkApplyCompanyAlertRules;
type BulkEditRuleFn = typeof bulkEditCompanyAlertRule;
type BulkRemoveRuleFn = typeof bulkRemoveCompanyAlertRule;

type CompaniesClientProps = {
  companies: Company[];
  addCompanyAction: FormAction;
  manageCompanyAction: FormAction;
  bulkCreateAction: BulkCreateFn;
  bulkDeleteAction: BulkDeleteFn;
  bulkApplyRulesAction: BulkApplyRulesFn;
  bulkEditRuleAction: BulkEditRuleFn;
  bulkRemoveRuleAction: BulkRemoveRuleFn;
};

function CompanyRow({
  company,
  action,
  checked,
  onCheck,
}: {
  company: Company;
  action: FormAction;
  checked: boolean;
  onCheck: (id: number, checked: boolean) => void;
}) {
  const [state, formAction] = useActionState(action, INITIAL_STATE);
  const [isOpen, setIsOpen] = useState(false);
  useRefreshOnSuccess(state);
  useDeferredCloseOnSuccess(state.status === 'success', () => setIsOpen(false));

  return (
    <>
      <tr className={tableRow}>
        <td className="w-0 whitespace-nowrap pl-4 pr-3 py-3">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheck(company.id, e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
          />
        </td>
        <td className={`${tableCell} pl-3`}>
          <div className="font-semibold text-zinc-900 dark:text-white">
            {company.name ?? 'Unnamed company'}
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">ID {company.id}</div>
        </td>
        <td className={`${tableCell} text-right`}>
          <button type="button" onClick={() => setIsOpen(true)} className={ADMIN_SAVE_BUTTON}>
            Edit
          </button>
        </td>
      </tr>

      <AdminModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Edit company"
        description="Update the company name or remove unused entries."
      >
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="companyId" value={company.id} />
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company name
            <input name="companyName" defaultValue={company.name ?? ''} className={ADMIN_INPUT} />
          </label>
          <div className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Alert rules (company-wide)
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Apply to all dashboards in this company. Dashboard-level rules take precedence.</p>
            <AlertRulesEditor initial={company.alertRules} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StatusMessage state={state} />
            <div className="flex flex-wrap items-center gap-2">
              <button type="submit" name="intent" value="save" className={ADMIN_SAVE_BUTTON}>
                Save changes
              </button>
              <ConfirmDeleteDialog
                title="Delete company"
                description="This will permanently delete the company record."
                triggerClassName={ADMIN_DELETE_BUTTON}
                confirmClassName={ADMIN_DELETE_BUTTON}
              />
            </div>
          </div>
        </form>
      </AdminModal>
    </>
  );
}

export default function CompaniesClient({
  companies,
  addCompanyAction,
  manageCompanyAction,
  bulkCreateAction,
  bulkDeleteAction,
  bulkApplyRulesAction,
  bulkEditRuleAction,
  bulkRemoveRuleAction,
}: CompaniesClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const filteredCompanies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter(
      (c) => (c.name ?? '').toLowerCase().includes(q)
    );
  }, [companies, search]);
  const totalCompanies = companies.length;

  const [companyCreateState, companyCreateAction] = useActionState(addCompanyAction, INITIAL_STATE);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  useRefreshOnSuccess(companyCreateState);
  useDeferredCloseOnSuccess(companyCreateState.status === 'success', () => setIsCreateOpen(false));

  // Bulk state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkNames, setBulkNames] = useState('');
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isBulkRulesOpen, setIsBulkRulesOpen] = useState(false);
  const [bulkRulesMode, setBulkRulesMode] = useState<'append' | 'replace'>('append');
  const [isBulkClearConfirmOpen, setIsBulkClearConfirmOpen] = useState(false);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleCheck(id: number, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(filteredCompanies.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleBulkCreate() {
    const names = bulkNames.split('\n').map((n) => n.trim()).filter(Boolean);
    if (names.length === 0) return;
    startTransition(async () => {
      const result = await bulkCreateAction(names);
      setBulkStatus(`Created ${result.created}, skipped ${result.skipped} duplicates.`);
      setBulkNames('');
      router.refresh();
    });
  }

  function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setIsBulkDeleteConfirmOpen(true);
  }

  function runBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkDeleteAction(ids);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  function handleBulkApplyRules(formData: FormData) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const raw = (formData.get('alertRulesJson') as string) ?? '[]';
    let rules: import('app/dashboards/dashboardDataUtils').AlertRule[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) rules = parsed;
    } catch {
      setBulkStatus('Invalid rule data.');
      return;
    }
    startTransition(async () => {
      const result = await bulkApplyRulesAction(ids, rules, bulkRulesMode);
      setBulkStatus(`Applied ${rules.length} rule(s) to ${result.updated} compan${result.updated === 1 ? 'y' : 'ies'} (${bulkRulesMode}).`);
      setSelectedIds(new Set());
      setIsBulkRulesOpen(false);
      router.refresh();
    });
  }

  function handleBulkClearRules() {
    if (selectedIds.size === 0) return;
    setIsBulkClearConfirmOpen(true);
  }

  function runBulkClearRules() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    startTransition(async () => {
      const result = await bulkApplyRulesAction(ids, [], 'replace');
      setBulkStatus(`Cleared alert rules on ${result.updated} compan${result.updated === 1 ? 'y' : 'ies'}.`);
      setSelectedIds(new Set());
      setIsBulkRulesOpen(false);
      router.refresh();
    });
  }

  const allChecked = filteredCompanies.length > 0 && selectedIds.size === filteredCompanies.length;

  return (
    <AdminSection>
      <AdminSectionHeader
        eyebrow="Company setup"
        title="Companies"
        description="Create and manage company profiles that map to dashboard access."
        count={totalCompanies}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="Total companies"
          value={totalCompanies}
          description="Active company profiles in the system."
        />
        <AdminStatCard label="Quick tips" variant="gradient">
          <ul className={`space-y-2 text-xs ${ADMIN_TEXT_MUTED}`}>
            <li>Use short, human-friendly names for reporting.</li>
            <li>Assign dashboards after creating a company.</li>
          </ul>
        </AdminStatCard>
        <AdminStatCard
          label="Workflow"
          className="sm:col-span-2"
          description="Create a company, then add dashboards and assign users to grant access."
          descriptionTone="muted"
        />
      </div>

      <div className="grid gap-6">
        {/* Bulk Create Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Bulk create companies</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Enter one company name per line to create multiple at once.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsBulkCreateOpen((v) => !v)}
              className={ADMIN_SAVE_BUTTON}
            >
              {isBulkCreateOpen ? 'Hide bulk create' : 'Bulk create'}
            </button>
          </div>
          {isBulkCreateOpen && (
            <div className="mt-4 grid gap-3">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Company names (one per line)
                <textarea
                  value={bulkNames}
                  onChange={(e) => setBulkNames(e.target.value)}
                  rows={5}
                  placeholder={'Acme Corp\nGlobex\nInitech'}
                  className={`${ADMIN_TEXTAREA} resize-y`}
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBulkCreate}
                  disabled={isPending || !bulkNames.trim()}
                  className={ADMIN_PRIMARY_BUTTON}
                >
                  {isPending ? 'Creating…' : 'Create all'}
                </button>
                {bulkStatus && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">{bulkStatus}</p>
                )}
              </div>
            </div>
          )}
        </AdminPanel>

        {/* Manage Panel */}
        <AdminPanel>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className={heading3}>Manage companies</h3>
              <p className={`mt-1 ${textSecondary}`}>
                Update names and remove unused companies.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name…"
                className={`min-w-[12rem] ${ADMIN_INPUT}`}
                aria-label="Search companies"
              />
              {selectedIds.size > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setIsBulkRulesOpen(true)}
                    disabled={isPending}
                    className={`${btnSmall} rounded border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200`}
                  >
                    Apply alert rules ({selectedIds.size})
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={isPending}
                    className={`${btnDanger} ${btnSmall}`}
                  >
                    {isPending ? 'Deleting…' : `Delete selected (${selectedIds.size})`}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setIsCreateOpen(true)}
                className={ADMIN_PRIMARY_BUTTON}
              >
                Create company
              </button>
            </div>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="max-h-[32rem] overflow-auto">
              <table className="min-w-full border-collapse text-left">
                <thead
                  className={`sticky top-0 z-10 ${tableHead} bg-zinc-50 dark:bg-zinc-800/50`}
                >
                  <tr>
                    <th className="w-0 whitespace-nowrap pl-4 pr-3 py-3">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="h-4 w-4 rounded border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800"
                      />
                    </th>
                    <th className={`${tableHeadCell} pl-3`}>Company</th>
                    <th className={`${tableHeadCell} text-right`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((company) => (
                    <CompanyRow
                      key={company.id}
                      company={company}
                      action={manageCompanyAction}
                      checked={selectedIds.has(company.id)}
                      onCheck={handleCheck}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {filteredCompanies.length === 0 ? (
              <p className={`px-4 py-6 text-sm ${ADMIN_TEXT_SUBTLE}`}>
                {companies.length === 0
                  ? 'No companies yet. Create one to begin assigning dashboards.'
                  : 'No companies match your search.'}
              </p>
            ) : null}
          </div>
        </AdminPanel>
      </div>

      <AdminModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create company"
        description="Add a new company profile for dashboards and access rules."
      >
        <form action={companyCreateAction} className="grid gap-4">
          <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
            Company name *
            <input name="companyName" placeholder="Acme Corp" className={ADMIN_INPUT} />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>Companies determine dashboard availability.</p>
            <button type="submit" className={ADMIN_PRIMARY_BUTTON}>
              Create company
            </button>
          </div>
          <StatusMessage state={companyCreateState} />
        </form>
      </AdminModal>

      <ConfirmActionDialog
        isOpen={isBulkClearConfirmOpen}
        title="Clear all alert rules"
        description={`Clear every alert rule from ${selectedIds.size} selected compan${selectedIds.size === 1 ? 'y' : 'ies'}? This cannot be undone.`}
        confirmLabel="Clear rules"
        destructive
        onClose={() => setIsBulkClearConfirmOpen(false)}
        onConfirm={runBulkClearRules}
      />

      <ConfirmActionDialog
        isOpen={isBulkDeleteConfirmOpen}
        title="Delete companies"
        description={`Permanently delete ${selectedIds.size} selected compan${selectedIds.size === 1 ? 'y' : 'ies'}? Dashboards and organizations attached to them may break.`}
        confirmLabel="Delete"
        destructive
        onClose={() => setIsBulkDeleteConfirmOpen(false)}
        onConfirm={runBulkDelete}
      />

      <AdminModal
        isOpen={isBulkRulesOpen}
        onClose={() => setIsBulkRulesOpen(false)}
        title="Alert rules — bulk manage"
        description={`Review, edit, remove, or add rules across ${selectedIds.size} selected compan${selectedIds.size === 1 ? 'y' : 'ies'}. Rules cascade to every dashboard under those companies.`}
      >
        <div className="grid gap-5">
          <section className="grid gap-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Existing rules across selection</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Every unique rule already applied on the selected companies. Edit or remove propagates to every company that has it.</p>
            <ExistingRulesTable
              owners={companies.filter((c) => selectedIds.has(c.id))}
              ownerLabel="company"
              editAction={bulkEditRuleAction}
              removeAction={bulkRemoveRuleAction}
              onChanged={() => router.refresh()}
            />
          </section>

          <section className="grid gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Add new rules</h3>
        <form action={(fd) => handleBulkApplyRules(fd)} className="grid gap-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className={ADMIN_LABEL}>Mode</span>
            <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input type="radio" name="mode" checked={bulkRulesMode === 'append'} onChange={() => setBulkRulesMode('append')} />
              Append (keep existing)
            </label>
            <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input type="radio" name="mode" checked={bulkRulesMode === 'replace'} onChange={() => setBulkRulesMode('replace')} />
              Replace (overwrite existing)
            </label>
          </div>
          <AlertRulesEditor />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={handleBulkClearRules}
              disabled={isPending}
              className={`${btnDanger} ${btnSmall}`}
              title="Wipe every alert rule from selected companies"
            >
              Clear all rules on selected
            </button>
            <button type="button" onClick={() => setIsBulkRulesOpen(false)} className={ADMIN_SAVE_BUTTON}>
              Cancel
            </button>
            <button type="submit" disabled={isPending} className={ADMIN_PRIMARY_BUTTON}>
              {isPending ? 'Applying…' : `Apply to ${selectedIds.size} company/companies`}
            </button>
          </div>
          {bulkStatus && <p className="text-xs text-emerald-600 dark:text-emerald-400">{bulkStatus}</p>}
        </form>
          </section>
        </div>
      </AdminModal>
    </AdminSection>
  );
}
