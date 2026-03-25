'use client';

import ExportButton from 'app/ui/ExportButton';

/** Minimal dataset for Playwright — no Google Sheet. */
export default function E2eCsvExportClient() {
  const data = [
    { Name: 'Alice', Value: '100' },
    { Name: 'Bob', Value: '200' },
  ];
  return (
    <main className="mx-auto max-w-lg p-8 font-sans">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">E2E CSV export fixture</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Gated by ALLOW_E2E_FIXTURES — used only for automated browser tests.
      </p>
      <div className="mt-6">
        <ExportButton data={data} dashboardName="E2E" label="Export CSV" lang="en" />
      </div>
    </main>
  );
}
