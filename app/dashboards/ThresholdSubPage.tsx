'use client';

import { useMemo } from 'react';
import KpiCard from 'app/ui/KpiCard';
import { DataTable, type Column } from 'app/ui/DataTable';
import { type DashboardLang } from 'app/dashboard/i18n-copy';
import { dashboardSectionClass } from './DashboardShell';
import { heading2, textSecondary } from 'app/ui/design-tokens';
import type { ViolationRow } from './dashboardDataUtils';

type Props = {
  metric: 'drive_hrs' | 'rest_hrs';
  threshold: number;
  thresholdLabel: string;
  violations: ViolationRow[];
  lang: DashboardLang;
  renderWarnAction?: (row: ViolationRow) => React.ReactNode;
};

// KpiCard uses CSS color strings via the `accentColor` prop. These match the
// v1 dashboard's existing palette (amber for violations, emerald for the
// healthy/warned state).
const ACCENT_VIOLATION = '#f59e0b';
const ACCENT_WARNED = '#10b981';

const formatHours = (n: number) => `${n.toFixed(2)} h`;
const formatDistance = (n: number) => `${n.toFixed(1)} km`;
const formatClock = (d: Date | null) =>
  d
    ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    : '—';

export default function ThresholdSubPage({
  metric,
  threshold: _threshold,
  thresholdLabel,
  violations,
  lang,
  renderWarnAction,
}: Props) {
  const uniqueDrivers = useMemo(
    () => new Set(violations.map((v) => v.driver)).size,
    [violations],
  );
  const warnedDrivers = useMemo(
    () => new Set(violations.filter((v) => v.warning).map((v) => v.driver)).size,
    [violations],
  );

  const columns = useMemo<Column<ViolationRow>[]>(() => {
    if (metric === 'drive_hrs') {
      return [
        { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver', sortable: true, stickyLeft: true },
        { key: 'dateLabel', label: lang === 'th' ? 'วันที่' : 'Day', sortable: true },
        {
          key: 'vehicle',
          label: lang === 'th' ? 'รถ' : 'Vehicle',
          sortable: true,
          render: (v, row) => row.vehicleCount > 1
            ? <span title={`${row.vehicleCount} vehicles`}>*</span>
            : String(v ?? '—'),
        },
        { key: 'shiftCount', label: lang === 'th' ? 'กะ' : 'Shifts', sortable: true },
        { key: 'loginAt', label: lang === 'th' ? 'เริ่ม' : 'First Login', render: (v) => formatClock(v as Date | null) },
        { key: 'logoutAt', label: lang === 'th' ? 'จบ' : 'Last Logout', render: (v) => formatClock(v as Date | null) },
        { key: 'loginLocation', label: lang === 'th' ? 'สถานที่เริ่ม' : 'Login Loc' },
        { key: 'logoutLocation', label: lang === 'th' ? 'สถานที่จบ' : 'Logout Loc' },
        { key: 'driveHours', label: lang === 'th' ? 'ขับรวม' : 'Total Drive Hrs', sortable: true, render: (v) => formatHours(Number(v)) },
        { key: 'distanceKm', label: lang === 'th' ? 'ระยะทาง' : 'Distance', sortable: true, render: (v) => formatDistance(Number(v)) },
        {
          key: 'warning',
          label: lang === 'th' ? 'สถานะ' : 'Status',
          render: (_, row) => row.warning
            ? <span className="text-emerald-600">Warned ✓ · {row.warning.channelName}</span>
            : <span className={textSecondary}>—</span>,
        },
        {
          key: 'violationKey',
          label: '',
          render: (_, row) => renderWarnAction ? renderWarnAction(row) : null,
        },
      ];
    }
    return [
      { key: 'driver', label: lang === 'th' ? 'คนขับ' : 'Driver', sortable: true, stickyLeft: true },
      { key: 'vehicle', label: lang === 'th' ? 'รถ' : 'Vehicle', sortable: true },
      { key: 'dateLabel', label: lang === 'th' ? 'วันที่' : 'Date', sortable: true },
      { key: 'loginAt', label: lang === 'th' ? 'เริ่ม' : 'Login', render: (v) => formatClock(v as Date | null) },
      { key: 'logoutAt', label: lang === 'th' ? 'จบ' : 'Logout', render: (v) => formatClock(v as Date | null) },
      { key: 'loginLocation', label: lang === 'th' ? 'สถานที่เริ่ม' : 'Login Loc' },
      { key: 'logoutLocation', label: lang === 'th' ? 'สถานที่จบ' : 'Logout Loc' },
      { key: 'restHours', label: lang === 'th' ? 'พัก' : 'Rest Hrs', sortable: true, render: (v) => formatHours(Number(v)) },
      { key: 'distanceKm', label: lang === 'th' ? 'ระยะทาง' : 'Distance', sortable: true, render: (v) => formatDistance(Number(v)) },
      {
        key: 'warning',
        label: lang === 'th' ? 'สถานะ' : 'Status',
        render: (_, row) => row.warning
          ? <span className="text-emerald-600">Warned ✓ · {row.warning.channelName}</span>
          : <span className={textSecondary}>—</span>,
      },
      {
        key: 'violationKey',
        label: '',
        render: (_, row) => renderWarnAction ? renderWarnAction(row) : null,
      },
    ];
  }, [metric, lang, renderWarnAction]);

  return (
    <section className={dashboardSectionClass}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={heading2}>{thresholdLabel}</h2>
        <span className={`text-sm ${textSecondary}`}>{violations.length} {lang === 'th' ? 'รายการ' : 'rows'}</span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <KpiCard
          accentColor={ACCENT_VIOLATION}
          label={lang === 'th' ? 'คนขับที่ฝ่าฝืน' : 'Violating drivers'}
          value={String(uniqueDrivers)}
        />
        <KpiCard
          accentColor={ACCENT_WARNED}
          label={lang === 'th' ? 'คนขับที่ได้รับการแจ้ง' : 'Drivers warned'}
          value={String(warnedDrivers)}
        />
      </div>

      <DataTable
        columns={columns}
        data={violations}
        pageSize={15}
        defaultSort={metric === 'drive_hrs'
          ? { key: 'driveHours', direction: 'desc' }
          : { key: 'restHours', direction: 'asc' }}
        ariaLabel={thresholdLabel}
      />
    </section>
  );
}
