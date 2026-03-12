'use client';

type ExportButtonProps = {
  data: Record<string, unknown>[];
  /** Legacy direct filename (used as-is when dashboardName/dateRange are not provided). */
  filename?: string;
  /** Dashboard name included in the generated filename, e.g. "SummaryDashboard". */
  dashboardName?: string;
  /**
   * Date range string included in the generated filename, e.g. "2026-03" or "2026-01_2026-03".
   * Accepts any string; special characters are sanitised before use.
   */
  dateRange?: string;
  columns?: { key: string; label: string }[];
  label?: string;
};

function buildFilename(filename?: string, dashboardName?: string, dateRange?: string): string {
  if (dashboardName || dateRange) {
    const parts: string[] = [];
    if (dashboardName) parts.push(dashboardName.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (dateRange) parts.push(dateRange.replace(/[^a-zA-Z0-9_-]/g, '_'));
    return parts.join('_') || 'export';
  }
  return filename ?? 'export';
}

export default function ExportButton({
  data,
  filename,
  dashboardName,
  dateRange,
  columns,
  label = 'Export CSV',
}: ExportButtonProps) {
  const handleExport = () => {
    if (data.length === 0) return;
    const cols = columns ?? Object.keys(data[0]).map((key) => ({ key, label: key }));
    const header = cols.map((c) => c.label).join(',');
    const rows = data.map((row) =>
      cols
        .map((c) => {
          const val = row[c.key];
          const str = val == null ? '' : String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildFilename(filename, dashboardName, dateRange)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={data.length === 0}
      aria-label={label}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {label}
    </button>
  );
}
