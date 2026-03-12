'use client';

import { useState } from 'react';
import { useFormState } from 'react-dom';
import { INITIAL_STATE, StatusMessage } from '../admin-client-utils';
import { AdminSection } from '../admin-components';
import {
  ADMIN_INPUT,
  ADMIN_LABEL,
  ADMIN_PRIMARY_BUTTON,
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
  createdUserId?: number;
  createdDashboardId?: number;
};

type FormAction = (prevState: QuickSetupState, formData: FormData) => Promise<QuickSetupState>;

const DASHBOARD_TEMPLATES = ['Summary', 'Detail', 'Simple', 'Driving'] as const;

const STEPS = [
  { number: 1, label: 'Company', description: 'Create or select a company' },
  { number: 2, label: 'Fleet', description: 'Optional fleet grouping' },
  { number: 3, label: 'User', description: 'Optional login account' },
  { number: 4, label: 'Dashboard', description: 'Connect to Google Sheet' },
];

export default function QuickSetupClient({
  companies,
  organizations,
  quickSetupAction,
}: {
  companies: Company[];
  organizations: Organization[];
  quickSetupAction: FormAction;
}) {
  const [state, formAction] = useFormState(quickSetupAction, INITIAL_STATE as QuickSetupState);
  const [step, setStep] = useState(1);
  const [useExistingCompany, setUseExistingCompany] = useState(false);
  const [useExistingFleet, setUseExistingFleet] = useState(false);

  if (state.status === 'success') {
    return (
      <AdminSection>
        <div className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950">
            <svg className="h-8 w-8 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h2 className={heading2}>Customer onboarded!</h2>
            <p className={`mt-2 ${textSecondary}`}>{state.message}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {state.createdCompanyId ? (
              <span className={badgeSuccess}>Company #{state.createdCompanyId}</span>
            ) : null}
            {state.createdOrganizationId ? (
              <span className={badgeSuccess}>Fleet #{state.createdOrganizationId}</span>
            ) : null}
            {state.createdUserId ? (
              <span className={badgeInfo}>User #{state.createdUserId}</span>
            ) : null}
            {state.createdDashboardId ? (
              <span className={badgeInfo}>Dashboard #{state.createdDashboardId}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={ADMIN_PRIMARY_BUTTON}
          >
            Set up another customer
          </button>
        </div>
      </AdminSection>
    );
  }

  return (
    <AdminSection>
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.number} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(s.number)}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition ${
                step === s.number
                  ? 'bg-indigo-600 text-white'
                  : step > s.number
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                    : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
              }`}
            >
              {step > s.number ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                s.number
              )}
            </button>
            <span className={`hidden text-sm sm:block ${step === s.number ? 'font-medium text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <div className={`h-px w-6 ${step > s.number ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-zinc-200 dark:bg-zinc-700'}`} />
            ) : null}
          </div>
        ))}
      </div>

      <form action={formAction} className="flex flex-col gap-6">
        {/* Hidden fields for checkbox state */}
        {useExistingCompany ? <input type="hidden" name="useExistingCompany" value="on" /> : null}
        {useExistingFleet ? <input type="hidden" name="useExistingFleet" value="on" /> : null}

        {/* Step 1: Company */}
        <div className={step === 1 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Step 1: Company</h3>
            <p className={`mt-1 mb-4 ${textSecondary}`}>
              Create a new company or use an existing one.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={useExistingCompany}
                  onChange={(e) => setUseExistingCompany(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Use existing company
              </label>
              {useExistingCompany ? (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Select company
                  <select name="existingCompanyId" className={ADMIN_SELECT}>
                    <option value="">Choose a company</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Company name *
                  <input name="companyName" placeholder="Acme Transport Co." className={ADMIN_INPUT} />
                </label>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setStep(2)} className={ADMIN_PRIMARY_BUTTON}>
                Next: Fleet
              </button>
            </div>
          </div>
        </div>

        {/* Step 2: Fleet */}
        <div className={step === 2 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Step 2: Fleet (optional)</h3>
            <p className={`mt-1 mb-4 ${textSecondary}`}>
              Group dashboards by fleet for multi-fleet customers.
            </p>
            <div className="space-y-4">
              <label className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={useExistingFleet}
                  onChange={(e) => setUseExistingFleet(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-600"
                />
                Use existing fleet
              </label>
              {useExistingFleet ? (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Select fleet
                  <select name="existingFleetId" className={ADMIN_SELECT}>
                    <option value="">Choose a fleet</option>
                    {organizations.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                  Fleet name
                  <input name="fleetName" placeholder="Bangkok Fleet" className={ADMIN_INPUT} />
                  <span className={ADMIN_TEXT_SUBTLE}>Leave blank to skip fleet creation.</span>
                </label>
              )}
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={() => setStep(1)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                Back
              </button>
              <button type="button" onClick={() => setStep(3)} className={ADMIN_PRIMARY_BUTTON}>
                Next: User
              </button>
            </div>
          </div>
        </div>

        {/* Step 3: User */}
        <div className={step === 3 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Step 3: User account (optional)</h3>
            <p className={`mt-1 mb-4 ${textSecondary}`}>
              Create a login for this customer. Leave blank to skip.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Email
                <input name="userEmail" placeholder="user@customer.com" className={ADMIN_INPUT} />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Temporary password
                <input type="password" name="userPassword" placeholder="Initial password" className={ADMIN_INPUT} />
              </label>
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={() => setStep(2)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                Back
              </button>
              <button type="button" onClick={() => setStep(4)} className={ADMIN_PRIMARY_BUTTON}>
                Next: Dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Step 4: Dashboard */}
        <div className={step === 4 ? '' : 'hidden'}>
          <div className={cardBase}>
            <h3 className={heading3}>Step 4: Dashboard</h3>
            <p className={`mt-1 mb-4 ${textSecondary}`}>
              Connect the customer&apos;s Google Sheet to create their dashboard.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Dashboard name *
                <input name="dashboardName" placeholder="Operations Overview" className={ADMIN_INPUT} />
              </label>
              <label className={`flex flex-col gap-2 ${ADMIN_LABEL}`}>
                Template
                <select name="template" className={ADMIN_SELECT}>
                  {DASHBOARD_TEMPLATES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className={`flex flex-col gap-2 sm:col-span-2 ${ADMIN_LABEL}`}>
                Google Sheet link *
                <input name="sheetUrl" placeholder="https://docs.google.com/spreadsheets/d/..." className={ADMIN_INPUT} />
              </label>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" onClick={() => setStep(3)} className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                Back
              </button>
              <button type="submit" className={`${ADMIN_PRIMARY_BUTTON} px-8`}>
                Create everything
              </button>
            </div>
            <StatusMessage state={state} className="mt-3" />
          </div>
        </div>
      </form>
    </AdminSection>
  );
}
