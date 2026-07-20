import { createHash } from 'node:crypto';

export type TrendDatum = {
  key: string;
  date: Date;
  count: number;
};

export type TrendPoint = {
  x: number;
  y: number;
  count: number;
  label: string;
};

export type TrendGeometry = {
  points: TrendPoint[];
  path: string;
  viewBox: string;
  padding: { top: number; right: number; bottom: number; left: number };
  width: number;
  height: number;
};

type TrendLabel = {
  label: string;
  position: number;
};

type Row = Record<string, unknown>;

const normalizedKeyCache = new WeakMap<Row, Map<string, string>>();

export const normalizeLabel = (value: string) => value.trim().toLowerCase();

/**
 * Resolve a dashboard's fleet scope to the list of fleet names it is limited to.
 * Prefers the multi-fleet `organizationNames`; falls back to the legacy single
 * `organizationName`. An empty result means "no scope" (show every fleet).
 */
export const resolveScopeFleetNames = (
  organizationName?: string | null,
  organizationNames?: string[] | null,
): string[] => {
  if (organizationNames && organizationNames.length > 0) return organizationNames;
  return organizationName ? [organizationName] : [];
};

/**
 * Normalized Set of the scoped fleet names, for hard-limit membership tests.
 * Empty Set means "no scope" — callers should treat that as "allow all".
 */
export const scopeFleetSet = (
  organizationName?: string | null,
  organizationNames?: string[] | null,
): Set<string> =>
  new Set(resolveScopeFleetNames(organizationName, organizationNames).map(normalizeLabel));

const getNormalizedKeyMap = (row: Row) => {
  const cached = normalizedKeyCache.get(row);
  if (cached) return cached;
  const map = new Map<string, string>();
  Object.keys(row).forEach((key) => {
    const normalized = normalizeLabel(key);
    if (!map.has(normalized)) {
      map.set(normalized, key);
    }
  });
  normalizedKeyCache.set(row, map);
  return map;
};

export const findValue = (row: Row, labels: string[]) => {
  const keyMap = getNormalizedKeyMap(row);
  for (const label of labels) {
    const key = keyMap.get(normalizeLabel(label));
    if (key) return row[key];
  }
  return null;
};

/**
 * Shared header aliases for the alert timestamp column, in lookup order.
 * Customer sheets spell this header differently; when a customer's rows come
 * back empty, extend THIS list so every template that reads alert times picks
 * up the fix at once (previously each template carried its own inline copy and
 * single-template fixes left the same customer's other dashboards broken).
 * OverSpeedDashboard keeps its own wider list ('DateTime', 'Start Time', …).
 */
export const ALERT_TIME_ALIASES = ['Alert Date Time', 'Track Time', 'Date'];

export const toDisplayString = (value: unknown) => {
  if (value == null || value === '') return '—';
  return String(value);
};

export const hasRemark = (value: string) => value !== '—' && value.trim() !== '';

export const isExcludedAlertRemark = (value: string) => {
  if (!hasRemark(value)) return false;
  const normalizedValue = normalizeLabel(value);
  return (
    normalizedValue.includes('false alert') ||
    normalizedValue.includes('no video') ||
    normalizedValue.includes('no-video')
  );
};

/**
 * Sheet timestamps are wall-clock Thailand (Asia/Bangkok, fixed UTC+7, no DST)
 * with no timezone marker. We normalise every parsed date to a UTC instant that
 * carries the Bangkok wall-clock DIGITS (e.g. "12:08" Bangkok → 12:08 UTC). All
 * downstream formatting and month/day keys then use UTC getters (`getUTC*`,
 * `toISOString`, `timeZone: 'UTC'`), so displayed values match the source report
 * exactly and are identical regardless of the viewer's own timezone.
 */
export const parseDate = (value: unknown) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  // Handle DD/MM/YYYY, DD/MM/YYYY HH:MM, or DD/MM/YYYY HH:MM:SS (seconds optional)
  const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy, hh, mi, ss] = ddmmyyyy;
    const d = parseInt(dd!, 10);
    const m = parseInt(mm!, 10) - 1;
    const y = parseInt(yyyy!, 10);
    const hour = hh ? parseInt(hh, 10) : 0;
    const min = mi ? parseInt(mi, 10) : 0;
    const sec = ss ? parseInt(ss, 10) : 0;
    const parsed = new Date(Date.UTC(y, m, d, hour, min, sec));
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  // Fallback for other formats (e.g. "Jun 30, 2026, 12:08:47 PM"). `new Date(raw)`
  // interprets a zoneless string in the runtime's local zone; we read those local
  // wall-clock components straight back and re-stamp them as UTC digits so the
  // result is viewer-independent.
  const local = new Date(raw);
  if (Number.isNaN(local.getTime())) return null;
  return new Date(Date.UTC(
    local.getFullYear(), local.getMonth(), local.getDate(),
    local.getHours(), local.getMinutes(), local.getSeconds(),
  ));
};

export const toMonthKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

export const previousMonthKey = (now: Date = new Date()) => {
  // Sheet month keys are Bangkok calendar months, but `now` is a real instant:
  // during 00:00–07:00 Bangkok on the 1st, UTC is still in the prior month and
  // unshifted UTC getters would default the dashboards to TWO months back.
  // Shift +7h so the UTC getters read Bangkok's calendar (UTC+7, no DST).
  const bangkok = new Date(now.getTime() + 7 * 3_600_000);
  return toMonthKey(new Date(Date.UTC(bangkok.getUTCFullYear(), bangkok.getUTCMonth() - 1, 1)));
};

export const toMonthLabel = (date: Date) =>
  date.toLocaleString('default', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

export const toDayKey = (date: Date) =>
  `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;

/** Typical MDVR sheet values that map into the standard remark categories below. */
export const STANDARD_ALERT_TYPES = [
  'Distraction-A2',
  'Eye Closing-A2',
  'Yawning-A2',
  'OverSpeed',
  'Harsh Acceleration',
  'Harsh Brake',
] as const;

/** Canonical remark categories (Songdee standard). */
export const STANDARD_REMARK_TARGETS = [
  'Fatigue',
  'Yawning',
  'Distraction',
  'Mobile Phone',
  'Eating/Drinking',
  'Smoking',
  'Harsh Brake',
  'Harsh Acceleration',
  'Overspeed',
] as const;

export const ALLOWED_ALERT_TYPES = [...STANDARD_ALERT_TYPES];

export const ALLOWED_REMARK_TARGETS = [...STANDARD_REMARK_TARGETS];

/** Substring-style match between a derived remark and an allowed target (both normalized). */
export const remarkMatchesAllowedTarget = (normalizedRemark: string, normalizedTarget: string) =>
  normalizedRemark.includes(normalizedTarget) || normalizedTarget.includes(normalizedRemark);

/**
 * Stable color assignment for canonical remark labels. The same label always
 * gets the same chart color across every dashboard (donut, timeline chip,
 * video chip, etc.) regardless of the data's frequency order.
 *
 * Labels not in this map fall through to a deterministic hash → palette index.
 */
const REMARK_COLOR_MAP: Record<string, string> = {
  fatigue: '#8B5CF6', // violet
  yawning: '#06B6D4', // cyan
  distraction: '#EF4444', // red
  'mobile phone': '#F59E0B', // amber
  'eating/drinking': '#10B981', // emerald
  smoking: '#6366F1', // indigo
  'harsh brake': '#EC4899', // pink
  'harsh acceleration': '#F97316', // orange
  overspeed: '#3B82F6', // blue
};

const FALLBACK_PALETTE = [
  '#14B8A6', '#EF4444', '#3B82F6', '#F59E0B', '#10B981',
  '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#6366F1',
];

export function colorForRemark(label: string): string {
  const key = normalizeLabel(label);
  if (REMARK_COLOR_MAP[key]) return REMARK_COLOR_MAP[key];
  // Substring match — handles "Mobile Phone-A2", "harsh brake (HB)", etc.
  for (const [canonical, color] of Object.entries(REMARK_COLOR_MAP)) {
    if (key.includes(canonical) || canonical.includes(key)) return color;
  }
  // Stable hash for unknown labels so they don't change between renders.
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length];
}

/**
 * Passthrough normalizer — just trims the raw "Remarks" cell. All classification
 * logic now lives in the AlertRule system (see `DEFAULT_ALERT_RULES` and
 * `applyAlertRules`). Kept as a tiny helper so callers don't need to know about
 * the '—' sentinel.
 */
export const withDerivedRemark = (_alertType: string, remarks: string) => {
  const rawTrimmed = remarks === '—' ? '' : remarks.trim();
  return rawTrimmed || remarks;
};

// ── Alert rules ──────────────────────────────────────────────────────────────

/** A customer-defined rule that tweaks how alert types / remarks are classified. */
export type AlertRule =
  | {
      id: string;
      /** Rename: map a specific alert type from the sheet to a display remark label. */
      type: 'remap_alert_type';
      sourceAlertType: string;
      targetRemark: string;
    }
  | {
      id: string;
      /** Conditional rename: if alert type matches AND raw remark contains substring, map to target. */
      type: 'remap_alert_type_if_remark_contains';
      sourceAlertType: string;
      remarkContains: string;
      targetRemark: string;
    }
  | {
      id: string;
      /** Normalize: rename one remark spelling/variation to a canonical label. */
      type: 'remap_remark';
      sourceRemark: string;
      targetRemark: string;
    }
  | {
      id: string;
      /** Always exclude: permanently hide all events of a specific alert type. */
      type: 'always_exclude';
      alertType: string;
    }
  | {
      id: string;
      /** False alert by speed: hide events where remark matches AND speed is below threshold. */
      type: 'false_alert_speed';
      remark: string;
      maxSpeed: number;
    };

/**
 * System defaults: baked-in classification that used to live in `withDerivedRemark`.
 * Prepended to every `applyAlertRules` invocation so the same transforms fire for
 * every dashboard by default. Admins can override with their own rules (dashboard /
 * company level) since user rules run after defaults and can remap the result.
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  // Alert-type renames (unconditional). Fire even with a blank Remarks cell
  // so every row gets a usable remark label. Targets match the restored
  // suffixed labels in dashboard `remarks` configs for harsh events.
  { id: 'default-yawning-a2', type: 'remap_alert_type', sourceAlertType: 'Yawning-A2', targetRemark: 'Yawning' },
  { id: 'default-overspeed', type: 'remap_alert_type', sourceAlertType: 'OverSpeed', targetRemark: 'Overspeed' },
  { id: 'default-distraction-a2', type: 'remap_alert_type', sourceAlertType: 'Distraction-A2', targetRemark: 'Distraction' },
  { id: 'default-harsh-brake', type: 'remap_alert_type', sourceAlertType: 'Harsh Brake', targetRemark: 'Harsh Brake' },
  { id: 'default-harsh-acceleration', type: 'remap_alert_type', sourceAlertType: 'Harsh Acceleration', targetRemark: 'Harsh Acceleration' },

  // Conditional renames for Eye Closing-A2 (alert type + raw remark contains).
  // No unconditional default — MDVR hardware fires Eye Closing-A2 for many root
  // causes (phone, eating, smoking, …) that reviewers annotate in Remarks.
  // Blank/unrecognized Remarks rows drop out of categorized views intentionally.
  { id: 'default-eye-closing-fatigue', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'fatigue', targetRemark: 'Fatigue' },
  { id: 'default-eye-closing-yawning', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'yawning', targetRemark: 'Yawning' },
  { id: 'default-eye-closing-distraction', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'distraction', targetRemark: 'Distraction' },
  { id: 'default-eye-closing-mobile-phone', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'mobile phone', targetRemark: 'Mobile Phone' },
  { id: 'default-eye-closing-phone', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'phone', targetRemark: 'Mobile Phone' },
  { id: 'default-eye-closing-eating', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'eating', targetRemark: 'Eating/Drinking' },
  { id: 'default-eye-closing-drinking', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'drinking', targetRemark: 'Eating/Drinking' },
  { id: 'default-eye-closing-smoking', type: 'remap_alert_type_if_remark_contains', sourceAlertType: 'Eye Closing-A2', remarkContains: 'smoking', targetRemark: 'Smoking' },

  // Normalize remark spellings → canonical Songdee labels (STANDARD_REMARK_TARGETS)
  { id: 'default-norm-fatigue', type: 'remap_remark', sourceRemark: 'fatigue', targetRemark: 'Fatigue' },
  { id: 'default-norm-yawning', type: 'remap_remark', sourceRemark: 'yawning', targetRemark: 'Yawning' },
  { id: 'default-norm-distraction', type: 'remap_remark', sourceRemark: 'distraction', targetRemark: 'Distraction' },
  { id: 'default-norm-mobile-phone', type: 'remap_remark', sourceRemark: 'mobile phone', targetRemark: 'Mobile Phone' },
  { id: 'default-norm-phone', type: 'remap_remark', sourceRemark: 'phone', targetRemark: 'Mobile Phone' },
  { id: 'default-norm-eating', type: 'remap_remark', sourceRemark: 'eating', targetRemark: 'Eating/Drinking' },
  { id: 'default-norm-drinking', type: 'remap_remark', sourceRemark: 'drinking', targetRemark: 'Eating/Drinking' },
  { id: 'default-norm-smoking', type: 'remap_remark', sourceRemark: 'smoking', targetRemark: 'Smoking' },
];

/**
 * Stable content signature for an alert rule — omits `id` so "the same logical rule"
 * on different dashboards/companies compares equal. Used by bulk edit / remove
 * operations that target rules by value rather than by their per-row UUID.
 */
export function alertRuleSignature(rule: AlertRule): string {
  const norm = (s: string) => s.trim().toLowerCase();
  switch (rule.type) {
    case 'remap_alert_type':
      return `remap_alert_type|${norm(rule.sourceAlertType)}|${norm(rule.targetRemark)}`;
    case 'remap_alert_type_if_remark_contains':
      return `remap_alert_type_if_remark_contains|${norm(rule.sourceAlertType)}|${norm(rule.remarkContains)}|${norm(rule.targetRemark)}`;
    case 'remap_remark':
      return `remap_remark|${norm(rule.sourceRemark)}|${norm(rule.targetRemark)}`;
    case 'always_exclude':
      return `always_exclude|${norm(rule.alertType)}`;
    case 'false_alert_speed':
      return `false_alert_speed|${norm(rule.remark)}|${rule.maxSpeed}`;
  }
}

/**
 * Apply alert rules on top of a raw remark. `DEFAULT_ALERT_RULES` run first so
 * built-in Songdee classifications fire for every dashboard; user-supplied rules
 * (dashboard + company) run after and can override the defaults.
 *
 * Rule order: remap_alert_type → remap_alert_type_if_remark_contains → remap_remark
 * → always_exclude → false_alert_speed.
 * Returns the final remark string (may be 'False alert' for exclusion rules).
 */
export function applyAlertRules(
  alertType: string,
  derivedRemark: string,
  speed: number,
  userRules: AlertRule[],
): string {
  // Snapshot the raw derived remark — `remap_alert_type_if_remark_contains`
  // matches against the sheet cell, not the in-progress `remark`.
  const rawRemarkNormalized = normalizeLabel(derivedRemark);
  // User rules run FIRST in every phase so a user's `break` beats a default match.
  // When a user classification rule fires for this alertType, `userSealed` is set
  // so later phases don't let default rules overwrite the user's intent.
  const rules = [...userRules, ...DEFAULT_ALERT_RULES];
  const userRuleSet = new Set<AlertRule>(userRules);
  let remark = derivedRemark;
  let userSealedAlertType = false;

  // 1. Rename alert type → remark label (unconditional)
  for (const rule of rules) {
    if (rule.type === 'remap_alert_type') {
      if (normalizeLabel(alertType) === normalizeLabel(rule.sourceAlertType)) {
        remark = rule.targetRemark;
        if (userRuleSet.has(rule)) userSealedAlertType = true;
        break;
      }
    }
  }

  // 2. Conditional rename: alert type matches + raw remark contains substring
  // Skip default conditional rules if a user rule already claimed this alertType.
  for (const rule of rules) {
    if (rule.type === 'remap_alert_type_if_remark_contains') {
      if (userSealedAlertType && !userRuleSet.has(rule)) continue;
      if (
        normalizeLabel(alertType) === normalizeLabel(rule.sourceAlertType) &&
        rawRemarkNormalized.includes(normalizeLabel(rule.remarkContains))
      ) {
        remark = rule.targetRemark;
        if (userRuleSet.has(rule)) userSealedAlertType = true;
        break;
      }
    }
  }

  // 3. Normalize remark spelling variations
  for (const rule of rules) {
    if (rule.type === 'remap_remark') {
      const nRemark = normalizeLabel(remark);
      const nSource = normalizeLabel(rule.sourceRemark);
      if (nRemark === nSource || nRemark.includes(nSource) || nSource.includes(nRemark)) {
        remark = rule.targetRemark;
        break;
      }
    }
  }

  // 4. Always exclude a specific alert type
  for (const rule of rules) {
    if (rule.type === 'always_exclude') {
      if (normalizeLabel(alertType) === normalizeLabel(rule.alertType)) {
        return 'False alert';
      }
    }
  }

  // 5. False alert by speed
  for (const rule of rules) {
    if (rule.type === 'false_alert_speed') {
      const nRemark = normalizeLabel(remark);
      const nTarget = normalizeLabel(rule.remark);
      // Only exclude on a KNOWN positive speed below the threshold. A missing/non-numeric
      // speed cell arrives here as 0; treating "unknown" as "below threshold" would wrongly
      // hide genuine alerts (fail toward showing the alert).
      if (
        (nRemark.includes(nTarget) || nTarget.includes(nRemark)) &&
        Number.isFinite(speed) && speed > 0 && speed < rule.maxSpeed
      ) {
        return 'False alert';
      }
    }
  }

  return remark;
}

export function resolveTemplate(template: string): string {
  const raw = (template ?? '').trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ');
  if (
    normalized === 'unitdevicestatus' ||
    normalized === 'unit device status' ||
    normalized === 'unit device status dashboard' ||
    normalized === 'alchem unit status' ||
    normalized === 'alchem unit device status'
  ) {
    return 'UnitDeviceStatus';
  }
  if (
    normalized === 'bigthunitstatus' ||
    normalized === 'bigth unit status' ||
    normalized === 'bigth unit status dashboard' ||
    normalized === 'unit status' ||
    normalized === 'unit status dashboard' ||
    normalized === 'nio unit status'
  ) {
    return 'BIGTHUnitStatus';
  }
  if (template === 'OverSpeed') return 'OverSpeed';
  if (normalized === 'vehicle kpi' || normalized === 'vehiclekpi') return 'VehicleKPI';
  if (template === 'DynamicTrip') return 'DynamicTrip';
  return template;
}

export const buildTrendGeometry = (trendData: TrendDatum[], maxTrendValue: number): TrendGeometry => {
  const width = 1200;
  const height = 300;
  const padding = { top: 28, right: 32, bottom: 48, left: 60 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  if (trendData.length === 0) {
    return { points: [], path: '', viewBox: `0 0 ${width} ${height}`, padding, width, height };
  }
  const maxValue = Math.max(1, maxTrendValue);
  const points = trendData.map((item, index) => {
    const x =
      trendData.length === 1
        ? padding.left + plotWidth / 2
        : padding.left + (index / (trendData.length - 1)) * plotWidth;
    const y = padding.top + (1 - item.count / maxValue) * plotHeight;
    return { x, y, count: item.count, label: item.date.toLocaleDateString('en-GB', { timeZone: 'UTC' }) };
  });
  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
  return { points, path, viewBox: `0 0 ${width} ${height}`, padding, width, height };
};

/** Compute nice round Y-axis tick values. Returns { ticks, niceMax }. */
export function computeNiceMax(maxTrendValue: number, tickCount = 4): number {
  const raw = Math.max(1, maxTrendValue);
  const rawInterval = raw / tickCount;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
  const residual = rawInterval / magnitude;
  const niceMultiplier = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  const niceInterval = niceMultiplier * magnitude;
  return Math.ceil(raw / niceInterval) * niceInterval;
}

export const buildYAxisTicks = (maxTrendValue: number, tickCount = 4) => {
  const niceMax = computeNiceMax(maxTrendValue, tickCount);
  const niceInterval = niceMax / tickCount;

  return Array.from({ length: tickCount + 1 }, (_, index) => {
    const value = Math.round(niceMax - index * niceInterval);
    const position = niceMax === 0 ? 0 : 1 - value / niceMax;
    return { value: Math.max(0, value), position };
  });
};

export const buildXAxisLabels = (trendData: TrendDatum[], maxLabels = 6): TrendLabel[] => {
  if (trendData.length === 0) return [];
  const labelCount = Math.min(maxLabels, trendData.length);
  return Array.from({ length: labelCount }, (_, index) => {
    const position = labelCount === 1 ? 0 : index / (labelCount - 1);
    const dataIndex = labelCount === 1 ? 0 : Math.round(position * (trendData.length - 1));
    const item = trendData[dataIndex];
    return {
      label: item.date.toLocaleDateString('en-GB', { timeZone: 'UTC' }),
      position,
    };
  });
};

// Safety score computation
export const computeSafetyScore = (alertCount: number, vehicleCount: number, dayCount: number): number => {
  if (vehicleCount === 0 || dayCount === 0) return 100;
  const alertsPerVehiclePerDay = alertCount / vehicleCount / dayCount;
  const penalty = Math.min(70, alertsPerVehiclePerDay * 70);
  return Math.round(Math.max(0, 100 - penalty));
};

export const computeDriverSafetyScore = (alertCount: number, dayCount: number): number => {
  if (dayCount === 0) return 100;
  const alertsPerDay = alertCount / dayCount;
  const penalty = Math.min(70, alertsPerDay * 35);
  return Math.round(Math.max(0, 100 - penalty));
};

/** Driving safety score for Driving dashboard: violations per trip. */
export const computeComplianceScore = (violationCount: number, tripCount: number): number => {
  if (tripCount === 0) return 100;
  const violationsPerTrip = violationCount / tripCount;
  const penalty = Math.min(70, violationsPerTrip * 70);
  return Math.round(Math.max(0, 100 - penalty));
};

// CSV export helper
export const buildExportRows = (rows: Record<string, unknown>[], columns: string[]) => {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    columns.forEach((col) => {
      out[col] = findValue(row, [col]) ?? '';
    });
    return out;
  });
};

export type ViolationMetric = 'drive_hrs' | 'rest_hrs' | 'cnt_drv_hrs';

export type ComputeViolationKeyArgs = {
  metric: ViolationMetric;
  driver: string;
  vehicle: string;
  eventAtIso: string;
  threshold: number;
};

export function computeViolationKey(args: ComputeViolationKeyArgs): string {
  const payload = [args.metric, args.driver, args.vehicle, args.eventAtIso, String(args.threshold)].join('|');
  return createHash('sha1').update(payload).digest('hex');
}

/**
 * Stable key for a sheet alert row, used to attach manual driver-name
 * overrides. Built from raw (formatted) sheet values so it survives
 * re-fetches, row insertions, and re-sorting of the sheet.
 */
export function computeAlertKey(args: {
  vehicle: string;
  /** Raw/formatted time cell value from the sheet (not a locally parsed Date). */
  timeRaw: string;
  alertType: string;
}): string {
  const payload = [args.vehicle, args.timeRaw, args.alertType].join('|');
  return createHash('sha1').update(payload).digest('hex');
}

export type ViolationRow = {
  /** Sheet SlNo (column A). Blank for aggregated drive-hours rows spanning >1 shift. */
  slNo: string;
  driver: string;
  vehicle: string;
  vehicleCount: number;
  shiftCount: number;
  dayKey: string;
  dateLabel: string;
  eventAt: Date;
  driveHours: number;
  restHours: number;
  distanceKm: number;
  loginAt: Date | null;
  logoutAt: Date | null;
  /** Numeric ms timestamp of loginAt (or eventAt) — used as a numeric sort key. */
  _loginAtMs: number;
  loginLocation: string;
  logoutLocation: string;
  metric: ViolationMetric;
  threshold: number;
  thresholdLabel: string;
  violationKey: string;
  warning: { sentAt: Date; channelName: string } | null;
};
