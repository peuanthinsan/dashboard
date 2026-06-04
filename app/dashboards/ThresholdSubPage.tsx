'use client';

import { useCallback, useMemo } from 'react';
import KpiCard from 'app/ui/KpiCard';
import { DataTable, type Column } from 'app/ui/DataTable';
import TrendChart, { type MultiTrendDatum } from 'app/ui/TrendChart';
import { getDashboardCopy, type DashboardLang } from 'app/dashboard/i18n-copy';
import { dashboardSectionClass } from './DashboardShell';
import { heading2, textSecondary } from 'app/ui/design-tokens';
import type { ViolationRow } from './dashboardDataUtils';
import { formatDurationDisplay } from './drivingDurationFormat';
import {
  DRIVING_LOCATION_COLUMN_MAX_WIDTH_CLASS,
  DRIVING_LOCATION_TEXT_CLASS,
} from './drivingLocationDisplay';

type Props = {
  metric: 'drive_hrs' | 'rest_hrs' | 'cnt_drv_hrs';
  threshold: number;
  thresholdLabel: string;
  violations: ViolationRow[];
  lang: DashboardLang;
  renderWarnAction?: (row: ViolationRow) => React.ReactNode;
};

const ACCENT_VIOLATION = '#f59e0b';
const ACCENT_WARNED = '#10b981';

const formatClock = (d: Date | null) =>
  d
    ? `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
    : '—';

const formatDistance = (n: number) => `${n.toFixed(1)} km`;

const renderLocation = (value: unknown) => {
  const text = String(value ?? '').trim();
  if (!text || text === '—') {
    return <span className="text-zinc-300">—</span>;
  }
  return (
    <span className={DRIVING_LOCATION_TEXT_CLASS} title={text}>
      {text}
    </span>
  );
};

export default function ThresholdSubPage({
  metric,
  threshold: _threshold,
  thresholdLabel,
  violations,
  lang,
  renderWarnAction,
}: Props) {
  const copy = getDashboardCopy(lang).drivingV2;
  const isExceeding = useCallback(
    (row: ViolationRow) =>
      metric === 'rest_hrs'
        ? row.restHours > 0 && row.restHours < row.threshold
        : row.driveHours > row.threshold,
    [metric],
  );

  const uniqueDrivers = useMemo(
    () => new Set(violations.map((v) => v.driver)).size,
    [violations],
  );
  const exceedingDrivers = useMemo(
    () => new Set(violations.filter(isExceeding).map((v) => v.driver)).size,
    [violations, isExceeding],
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
      c.duration += metric === 'rest_hrs' ? v.restHours : v.driveHours;
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
    const useCntDrvLabels = metric === 'cnt_drv_hrs';
    const hoursKey = metric === 'rest_hrs' ? 'restHours' : 'driveHours';
    const hoursLabel = metric === 'rest_hrs'
      ? copy.sheetRestTime
      : copy.sheetCntDrvHr;

    return [
      { key: 'driver', label: copy.sheetDriverName, sortable: true, stickyLeft: true },
      { key: 'vehicle', label: copy.sheetVehicleNo, sortable: true },
      {
        key: 'loginAt',
        sortKey: '_loginAtMs',
        sortable: true,
        label: useCntDrvLabels ? copy.sheetStartTime : copy.sheetLoginTime,
        render: (v) => formatClock(v as Date | null),
      },
      {
        key: 'logoutAt',
        label: useCntDrvLabels ? copy.sheetEndTime : copy.sheetLogoutTime,
        render: (v) => formatClock(v as Date | null),
      },
      {
        key: 'loginLocation',
        label: useCntDrvLabels ? copy.sheetStartLocation : copy.sheetLoginLocation,
        wrap: true,
        wrapClassName: DRIVING_LOCATION_COLUMN_MAX_WIDTH_CLASS,
        render: renderLocation,
      },
      {
        key: 'logoutLocation',
        label: useCntDrvLabels ? copy.sheetEndLocation : copy.sheetLogoutLocation,
        wrap: true,
        wrapClassName: DRIVING_LOCATION_COLUMN_MAX_WIDTH_CLASS,
        render: renderLocation,
      },
      {
        key: hoursKey,
        label: hoursLabel,
        sortable: true,
        render: (v, row) => {
          const exceeded = isExceeding(row);
          return (
            <span className={exceeded
              ? 'tabular-nums font-semibold text-red-600 dark:text-red-400'
              : 'tabular-nums text-zinc-500 dark:text-zinc-400'
            }>
              {formatDurationDisplay(null, Number(v))}
            </span>
          );
        },
      },
      {
        key: 'distanceKm',
        label: copy.sheetDistance,
        sortable: true,
        render: (v) => formatDistance(Number(v)),
      },
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
  }, [metric, copy, renderWarnAction, isExceeding]);

  return (
    <section className={dashboardSectionClass}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={heading2}>{thresholdLabel}</h2>
        <span className={`text-sm ${textSecondary}`}>{violations.length} {copy.rowCountLabel}</span>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard
          accentColor="#6b7280"
          label={lang === 'th' ? 'คนขับทั้งหมด' : 'Total drivers'}
          value={String(uniqueDrivers)}
        />
        <KpiCard
          accentColor={ACCENT_VIOLATION}
          label={copy.kpiViolatingDrivers}
          value={String(exceedingDrivers)}
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
        defaultSort={{ key: 'loginAt', direction: 'desc' }}
        ariaLabel={thresholdLabel}
      />
    </section>
  );
}
