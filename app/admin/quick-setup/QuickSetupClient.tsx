'use client';

import { useActionState, useRef, useState } from 'react';
import { INITIAL_STATE, StatusMessage } from '../admin-client-utils';
import { AdminSection } from '../admin-components';
import {
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
  ADMIN_SAVE_BUTTON,
  ADMIN_SELECT,
  ADMIN_TEXT_SUBTLE,
} from '../admin-ui';
import {
  heading2,
  heading3,
  textSecondary,
  cardBase,
  badgeSuccess,
  badgeInfo,
} from 'app/ui/design-tokens';
import type { ActionState, Company, Organization } from '../types';

type QuickSetupState = ActionState & {
  createdCompanyId?: number;
  createdOrganizationId?: number;
  createdOrganizationIds?: number[];
  createdUserId?: number;
  createdDashboardId?: number;
  createdDashboardCount?: number;
};

type FormAction = (prevState: QuickSetupState, formData: FormData) => Promise<QuickSetupState>;

const QUICK_TEMPLATES = ['Summary', 'Simple', 'Detail', 'Driving'] as const;

const TEMPLATE_HINTS: Record<(typeof QUICK_TEMPLATES)[number], string> = {
  Summary: 'KPIs & overview',
  Simple: 'Compact snapshot',
  Detail: 'Alerts, filters, tables',
  Driving: 'Driver hours & safety',
};

const STEPS = [
  { id: 1, label: 'Company', short: 'Who' },
  { id: 2, label: 'Fleets', short: 'Fleets' },
  { id: 3, label: 'Dashboards', short: 'Data' },
] as const;

function sectionBoxClass(active: boolean) {
  return [
    'rounded-xl border p-4 transition-colors',
    active
      ? 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900/80'
      : 'border-zinc-200/80 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/40',
  ].join(' ');
}

export default function QuickSetupClient({
  companies,
  organizations,
  quickSetupAction,
}: {
  companies: Company[];
  organizations: Organization[];
  quickSetupAction: FormAction;
}) {
  const [state, formAction] = useActionState(quickSetupAction, INITIAL_STATE as QuickSetupState);
  const [step, setStep] = useState(1);
  const [useExistingCompany, setUseExistingCompany] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number>(0);
  const [useExistingFleet, setUseExistingFleet] = useState(false);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(
    () => new Set(QUICK_TEMPLATES),
  );
  const [fleetNamesText, setFleetNamesText] = useState('');
  const [existingFleetSelection, setExistingFleetSelection] = useState<Set<number>>(() => new Set());
  const companyNameRef = useRef<HTMLInputElement>(null);

  const fleetNameOptions = fleetNamesText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fleetsForCompany =
    useExistingCompany && selectedCompanyId
      ? organizations.filter((o) => o.companyId === selectedCompanyId)
      : organizations;

  const selectedExistingFleetNames = fleetsForCompany
    .filter((o) => existingFleetSelection.has(o.id))
    .map((o) => (o.name?.trim() ? o.name.trim() : `Fleet #${o.id}`));
  const fleetScopeNames = useExistingFleet ? selectedExistingFleetNames : fleetNameOptions;
  const multipleFleetScope = fleetScopeNames.length > 1;

  const fleetCountHint = useExistingFleet
    ? existingFleetSelection.size === 0
      ? null
      : existingFleetSelection.size === 1
        ? '1 selected'
        : `${existingFleetSelection.size} selected`
    : fleetNameOptions.length === 0
      ? null
      : fleetNameOptions.length === 1
        ? '1 fleet'
        : `${fleetNameOptions.length} fleets`;

  const cannotPickExistingFleetsForNewCompany = useExistingFleet && !useExistingCompany;
  const existingFleetsNeedCompany = useExistingFleet && useExistingCompany && !selectedCompanyId;

  const hasDriving = selectedTemplates.has('Driving');
  const hasNonDrivingTemplate = ['Summary', 'Simple', 'Detail'].some((t) => selectedTemplates.has(t));
  const showDrivingSheetOverride = hasDriving && hasNonDrivingTemplate;

  function toggleTemplate(id: string) {
    setSelectedTemplates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (state.status === 'success') {
    return (
      <AdminSection>
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 py-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
            <svg className="h-7 w-7 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className={heading2}>Done</h2>
            <p className={`mt-2 text-sm ${textSecondary}`}>{state.message}</p>
          </div>
          <ul className="w-full space-y-2 text-left text-sm text-zinc-700 dark:text-zinc-300">
            {state.createdCompanyId ? (
              <li className="flex items-center gap-2">
                <span className={badgeSuccess}>Company</span>
                <span className="font-mono text-xs text-zinc-500">#{state.createdCompanyId}</span>
              </li>
            ) : null}
            {state.createdOrganizationIds && state.createdOrganizationIds.length > 0 ? (
              <li className="flex flex-wrap items-center gap-2">
                <span className={badgeSuccess}>Fleets</span>
                <span className="font-mono text-xs text-zinc-500">
                  #{state.createdOrganizationIds.join(', ')}
                </span>
              </li>
            ) : state.createdOrganizationId ? (
              <li className="flex items-center gap-2">
                <span className={badgeSuccess}>Fleet</span>
                <span className="font-mono text-xs text-zinc-500">#{state.createdOrganizationId}</span>
              </li>
            ) : null}
            {state.createdUserId ? (
              <li className="flex items-center gap-2">
                <span className={badgeInfo}>User</span>
                <span className="font-mono text-xs text-zinc-500">#{state.createdUserId}</span>
              </li>
            ) : null}
            {state.createdDashboardId ? (
              <li className="flex items-center gap-2">
                <span className={badgeInfo}>Dashboard</span>
                <span className="font-mono text-xs text-zinc-500">#{state.createdDashboardId}</span>
              </li>
            ) : null}
            {state.createdDashboardCount != null && state.createdDashboardCount > 0 && !state.createdDashboardId ? (
              <li className="flex items-center gap-2">
                <span className={badgeInfo}>Dashboards</span>
                <span className="text-zinc-600 dark:text-zinc-400">{state.createdDashboardCount} created</span>
              </li>
            ) : null}
          </ul>
          <button type="button" onClick={() => window.location.reload()} className={ADMIN_PRIMARY_BUTTON}>
            Onboard another customer
          </button>
        </div>
      </AdminSection>
    );
  }

  return (
    <AdminSection>
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Step {step} of {STEPS.length}
          </p>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {STEPS[step - 1]?.label}
          </p>
        </div>
        <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="bg-red-600 transition-all duration-300 dark:bg-red-500"
            style={{ width: `${(step / STEPS.length) * 100}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-zinc-500 dark:text-zinc-500">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={
                step === s.id
                  ? 'font-medium text-red-600 dark:text-red-400'
                  : step > s.id
                    ? 'text-emerald-600 dark:text-emerald-500'
                    : ''
              }
            >
              {s.short}
            </button>
          ))}
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-6">
        {useExistingCompany ? <input type="hidden" name="useExistingCompany" value="on" /> : null}
        {useExistingFleet ? <input type="hidden" name="useExistingFleet" value="on" /> : null}

        {/* Step 1 */}
        <div className={step === 1 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Which company?</h3>
            <p className={`mt-1 text-sm ${textSecondary}`}>New customer or an existing company record.</p>
            <div className="mt-5 space-y-4">
              <div className="flex gap-2 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => {
                    setUseExistingCompany(false);
                    setSelectedCompanyId(0);
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    !useExistingCompany
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  New company
                </button>
                <button
                  type="button"
                  onClick={() => setUseExistingCompany(true)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    useExistingCompany
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  Existing
                </button>
              </div>
              {useExistingCompany ? (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Company
                  <select
                    name="existingCompanyId"
                    value={selectedCompanyId || ''}
                    onChange={(e) => {
                      setSelectedCompanyId(Number(e.target.value) || 0);
                      setExistingFleetSelection(new Set());
                    }}
                    className={ADMIN_SELECT}
                    required
                  >
                    <option value="">Select…</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Company name
                  <input
                    ref={companyNameRef}
                    name="companyName"
                    placeholder="e.g. Acme Transport"
                    className={ADMIN_INPUT}
                    required
                  />
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (useExistingCompany) {
                    if (!selectedCompanyId) return;
                  } else {
                    const el = companyNameRef.current;
                    if (!el?.value.trim()) {
                      el?.reportValidity();
                      return;
                    }
                  }
                  setStep(2);
                }}
                className={ADMIN_PRIMARY_BUTTON}
              >
                Continue
              </button>
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className={step === 2 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Fleets</h3>
            <p className={`mt-1 text-sm ${textSecondary}`}>
              Optional. Skip for company-only dashboards, type new fleet names (one per line), or check existing
              fleets — multiple allowed.
            </p>
            <div className="mt-5 space-y-4">
              <div className="flex gap-2 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => {
                    setUseExistingFleet(false);
                    setExistingFleetSelection(new Set());
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    !useExistingFleet
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  Create / list names
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUseExistingFleet(true);
                    setFleetNamesText('');
                    setExistingFleetSelection(new Set());
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
                    useExistingFleet
                      ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                  }`}
                >
                  Pick existing
                </button>
              </div>
              {cannotPickExistingFleetsForNewCompany ? (
                <p className={`rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100`}>
                  Existing fleets belong to a company that is already in the system. Go back to step 1, choose{' '}
                  <strong>Existing</strong> under Company, select that company, then pick fleets here. For a brand-new
                  company, use <strong>Create / list names</strong> instead.
                </p>
              ) : existingFleetsNeedCompany ? (
                <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>Select a company in step 1 to load its fleets.</p>
              ) : useExistingFleet ? (
                <div className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span>Fleets</span>
                    {fleetCountHint ? (
                      <span className={`text-xs font-normal normal-case ${ADMIN_TEXT_SUBTLE}`}>{fleetCountHint}</span>
                    ) : null}
                  </span>
                  {fleetsForCompany.length === 0 ? (
                    <p className={`text-sm ${ADMIN_TEXT_SUBTLE}`}>
                      No fleets under this company yet. Create names above or skip this step.
                    </p>
                  ) : (
                    <ul className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                      {fleetsForCompany.map((o) => (
                        <li key={o.id}>
                          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                            <input
                              type="checkbox"
                              name="existingFleetId"
                              value={o.id}
                              checked={existingFleetSelection.has(o.id)}
                              onChange={() => {
                                setExistingFleetSelection((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(o.id)) next.delete(o.id);
                                  else next.add(o.id);
                                  return next;
                                });
                              }}
                              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                            />
                            {o.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                  <span className={ADMIN_TEXT_SUBTLE}>
                    Check one or many. Leave all unchecked to attach dashboards to the company only.
                  </span>
                </div>
              ) : (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span>Fleet names</span>
                    {fleetCountHint ? (
                      <span className={`text-xs font-normal normal-case ${ADMIN_TEXT_SUBTLE}`}>
                        {fleetCountHint}
                      </span>
                    ) : null}
                  </span>
                  <textarea
                    name="fleetNames"
                    value={fleetNamesText}
                    onChange={(e) => setFleetNamesText(e.target.value)}
                    placeholder={'One per line, e.g.\nBangkok\nChiang Mai'}
                    rows={4}
                    className={ADMIN_INPUT}
                  />
                  <span className={ADMIN_TEXT_SUBTLE}>Names must be unique globally. Empty is OK.</span>
                </label>
              )}
            </div>
            <div className="mt-6 flex justify-between gap-3">
              <button type="button" onClick={() => setStep(1)} className={ADMIN_SAVE_BUTTON}>
                Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (cannotPickExistingFleetsForNewCompany || existingFleetsNeedCompany) return;
                  setStep(3);
                }}
                className={ADMIN_PRIMARY_BUTTON}
              >
                Continue
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: dashboards + sheets + optional user */}
        <div className={step === 3 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Dashboards &amp; sheets</h3>
            <p className={`mt-1 text-sm ${textSecondary}`}>
              Choose what to create, paste Google Sheet links, then submit. Add a login below only if you need
              it now.
            </p>

            <div className="mt-6 space-y-5">
              {multipleFleetScope ? (
                <fieldset className={sectionBoxClass(true)}>
                  <legend className={`px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200`}>
                    Where to attach dashboards
                  </legend>
                  <p className={`mb-3 text-xs ${ADMIN_TEXT_SUBTLE}`}>
                    You have several fleets selected. Create the same dashboards for each fleet, only one fleet, or
                    keep them company-wide.
                  </p>
                  <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                    <span className="sr-only">Scope</span>
                    <select
                      key={fleetScopeNames.join('|')}
                      name="dashboardFleetTarget"
                      className={ADMIN_SELECT}
                      defaultValue="__all__"
                    >
                      <option value="__all__">Every selected fleet (recommended)</option>
                      <option value="__none__">Company only — no fleet</option>
                      {fleetScopeNames.map((name) => (
                        <option key={name} value={name}>
                          {name} only
                        </option>
                      ))}
                    </select>
                  </label>
                </fieldset>
              ) : null}

              <fieldset className={sectionBoxClass(true)}>
                <legend className={`px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200`}>
                  Dashboard templates
                </legend>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className={`text-xs ${ADMIN_TEXT_SUBTLE}`}>
                    All four are selected by default — uncheck what you don&apos;t need.
                  </p>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setSelectedTemplates(new Set(QUICK_TEMPLATES))}
                      className="font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      All
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-600">|</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplates(new Set())}
                      className="font-medium text-zinc-600 hover:underline dark:text-zinc-400"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <ul className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
                  {QUICK_TEMPLATES.map((t) => (
                    <li key={t}>
                      <label className="flex cursor-pointer items-start gap-3 text-sm text-zinc-800 dark:text-zinc-200">
                        <input
                          type="checkbox"
                          name="templates"
                          value={t}
                          checked={selectedTemplates.has(t)}
                          onChange={() => toggleTemplate(t)}
                          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 dark:border-zinc-600"
                        />
                        <span>
                          <span className="font-medium">{t}</span>
                          <span className={`mt-0.5 block text-xs font-normal ${ADMIN_TEXT_SUBTLE}`}>
                            {TEMPLATE_HINTS[t]}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <label className={`mt-4 flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Dashboard name
                  <input name="dashboardName" placeholder="e.g. Operations" className={ADMIN_INPUT} required />
                </label>
              </fieldset>

              <fieldset className={sectionBoxClass(true)}>
                <legend className={`px-1 text-sm font-medium text-zinc-800 dark:text-zinc-200`}>
                  Google Sheets
                </legend>
                <div className="space-y-4">
                  <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                    Primary Google Sheet
                    <input
                      name="sheetUrl"
                      type="url"
                      placeholder="https://docs.google.com/spreadsheets/d/…"
                      className={ADMIN_INPUT}
                      required
                    />
                    <span className={ADMIN_TEXT_SUBTLE}>
                      {showDrivingSheetOverride
                        ? 'Used for every selected template except Driving when you add a separate link below.'
                        : hasDriving && !hasNonDrivingTemplate
                          ? 'Used for the Driving dashboard.'
                          : 'Used for all selected templates.'}
                    </span>
                  </label>
                  {showDrivingSheetOverride ? (
                    <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                      Driving sheet <span className="text-xs font-normal text-zinc-500">(optional)</span>
                      <input
                        name="drivingSheetUrl"
                        type="url"
                        placeholder="Only if the driver report is in another file"
                        className={ADMIN_INPUT}
                      />
                      <span className={ADMIN_TEXT_SUBTLE}>Leave empty to use the primary sheet for Driving too.</span>
                    </label>
                  ) : null}
                </div>
              </fieldset>

              <details className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600">
                <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Customer login (optional)
                </summary>
                <div className="grid gap-4 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700 sm:grid-cols-2">
                  <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                    Email
                    <input name="userEmail" type="email" autoComplete="off" placeholder="user@company.com" className={ADMIN_INPUT} />
                  </label>
                  <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                    Initial password
                    <input type="password" name="userPassword" autoComplete="new-password" placeholder="••••••••" className={ADMIN_INPUT} />
                  </label>
                  <p className={`sm:col-span-2 text-xs ${ADMIN_TEXT_SUBTLE}`}>
                    Both fields required if you add a user. They get access to this company and every fleet you
                    set up above.
                  </p>
                </div>
              </details>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(2)} className={ADMIN_SAVE_BUTTON}>
                Back
              </button>
              <button
                type="submit"
                disabled={selectedTemplates.size === 0}
                className={`${ADMIN_PRIMARY_BUTTON} min-w-[10rem] px-8 disabled:pointer-events-none disabled:opacity-50`}
              >
                Create setup
              </button>
            </div>
            <StatusMessage state={state} className="mt-4" />
          </div>
        </div>
      </form>
    </AdminSection>
  );
}
