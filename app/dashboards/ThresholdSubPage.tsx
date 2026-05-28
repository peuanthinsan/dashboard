'use client';

import { useMemo } from 'react';
import KpiCard from 'app/ui/KpiCard';
import { DataTable, type Column } from 'app/ui/DataTable';
import TrendChart, { type MultiTrendDatum } from 'app/ui/TrendChart';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
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
  const copy = getDashboardCopy(lang).drivingV2;
  const uniqueDrivers = useMemo(
    () => new Set(violations.map((v) => v.driver)).size,
    [violations],
  );
  const warnedDrivers = useMemo(
    () => new Set(violations.filter((v) => v.warning).map((v) => v.driver)).size,
    [violations],
  );

  const chartData = useMemo<MultiTrendDatum[]>(() => {
    const map = new Map<string, { duration: number; distance: number }>();
    for (const v of violations) {
      const key = v.dayKey;
      const c = map.get(key) ?? { duration: 0, distance: 0 };
      c.duration += metric === 'drive_hrs' ? v.driveHours : v.restHours;
      c.distance += v.distanceKm;
      map.set(key, c);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, c]) => ({
        label: key.slice(5).replace('-', '/'),
        values: {
          [lang === 'th' ? 'ชั่วโมง' : 'Hours']: Math.round(c.duration * 10) / 10,
          [lang === 'th' ? 'กม.' : 'KM']: Math.round(c.distance),
        },
      }));
  }, [violations, metric, lang]);

  const columns = useMemo<Column<ViolationRow>[]>(() => {
    if (metric === 'drive_hrs') {
      return [
        { key: 'driver', label: copy.tableHeaderDriver, sortable: true, stickyLeft: true },
        { key: 'dateLabel', label: copy.tableHeaderDay, sortable: true },
        {
          key: 'vehicle',
          label: copy.tableHeaderVehicle,
          sortable: true,
          render: (v, row) => row.vehicleCount > 1
            ? <span title={`${row.vehicleCount} vehicles`}>*</span>
            : String(v ?? '—'),
        },
        { key: 'shiftCount', label: copy.tableHeaderShifts, sortable: true },
        { key: 'loginAt', label: copy.tableHeaderFirstLogin, render: (v) => formatClock(v as Date | null) },
        { key: 'logoutAt', label: copy.tableHeaderLastLogout, render: (v) => formatClock(v as Date | null) },
        { key: 'loginLocation', label: copy.tableHeaderLoginLoc },
        { key: 'logoutLocation', label: copy.tableHeaderLogoutLoc },
        { key: 'driveHours', label: copy.tableHeaderTotalDriveHrs, sortable: true, render: (v) => formatHours(Number(v)) },
        { key: 'distanceKm', label: copy.tableHeaderDistance, sortable: true, render: (v) => formatDistance(Number(v)) },
        {
          key: 'warning',
          label: copy.tableHeaderStatus,
          render: (_, row) => row.warning
            ? <span className="text-emerald-600">{copy.warnSent} · {row.warning.channelName}</span>
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
      { key: 'driver', label: copy.tableHeaderDriver, sortable: true, stickyLeft: true },
      { key: 'vehicle', label: copy.tableHeaderVehicle, sortable: true },
      { key: 'dateLabel', label: copy.tableHeaderDay, sortable: true },
      { key: 'loginAt', label: copy.tableHeaderLogin, render: (v) => formatClock(v as Date | null) },
      { key: 'logoutAt', label: copy.tableHeaderLogout, render: (v) => formatClock(v as Date | null) },
      { key: 'loginLocation', label: copy.tableHeaderLoginLoc },
      { key: 'logoutLocation', label: copy.tableHeaderLogoutLoc },
      { key: 'restHours', label: copy.tableHeaderRestHrs, sortable: true, render: (v) => formatHours(Number(v)) },
      { key: 'distanceKm', label: copy.tableHeaderDistance, sortable: true, render: (v) => formatDistance(Number(v)) },
      {
        key: 'warning',
        label: copy.tableHeaderStatus,
        render: (_, row) => row.warning
          ? <span className="text-emerald-600">{copy.warnSent} · {row.warning.channelName}</span>
          : <span className={textSecondary}>—</span>,
      },
      {
        key: 'violationKey',
        label: '',
        render: (_, row) => renderWarnAction ? renderWarnAction(row) : null,
      },
    ];
  }, [metric, copy, renderWarnAction]);

  return (
    <section className={dashboardSectionClass}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={heading2}>{thresholdLabel}</h2>
        <span className={`text-sm ${textSecondary}`}>{violations.length} {copy.rowCountLabel}</span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <KpiCard
          accentColor={ACCENT_VIOLATION}
          label={copy.kpiViolatingDrivers}
          value={String(uniqueDrivers)}
        />
        <KpiCard
          accentColor={ACCENT_WARNED}
          label={copy.kpiWarnedDrivers}
          value={String(warnedDrivers)}
        />
      </div>

      {chartData.length > 0 && (
        <div className="mb-6">
          <TrendChart data={chartData} mode="dual-axis" height={280} ariaLabel={thresholdLabel} />
        </div>
      )}

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
