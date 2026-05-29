import { type DashboardLang } from 'app/dashboard/i18n-copy';
import {
  type DrivingThresholdEntry,
  type DrivingThresholds,
  thresholdEntryLabel,
  thresholdEntryValue,
} from './drivingThresholds';

export type SubPage =
  | { kind: 'overview'; slug: 'overview'; label: string }
  | { kind: 'drive_hrs'; slug: `drive-hrs-${number}`; threshold: number; label: string }
  | { kind: 'rest_hrs'; slug: `rest-hrs-${number}`; threshold: number; label: string }
  | { kind: 'cnt_drv_hrs'; slug: `cnt-drv-hrs-${number}`; threshold: number; label: string };

function sortAsc<T>(entries: T[], value: (t: T) => number): T[] {
  return [...entries].sort((a, b) => value(a) - value(b));
}

export function deriveSubPages(
  t: DrivingThresholds,
  lang: DashboardLang,
  copy?: { tabOverview: string; tabDriveHrsPrefix: string; tabRestHrsPrefix: string },
): SubPage[] {
  const overview: SubPage = {
    kind: 'overview',
    slug: 'overview',
    label: copy?.tabOverview ?? (lang === 'th' ? 'ภาพรวม' : 'Overview'),
  };
  const drivePrefix = copy?.tabDriveHrsPrefix ?? (lang === 'th' ? 'ขับรถ/วัน' : 'Drive Hr/day');
  const restPrefix = copy?.tabRestHrsPrefix ?? (lang === 'th' ? 'พัก' : 'Rest Hr');
  const cntDrvPrefix = lang === 'th' ? 'ขับต่อเนื่อง' : 'Cnt Drv';
  const drive = sortAsc<DrivingThresholdEntry>(t.driveHours, thresholdEntryValue).map((e) => {
    const v = thresholdEntryValue(e);
    return {
      kind: 'drive_hrs' as const,
      slug: `drive-hrs-${v}` as const,
      threshold: v,
      label: thresholdEntryLabel(e, `${drivePrefix} > ${v} h`),
    };
  });
  const rest = sortAsc<DrivingThresholdEntry>(t.restHours, thresholdEntryValue).map((e) => {
    const v = thresholdEntryValue(e);
    return {
      kind: 'rest_hrs' as const,
      slug: `rest-hrs-${v}` as const,
      threshold: v,
      label: thresholdEntryLabel(e, `${restPrefix} < ${v} h`),
    };
  });
  const cntDrv = sortAsc<DrivingThresholdEntry>(t.cntDrvHours, thresholdEntryValue).map((e) => {
    const v = thresholdEntryValue(e);
    return {
      kind: 'cnt_drv_hrs' as const,
      slug: `cnt-drv-hrs-${v}` as const,
      threshold: v,
      label: thresholdEntryLabel(e, `${cntDrvPrefix} > ${v} h`),
    };
  });
  return [overview, ...drive, ...rest, ...cntDrv];
}

export function subPageBySlug(pages: SubPage[], slug: string | null): SubPage {
  if (!slug) return pages[0];
  return pages.find((p) => p.slug === slug) ?? pages[0];
}
