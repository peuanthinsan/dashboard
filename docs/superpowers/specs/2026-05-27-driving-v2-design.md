# Driving v2 — Continuous Drive Dashboard

**Status:** Design approved (2026-05-27)
**Owner:** Songdee Dashboard
**Public label:** "Driving" (this is v2 of the existing template; the template enum value remains `Driving`)
**References:**
- Looker Studio reference: `Srithai - VinyThai Fleet DMS Dashboard Rev.2025` — sub-pages `Continus Driving > 4 hrs`, `Working Hour > 14 hrs`, `Drive Hour > 10 hrs`, `Rest Hour < 10 hrs`
- Customer source sheet shape: `ThongTrans Work and Drive Hours 2 Report` (`docs.google.com/spreadsheets/d/199e-…/edit#gid=0`)

---

## 1. Goal

Evolve the existing `Driving` dashboard template into a multi-threshold compliance view so each customer can:

1. Configure **multiple thresholds per metric** (e.g. Drive Hours > 4 *and* > 10) and see one sub-page per threshold.
2. Audit unique drivers in violation versus drivers already warned, per sub-page.
3. Trigger a real LINE message to a fleet-specific operations group from a row-level button, with per-click channel override.
4. See clock-in / clock-out context on every violation row.
5. Score the fleet using a multi-metric weighted scoring matrix.

The Overview tab preserves today's `DrivingDashboard` body so existing dashboards see no regression on landing.

### 1.1 Metric scope

Two metrics in v2 (Work Hours is intentionally excluded — see §2):

| Metric | Aggregation | Comparison | Violation row identity |
|---|---|---|---|
| **Drive Hours** | sum of `DriveHrs` per `(driver, calendar day)` | daily total `>` threshold | one row per `(driver, day)` |
| **Rest Hours** | per-shift `RestHrs` (no aggregation) | shift `RestHrs > 0` AND `< threshold` | one row per shift |

Drive Hours is **per-day**: even if a driver has three shifts in one day, the dashboard shows one row summing `DriveHrs` across those three shifts. Rest Hours stays **per-shift** because rest is the gap to the next shift — aggregating it would lose meaning.

## 2. Non-goals

- **Work Hours metric (`WorkHrs`) is not surfaced in v2** — no WorkHrs sub-pages, no WorkHrs threshold config, no WorkHrs violations or warnings. The column may still be ingested into `DrivingRow` for the Overview tab's existing KPI ("Total Working Hours" stays for backward compatibility), but no thresholding happens on it.
- A standalone "DrivingV2" template (we extend `Driving` in place).
- Per-driver LINE direct messaging (group send only in v2).
- Editing thresholds from the customer-facing dashboard (admin-only).
- Reading from a second precomputed source like ThongTrans's `RESTHOURFINAL` tab (Rest Hours reads from the raw shift tab in v2; a per-dashboard "Rest Hours source gid" override can land later if customers ask).
- Per-event LINE token override (the channel is selected at send time; the token belongs to that channel).

## 3. Architecture overview

```
                ┌────────────────────────────────────────────┐
                │  /dashboard/{publicId}?tab={slug}          │
                │   ↓ Server component (auth + dashboard)    │
                │   ↓ Loads:                                 │
                │     • Dashboard (incl. drivingThresholds,  │
                │       lineChannelId, sheetGid)             │
                │     • Organization                          │
                │     • All LineChannels of that org          │
                │     • DrivingWarnings for the date filter   │
                │   ↓ Renders <DrivingDashboard>             │
                └────────────────────────────────────────────┘
                                  │
                          ┌───────┼─────────────────────┐
                          │       │                     │
              ┌───────────▼──┐  ┌─▼──────────────────┐ ┌▼────────────────┐
              │ Overview tab │  │ Threshold sub-page │ │ Send-warning    │
              │ (v1 body 1:1)│  │ <ThresholdSubPage> │ │ popover         │
              └──────────────┘  └────────────────────┘ └──┬──────────────┘
                                                          │
                                          'use server'    │ sendDrivingWarning
                                                          ▼
                              ┌───────────────────────────────────────────┐
                              │  1. authz check (user can access dashboard)│
                              │  2. assert lineChannel ∈ dashboard.org     │
                              │  3. INSERT DrivingWarning (pending) w/    │
                              │     ON CONFLICT (dashboardId, violationKey)│
                              │  4. pgp_sym_decrypt(accessToken)           │
                              │  5. POST https://api.line.me/v2/bot/...    │
                              │  6. UPDATE status sent/failed              │
                              └───────────────────────────────────────────┘
```

All sub-pages share one sheet load — two parallel `useGoogleSheet` hooks (one per gid: raw shift tab) feed a memoized `DrivingRow[]` that the active sub-page filters.

## 4. Data model

### 4.1 Schema changes (Drizzle migration)

**Migration `20260527_driving_v2`:**

```sql
-- pgcrypto for LINE token encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- LineChannel: many per Organization (fleet); each is one LINE Messaging channel + target group
CREATE TABLE "LineChannel" (
  id              serial PRIMARY KEY,
  "organizationId" integer NOT NULL REFERENCES "Organization"(id) ON DELETE CASCADE,
  name            varchar(64) NOT NULL,
  "accessToken"   text NOT NULL,         -- ciphertext from pgp_sym_encrypt
  "groupId"       varchar(64) NOT NULL,  -- LINE groupId / roomId / userId
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "LineChannel_organizationId_idx" ON "LineChannel"("organizationId");

-- Dashboard: default LINE channel + (already-present) drivingThresholds widened in app code
ALTER TABLE "Dashboard"
  ADD COLUMN "lineChannelId" integer NULL
    REFERENCES "LineChannel"(id) ON DELETE SET NULL;
CREATE INDEX "Dashboard_lineChannelId_idx" ON "Dashboard"("lineChannelId");

-- DrivingWarning: per-violation-row warning state, idempotent by violationKey
CREATE TABLE "DrivingWarning" (
  id               serial PRIMARY KEY,
  "dashboardId"    integer NOT NULL REFERENCES "Dashboard"(id) ON DELETE CASCADE,
  "violationKey"   varchar(64) NOT NULL,
  "driverName"     varchar(128) NOT NULL,
  "vehicleNo"      varchar(64)  NOT NULL,
  "eventAt"        timestamptz  NOT NULL,
  metric           varchar(16)  NOT NULL CHECK (metric IN ('drive_hrs','rest_hrs')),
  threshold        numeric      NOT NULL,
  "valueHours"     numeric      NOT NULL,
  "distanceKm"     numeric      NULL,
  "loginAt"        timestamptz  NULL,
  "logoutAt"       timestamptz  NULL,
  "loginLocation"  varchar(256) NULL,
  "logoutLocation" varchar(256) NULL,
  "lineChannelId"  integer      NULL REFERENCES "LineChannel"(id) ON DELETE SET NULL,
  "sentByUserId"   integer      NOT NULL REFERENCES "User"(id),
  "sentAt"         timestamptz  NULL,
  "lineMessageId"  varchar(64)  NULL,
  "lineStatus"     varchar(16)  NOT NULL CHECK ("lineStatus" IN ('pending','sent','failed')),
  "errorMessage"   text         NULL,
  "operatorNote"   varchar(500) NULL,
  "createdAt"      timestamptz  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "DrivingWarning_dashboard_key_unique"
  ON "DrivingWarning"("dashboardId","violationKey");
CREATE INDEX "DrivingWarning_dashboard_sentAt_idx"
  ON "DrivingWarning"("dashboardId","sentAt");
```

The existing `Dashboard.drivingThresholds` JSONB column is reused — only the in-memory shape changes (legacy scalar shape is normalized on read; new writes use the array shape). No SQL DDL needed for the threshold widening.

### 4.2 TypeScript types

`app/dashboards/drivingThresholds.ts` becomes:

```ts
export type DrivingThresholdEntry =
  | number
  | { value: number; label?: string };

export type DrivingThresholds = {
  driveHours: DrivingThresholdEntry[]; // > h, applied to per-day SUM(DriveHrs)
  restHours:  DrivingThresholdEntry[]; // < h, applied per-shift
};

export const DEFAULT_DRIVING_THRESHOLDS: DrivingThresholds = {
  driveHours: [10],
  restHours: [10],
};

export function normalizeDrivingThresholds(raw: unknown): DrivingThresholds;
// - Accepts legacy scalar shape { continuousDrivingMaxHours, workingHoursMax, restMinimumHours }:
//     continuousDrivingMaxHours → driveHours: [{ value, label: 'Cnt Drv > {value} h' }]
//     restMinimumHours          → restHours: [{ value }]
//     workingHoursMax           → IGNORED (Work Hours dropped in v2; see §2)
// - Accepts already-widened shape and validates each entry is a positive number
//   (or { value: positive number, label?: string }).
// - Rejects/coerces invalid entries to defaults.
// - Silently drops any `workHours` key from the input for forward compatibility with
//   data already written under the older v2 draft.

export function parseDrivingThresholdsFromFormData(fd: FormData): DrivingThresholds;
// Reads hidden field 'drivingThresholdsJson' (admin chip-input serializes to JSON).
// Zod-validates: at most 5 entries per metric, each value > 0 and ≤ 24, optional label ≤ 32 chars.

export function thresholdEntryValue(e: DrivingThresholdEntry): number;
export function thresholdEntryLabel(e: DrivingThresholdEntry, fallback: string): string;
```

`app/db-schema.ts` `dashboards.drivingThresholds` type annotation widens to `DrivingThresholds`.

`app/dashboards/dashboardDataUtils.ts` adds a violation row type. A single shape covers both metrics — fields that don't apply to a per-day Drive Hours row are nullable.

```ts
export type ViolationMetric = 'drive_hrs' | 'rest_hrs';

export type ViolationRow = {
  driver: string;
  vehicle: string;                  // for drive_hrs: '*' if multiple vehicles in the day, else the single vehicle
  vehicleCount: number;             // for drive_hrs: number of distinct vehicles in the day; for rest_hrs: always 1
  shiftCount: number;               // for drive_hrs: number of shifts aggregated; for rest_hrs: 1
  dayKey: string;                   // YYYY-MM-DD; identity for drive_hrs, derived from shift for rest_hrs
  dateLabel: string;                // formatted GB date
  eventAt: Date;                    // for drive_hrs: dayKey at 00:00 local; for rest_hrs: shift's Login Time
  driveHours: number;               // for drive_hrs: SUM across the day; for rest_hrs: that shift's DriveHrs
  restHours: number;                // 0 for drive_hrs rows; the shift's RestHrs for rest_hrs rows
  distanceKm: number;               // SUM across the day for drive_hrs; that shift's Distance for rest_hrs
  loginAt: Date | null;             // earliest Login Time of the day (drive_hrs) or the shift's Login (rest_hrs)
  logoutAt: Date | null;            // latest Logout Time of the day (drive_hrs) or the shift's Logout (rest_hrs)
  loginLocation: string;            // earliest-shift's loginLocation (drive_hrs) or shift's (rest_hrs)
  logoutLocation: string;           // latest-shift's logoutLocation (drive_hrs) or shift's (rest_hrs)
  metric: ViolationMetric;
  threshold: number;
  thresholdLabel: string;
  violationKey: string;             // see computeViolationKey
  warning: { sentAt: Date; channelName: string } | null;
};

export function computeViolationKey(args:
  | { metric: 'drive_hrs'; driver: string; dayKey: string; threshold: number }
  | { metric: 'rest_hrs';  driver: string; vehicle: string; eventAtIso: string; threshold: number }
): string;
// drive_hrs key:  sha1('drive_hrs' | driver | dayKey | threshold)
//   (vehicle excluded so multi-vehicle days don't double-create the same violation)
// rest_hrs key:   sha1('rest_hrs'  | driver | vehicle | eventAtIso | threshold)
```

## 5. Routing and sub-page derivation

Single route per dashboard: `/dashboard/{publicId}?tab={slug}`. No new Next.js routes.

`<DrivingDashboard>` (client) derives the tab list from the threshold arrays:

```ts
type SubPage =
  | { kind: 'overview'; slug: 'overview'; label: string }
  | { kind: 'drive_hrs'; slug: `drive-hrs-${number}`; threshold: number; label: string }
  | { kind: 'rest_hrs';  slug: `rest-hrs-${number}`;  threshold: number; label: string };

function deriveSubPages(t: DrivingThresholds, lang: DashboardLang): SubPage[] {
  const overview: SubPage = { kind: 'overview', slug: 'overview',
    label: lang === 'th' ? 'ภาพรวม' : 'Overview' };
  const drive = sortAsc(t.driveHours).map((e) => ({
    kind: 'drive_hrs' as const,
    slug: `drive-hrs-${thresholdEntryValue(e)}` as const,
    threshold: thresholdEntryValue(e),
    label: thresholdEntryLabel(e,
      `${lang === 'th' ? 'ขับรถ/วัน' : 'Drive Hr/day'} > ${thresholdEntryValue(e)} h`),
  }));
  const rest = sortAsc(t.restHours).map((e) => ({
    kind: 'rest_hrs' as const,
    slug: `rest-hrs-${thresholdEntryValue(e)}` as const,
    threshold: thresholdEntryValue(e),
    label: thresholdEntryLabel(e,
      `${lang === 'th' ? 'พัก' : 'Rest Hr'} < ${thresholdEntryValue(e)} h`),
  }));
  return [overview, ...drive, ...rest];
}
```

Active tab via `useSearchParams().get('tab')`. Tab switches use `router.replace(?tab=...)` (no scroll jump, preserves filter state).

## 6. Data ingestion + filtering

### 6.1 Sheet read

`<DrivingDashboard>` calls `useGoogleSheet({ sheetId, gid: sheetGid })` once (existing single-gid model is sufficient; see §6.3). The parsed `DrivingRow[]` is memoized and shared across all sub-pages.

`DrivingRow` extends today's shape with:

```ts
type DrivingRow = {
  sourceRow: Record<string, unknown>;
  driver: string;
  vehicle: string;
  date: Date | null;          // from Login Time / DateTime
  loginAt: Date | null;       // Login Time
  logoutAt: Date | null;      // Logout Time
  loginLocation: string;      // Login Location
  logoutLocation: string;     // Logout Location
  driveHours: number;         // DriveHrs (or DriveHrs duration)
  workingHours: number;       // WorkHrs (ingested for Overview KPI only; not thresholded in v2)
  restHours: number;          // RestHrs
  distanceKm: number;         // Distance
  status: string;             // Status ('COMPLETED' | ...)
  fleet: string;              // Fleet / Login Location, normalized via existing fleet logic
};
```

### 6.2 Per-sub-page filtering and aggregation

**Drive Hours sub-page (threshold T) — per-day aggregation:**

1. Take all `DrivingRow` where `status === 'COMPLETED'` AND `loginAt != null` AND fleet matches dashboard org.
2. Bucket by `(driver, dayKey)` where `dayKey = toDayKey(loginAt)` (the existing `toDayKey` helper in `dashboardDataUtils`).
3. For each bucket compute:
    - `sumDriveHours = Σ shift.driveHours`
    - `sumDistance = Σ shift.distanceKm`
    - `loginAt = min(shifts.loginAt)`
    - `logoutAt = max(shifts.logoutAt)`
    - `loginLocation = shift with min loginAt → loginLocation`
    - `logoutLocation = shift with max logoutAt → logoutLocation`
    - `vehicleCount = |distinct shift.vehicle|`
    - `vehicle = vehicleCount === 1 ? that vehicle : '*'` (UI shows "3 vehicles" tooltip)
    - `shiftCount = shifts.length`
4. Emit one `ViolationRow` (metric `'drive_hrs'`) per bucket where `sumDriveHours > T`.

**Rest Hours sub-page (threshold T) — per-shift:**

For each `DrivingRow` where `status === 'COMPLETED'` AND `restHours > 0` AND `restHours < T` AND fleet matches dashboard org, emit one `ViolationRow` (metric `'rest_hrs'`) mirroring the shift's fields (`shiftCount=1`, `vehicleCount=1`, `dayKey = toDayKey(loginAt)`).

Date / driver / vehicle filters from the shared `FilterBar` apply **before** the bucketing step for Drive Hours (so filtering by vehicle still works even though Drive Hours emits at the day level — a row is included if any of its shifts pass the vehicle filter). Date filter applies to `loginAt` for both metrics.

### 6.3 Why one gid is enough

ThongTrans's `ContDrv>4` and `Workhour>8` tabs share the same schema and (during inspection) the same rows. Both tabs expose `WorkHrs`, `DriveHrs`, `RestHrs`, `Status`, `Distance`, `Login Time`, `Logout Time`. So one tab suffices for both Drive Hours and Rest Hours sub-pages. The dashboard admin picks one raw-shift tab as the source via the existing `sheetGid` field. No new gid columns required.

`RESTHOURFINAL` is explicitly out of scope per §2 (Rest Hours reads from the raw shift tab).

### 6.4 Cnt Drv vs Drive Hours

Cnt Drv and Drive Hours are merged into a single **`driveHours`** metric. A customer who wants both Cnt Drv > 4 h and Drive Hr > 10 h configures `driveHours: [{value: 4, label: 'Cnt Drv > 4 h'}, {value: 10, label: 'Drive Hr > 10 h'}]`. Both sub-pages read from the same `DriveHrs` column with different thresholds.

This decision is grounded in the reference customer's sheet, which exposes only one drive-hours column. If a future customer's sheet exposes a distinct `Cnt Drv Hr` column, the `DriveHrs` lookup in `parseDriveHours` can be extended to prefer it for low-threshold entries — but that is YAGNI today.

## 7. UI composition

### 7.1 `DashboardShell` additions

A horizontal tab strip sits below the existing header, sticky on scroll:

```
[ Overview ] [ Drive Hr/day > 4 h ] [ Drive Hr/day > 10 h ] [ Rest Hr < 10 h ]
```

Each tab is a `next/link` `<Link replace>` with `href={?tab=<slug>}` that preserves all other query params via `useSearchParams()`. `replace` (not `push`) avoids polluting the browser history with every tab click. Active tab gets the existing red accent.

### 7.2 Overview tab

Unchanged from today's `DrivingDashboard` body:
- KPI strip: Total Trips · Total Distance · Total Drive Hours · Total Rest Hours.
- Donuts: Trips-by-driver, Distance-by-vehicle, Drive-hours-by-driver.
- Monthly trend chart (drive duration + distance, multi-line).
- Driver leaderboard table.
- Vehicle aggregates table.
- Existing per-type violation summary (now linked to the new sub-pages).

### 7.3 Threshold sub-page (one component handles all three metrics)

Component: `<ThresholdSubPage>` in `app/dashboards/ThresholdSubPage.tsx`.

```tsx
export type LineChannelOption = {
  id: number;
  name: string;
};

type ThresholdSubPageProps = {
  metric: ViolationMetric;
  threshold: number;
  thresholdLabel: string;
  comparator: '>' | '<';
  rows: DrivingRow[];            // already shared-filtered (org, date, driver, vehicle)
  warnings: Map<string, { sentAt: Date; channelName: string }>; // by violationKey
  lineChannels: LineChannelOption[];
  defaultLineChannelId: number | null;
  dashboardId: string;
  dashboardName: string;
  lang: DashboardLang;
  canWarn: boolean;              // false if no channels configured for this fleet
};
```

Layout:

1. Sub-page header chip: `[icon] {metricLabel} {comparator} {threshold} h · {violationCount} rows · {dateRangeLabel}`.
2. Two KPI cards using `<KpiCard>` (existing):
   - **Orange** — unique violating drivers in the current filter (`new Set(violations.map(v => v.driver)).size`). Tooltip explains the threshold.
   - **Green** — unique drivers with at least one warned row in the current filter (`new Set(violations.filter(v => v.warning).map(v => v.driver)).size`). Tooltip lists the channels used.
3. **Dual-axis line chart** using `<TrendChart mode="dual-axis">`:
   - X-axis: day or month based on date span (auto: monthly if > 60 days, daily otherwise).
   - Series 1 (left axis, bar): for Drive Hours, sum of violating-day totals (already daily); for Rest Hours, sum of the shifts' `RestHrs` violating on that day.
   - Series 2 (right axis, line): sum of distance (km) across the violating rows in that day/month bucket.
4. **Violations table** using `<DataTable>` with `pageSize={15}`:

   For **Drive Hours sub-pages** (one row per `(driver, day)`):
   - Columns (sortable): No., Driver, Day (`DD/MM/YYYY`), Vehicle (`*` + tooltip "3 vehicles" when `vehicleCount > 1`), Shifts (`shiftCount`), First Login (clock-in), Last Logout (clock-out), Login Loc, Logout Loc, Total Drive Hrs, Total Distance (km), Status, [Send warning].
   - Sort default: Total Drive Hrs DESC.

   For **Rest Hours sub-pages** (one row per shift):
   - Columns (sortable): No., Driver, Vehicle, Date, Login (clock-in), Logout (clock-out), Login Loc, Logout Loc, Rest Hrs, Distance (km), Status, [Send warning].
   - Sort default: Rest Hrs ASC (worst rest first).

   `Status` cell: `Warned ✓ {channelName} · {time}` if `row.warning`, else `—`.
   Action cell: `<SendWarningButton row={row} … />` — disabled if `!canWarn` with tooltip "LINE not configured for this fleet".

### 7.4 Send-warning popover

`<SendWarningButton>` renders a button that opens a `<SendWarningPopover>` (small floating panel, anchored to the button):

- **Channel dropdown** — populated from `lineChannels` (sorted by name, default = `defaultLineChannelId` or first).
- **Auto-built message preview** — read-only `<pre>` with the Thai/English message body (see §8.2 for template).
- **Operator note** — `<textarea maxLength={500}>` optional; if non-empty, appended to the message body.
- **Cancel / Send** buttons. Send disabled while a `useActionState` is `pending`.

On send success, the popover closes and the row's status cell flips to "Warned ✓".
On send failure, the popover stays open showing the error and "Retry" / "Cancel".

### 7.5 i18n additions

`app/dashboard/i18n-copy.ts` gains keys:

```ts
drivingV2: {
  tabOverview, tabDriveHrs, tabRestHrs,
  // Drive Hours sub-page labels include the "/day" suffix to make per-day aggregation explicit.
  kpiViolatingDrivers, kpiWarnedDrivers,
  tableLoginAt, tableLogoutAt, tableLoginLoc, tableLogoutLoc,
  tableContDrvStart, tableDuration, tableDistance,
  tableStatusSent, tableStatusNone,
  warnButton, warnSent, warnRetry,
  popoverTitle, popoverChannel, popoverNote, popoverCancel, popoverSend,
  popoverErrorGeneric, popoverErrorNoChannels,
  scoreGradeA, scoreGradeB, scoreGradeC, scoreGradeD, scoreGradeF,
}
```

Both `en` and `th` strings supplied (Thai is the default in the existing codebase).

## 8. Send-warning server action

### 8.1 Action signature

`app/dashboards/drivingWarnings.ts`:

```ts
'use server';

import { z } from 'zod';

const Input = z.object({
  dashboardPublicId: z.string().uuid(),
  lineChannelId: z.number().int().positive(),
  violation: z.discriminatedUnion('metric', [
    z.object({
      metric: z.literal('drive_hrs'),
      driver: z.string().min(1).max(128),
      dayKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      vehicleSummary: z.string().min(1).max(64),    // '*' or single vehicle id
      vehicleCount: z.number().int().min(1),
      shiftCount: z.number().int().min(1),
      threshold: z.number().positive().max(24),
      valueHours: z.number().min(0).max(48),         // daily total can plausibly reach ~24
      distanceKm: z.number().min(0).max(10_000).nullable(),
      firstLoginAt: z.string().datetime().nullable(),
      lastLogoutAt: z.string().datetime().nullable(),
      firstLoginLocation: z.string().max(256).nullable(),
      lastLogoutLocation: z.string().max(256).nullable(),
    }),
    z.object({
      metric: z.literal('rest_hrs'),
      driver: z.string().min(1).max(128),
      vehicle: z.string().min(1).max(64),
      eventAt: z.string().datetime(),
      threshold: z.number().positive().max(24),
      valueHours: z.number().min(0).max(48),
      distanceKm: z.number().min(0).max(10_000).nullable(),
      loginAt: z.string().datetime().nullable(),
      logoutAt: z.string().datetime().nullable(),
      loginLocation: z.string().max(256).nullable(),
      logoutLocation: z.string().max(256).nullable(),
    }),
  ]),
  operatorNote: z.string().max(500).optional(),
});

export type SendDrivingWarningState =
  | { status: 'idle' }
  | { status: 'success'; warningId: number; sentAt: string; channelName: string }
  | { status: 'error'; message: string; code: 'unauth' | 'forbidden' | 'no-channel' | 'channel-mismatch' | 'line-api' | 'timeout' | 'already-sent' | 'invalid-input' };

export async function sendDrivingWarning(
  _prev: SendDrivingWarningState,
  formData: FormData,
): Promise<SendDrivingWarningState>;
```

### 8.2 Message template

Two templates: one for per-day Drive Hours violations, one for per-shift Rest Hours violations.

**Drive Hours (per-day) — Thai default:**

```
⚠ ขับรถเกิน {threshold} ชม./วัน
คนขับ: {driver}
วันที่: {dayKey}
รวมชั่วโมงขับ: {valueHours} ชม. (เกิน {threshold} ชม.)
จำนวนกะ: {shiftCount}  ·  รถ: {vehicleSummary}
เริ่มกะแรก: {firstLoginAt} ({firstLoginLocation})
จบกะสุดท้าย: {lastLogoutAt} ({lastLogoutLocation})
ระยะทางรวม: {distanceKm} กม.
[ หมายเหตุ: {operatorNote} ]
— แดชบอร์ด {dashboardName}
```

**Drive Hours (per-day) — English fallback:**

```
⚠ Drive Hours > {threshold} h/day
Driver: {driver}
Date: {dayKey}
Total drive hours: {valueHours} h (over {threshold} h)
Shifts: {shiftCount}  ·  Vehicle: {vehicleSummary}
First shift start: {firstLoginAt} ({firstLoginLocation})
Last shift end:    {lastLogoutAt} ({lastLogoutLocation})
Total distance: {distanceKm} km
[ Note: {operatorNote} ]
— Dashboard {dashboardName}
```

**Rest Hours (per-shift) — Thai default:**

```
⚠ พักน้อยกว่า {threshold} ชม.
คนขับ: {driver}
รถ: {vehicle}
ชั่วโมงพัก: {valueHours} ชม. (ต่ำกว่า {threshold} ชม.)
เริ่มกะ: {loginAt} ({loginLocation})
จบกะ: {logoutAt} ({logoutLocation})
ระยะทาง: {distanceKm} กม.
[ หมายเหตุ: {operatorNote} ]
— แดชบอร์ด {dashboardName}
```

**Rest Hours (per-shift) — English fallback:**

```
⚠ Rest Hours < {threshold} h
Driver: {driver}
Vehicle: {vehicle}
Rest hours: {valueHours} h (under {threshold} h)
Shift start: {loginAt} ({loginLocation})
Shift end:   {logoutAt} ({logoutLocation})
Distance: {distanceKm} km
[ Note: {operatorNote} ]
— Dashboard {dashboardName}
```

`vehicleSummary` rendering: a single vehicle id when `vehicleCount === 1`, otherwise `"{vehicleCount} vehicles"` (en) / `"{vehicleCount} คัน"` (th).

### 8.3 Flow (numbered for the executor)

1. `auth()` → if no session, return `{ status: 'error', code: 'unauth', message: 'Sign in required.' }`.
2. Parse `formData` against `Input`; on failure return `code: 'invalid-input'`.
3. Look up the dashboard by `publicId`. If the user is not admin and `dashboard.companyId` is not in `user.companyIds` (or `organizationId` not in `user.organizationIds` when set), return `code: 'forbidden'`.
4. Look up `lineChannelId`. If `LineChannel.organizationId !== dashboard.organizationId`, return `code: 'channel-mismatch'`.
5. Compute `violationKey = computeViolationKey(violation)`. For `drive_hrs`, vehicle is not part of the key (one (driver, day) is one violation regardless of vehicle count). For `rest_hrs`, vehicle and eventAt ISO are part of the key.
6. `INSERT INTO "DrivingWarning"(…, lineStatus='pending', sentByUserId=user.id) ON CONFLICT ("dashboardId", "violationKey") DO NOTHING RETURNING id`. If no `id` returned, the warning already exists — fetch the existing row's `sentAt` and `lineChannelId`, return `code: 'already-sent'` with success-shaped payload so the UI still shows the green badge. For `drive_hrs`, `eventAt` is stored as `dayKey || 'T00:00:00Z'` so the unique key + sort ordering are stable.
7. Decrypt the channel's token: `SELECT pgp_sym_decrypt("accessToken"::bytea, $LINE_TOKEN_ENC_KEY) AS token, "groupId" FROM "LineChannel" WHERE id=$1`.
8. Build the message body per §8.2, picking the metric-specific template (`drive_hrs` template uses `firstLoginAt`/`lastLogoutAt`/`vehicleSummary`; `rest_hrs` template uses single-shift fields).
9. `fetch('https://api.line.me/v2/bot/message/push', { method: 'POST', signal: AbortSignal.timeout(5000), headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: body }] }) })`.
10. On `response.ok`: `UPDATE "DrivingWarning" SET "lineStatus"='sent', "sentAt"=now(), "lineMessageId"=$messageId WHERE id=$insertId` and return success.
11. On non-2xx or timeout: `UPDATE … SET "lineStatus"='failed', "errorMessage"=$short`; return `code: 'line-api'` or `code: 'timeout'` with the short message. UI lets operator retry — retrying reuses the same `violationKey`, which triggers the `already-sent` path on row 6, so we additionally `UPDATE … SET "lineStatus"='pending'` before retrying. The cleanest implementation is to always do `INSERT … ON CONFLICT … DO UPDATE SET "lineStatus"='pending', "errorMessage"=NULL` in step 6, which makes retry idempotent.
12. After success, call `revalidatePath('/dashboard/' + publicId)` so a hard reload shows the latest warning state. (Soft refresh via `router.refresh()` on the client is also triggered.)

### 8.4 Rate limit

Per-`lineChannelId` in-memory token bucket: 60 sends / minute / channel / function instance. On exceed → `code: 'line-api'` with message "Too many warnings in a short window, please slow down." Best-effort (multi-instance instances are independent); fine for v2.

### 8.5 LINE API surface

We only use `POST /v2/bot/message/push`. Each channel maintains its own access token (a LINE Messaging API channel token from a fleet's own LINE Developer console). Songdee operates no central LINE channel.

Spec env var `LINE_TOKEN_ENC_KEY` is a 32-byte random secret (generate with `openssl rand -hex 32`) added to Vercel envs (Production, Preview, Development) via `vercel env add LINE_TOKEN_ENC_KEY`. Per `AGENTS.md`, secrets live in Vercel Env Variables, not in `NEXT_PUBLIC_*`. Local development reads the value from `.env.local` after `vercel env pull`. Rotation procedure: write new key to env, re-encrypt all existing rows via a one-off `scripts/rotate-line-token-enc.ts` script that `SELECT pgp_sym_decrypt(...,'old')` and `UPDATE … SET accessToken = pgp_sym_encrypt(..., 'new')` in a transaction.

### 8.6 Warning lookup helper

```ts
export async function getWarningsForDashboard(
  dashboardId: number,
  windowStart: Date | null,    // null = no lower bound
  windowEnd: Date | null,      // null = no upper bound
): Promise<Map<string, { sentAt: Date; channelName: string; status: 'sent' | 'pending' | 'failed' }>>;
// SELECT joins DrivingWarning with LineChannel by lineChannelId; filters where lineStatus = 'sent'
// AND sentAt BETWEEN window. Map key = violationKey. Used to hydrate ThresholdSubPage.warnings.
```

Called server-side in `app/dashboard/[id]/page.tsx` after the dashboard is resolved, using a wide window (the active month or the past 90 days, whichever is larger) so the client can compute the per-sub-page filtered count without an extra round trip.

## 9. Admin UI

### 9.1 `DrivingThresholdAdminFields` — chip-input editor

Replaces today's three number inputs. One row per metric (Drive Hours, Rest Hours — Work Hours intentionally removed per §2). Each row:

- Chip list (each chip = `{ value, label? }`, "✕" to remove).
- "Add" button opens a tiny popover: numeric input (0.5 step, min 0.5, max 24) + optional label input (max 32 chars).
- Hidden `<input type="hidden" name="drivingThresholdsJson">` with the JSON-serialized `DrivingThresholds` (parsed by `parseDrivingThresholdsFromFormData`).
- Limit: ≤ 5 entries per metric, validated client-side and server-side.

### 9.2 `/admin/line-channels` — new page

Files:
- `app/admin/line-channels/page.tsx` — server component, lists channels grouped by Organization.
- `app/admin/line-channels/LineChannelsClient.tsx` — client interactions (create / edit / delete / test).
- `app/admin/line-channels/LineChannelForm.tsx` — controlled form with toggleable "Update token" UI (write-only).

Server actions:
- `createLineChannel({ organizationId, name, groupId, accessToken })`
- `updateLineChannel({ id, name, groupId, accessToken? })`  — if `accessToken` is omitted/empty, only metadata updates.
- `deleteLineChannel({ id })`  — also nulls out `DrivingWarning.lineChannelId` and `Dashboard.lineChannelId` via the FK `ON DELETE SET NULL`.
- `testLineChannel({ id })`  — sends a literal `[Songdee] Test message from <email> · <ISO>` to the channel and returns the LINE response.

Encryption:
- On write: `INSERT/UPDATE … SET "accessToken" = pgp_sym_encrypt($token, $LINE_TOKEN_ENC_KEY)`.
- On read in send path: `SELECT pgp_sym_decrypt("accessToken"::bytea, $LINE_TOKEN_ENC_KEY)`.
- The admin form never reads the token back to the client; "●●●●●●" is shown until "Update token" is toggled.

Admin nav (`app/admin/AdminNav.tsx`) gets a new entry: "LINE channels" → `/admin/line-channels`.

### 9.3 Dashboard form additions

In `DashboardsClient` (and `addDashboardAction` / `manageDashboardAction` server actions):
- A new "Default LINE channel" `<select>` is added near the existing `DrivingThresholdAdminFields`.
- Server actions read `formData.get('lineChannelId')`, validate it belongs to the dashboard's `organizationId` (or is empty), and persist.

### 9.4 Bulk-edit additions

`bulkUpdateDashboardFields` in `app/db-bulk.ts` extends its `Allowed` shape with `drivingThresholds?: DrivingThresholds | null` and `lineChannelId?: number | null`. The bulk-edit modal in `DashboardsClient` shows these controls only when all selected dashboards share `template === 'Driving'` and (for the channel selector) the same `organizationId`.

## 10. Scoring matrix

`app/dashboards/drivingScoring.ts` exports:

```ts
export const METRIC_WEIGHTS = { driveHours: 1.2, restHours: 1.5 } as const;
export const SEVERITY_PENALTY_PER_DAY_MULTIPLIER = 25;

export type DrivingGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type DriverDay = {
  driver: string;
  dayKey: string;
  totalDriveHours: number;   // sum across the day
  shifts: DrivingRow[];      // the day's shifts (for rest evaluation)
};

export function bucketByDriverDay(rows: DrivingRow[]): DriverDay[];
// Bucket COMPLETED shifts by (driver, dayKey).

export function severityForDriverDay(
  day: DriverDay,
  thresholds: DrivingThresholds,
): { drive: 0|1|3; rest: 0|1|3 };
// drive: 0 if totalDriveHours ≤ lowest driveHours threshold;
//        3 if > highest;
//        1 otherwise.
// rest:  evaluate each shift in the day; take the WORST severity in the day:
//        0 if min(restHours where >0) ≥ highest rest threshold (best rest);
//        3 if min(restHours where >0) < lowest threshold;
//        1 otherwise. (Shifts with restHours == 0 are ignored — last shift of day has no next-shift gap.)

export function computeDrivingScore(
  rows: DrivingRow[],         // already COMPLETED only
  thresholds: DrivingThresholds,
): { score: number; grade: DrivingGrade; perMetric: { drive: number; rest: number }; totalDays: number };

export function gradeFromScore(score: number): DrivingGrade;
// 90–100 A, 80–89 B, 65–79 C, 40–64 D, 0–39 F.
```

Formula (day-based, since Drive Hours violations are per-day):

```
days            = bucketByDriverDay(rows)
totalDays       = days.length || 1
weightedPenalty = Σ_days (severity.drive * 1.2 + severity.rest * 1.5)
perDay          = weightedPenalty / totalDays
score           = round(clamp(100 - perDay * 25, 0, 100))
grade           = gradeFromScore(score)
```

This replaces the earlier per-row penalty. Scoring by `(driver, day)` aligns with how Drive Hours are now thresholded — a fleet with no driver having a violating day scores 100; a fleet where every driver-day critically violates both metrics scores `clamp(100 - (3*1.2 + 3*1.5)*25, 0, 100) = 0`.

`computeComplianceScore` (existing) stays for non-Driving dashboards. `DrivingDashboard` calls `computeDrivingScore` instead and writes the result to the existing `saveDashboardScore` cache so the dashboard card displays it.

`DashboardCard` (already template-aware via `template === 'Driving'`) adds the grade letter beside the numeric score: `92 (A — Safe)`.

## 11. Folder & file map

```
app/
  admin/
    AdminNav.tsx                              [modify] add 'LINE channels' link
    line-channels/
      page.tsx                                [new] server component
      LineChannelsClient.tsx                  [new]
      LineChannelForm.tsx                     [new]
      lineChannelActions.ts                   [new] 'use server' (create/update/delete/test)
    dashboards/
      DashboardsClient.tsx                    [modify] threshold chip editor + channel select + bulk
      DrivingThresholdAdminFields.tsx         [modify] becomes chip-input editor
      page.tsx                                [modify] read DrivingThresholds + lineChannelId on save
  api/
    line/
      test-send/route.ts                      [new] admin-only diagnostic endpoint (wraps testLineChannel)
  dashboard/
    [id]/page.tsx                             [modify] load lineChannels + warnings for the date filter
    i18n-copy.ts                              [modify] drivingV2.* keys
  dashboards/
    DrivingDashboard.tsx                      [modify] tab strip + sub-page mounting + per-sub-page filters
    ThresholdSubPage.tsx                      [new] generic sub-page component
    SendWarningButton.tsx                     [new]
    SendWarningPopover.tsx                    [new]
    drivingThresholds.ts                      [modify] new types + parseDrivingThresholdsFromFormData
    drivingScoring.ts                         [new] scoring matrix
    drivingWarnings.ts                        [new] 'use server' sendDrivingWarning + getWarningsForDashboard
    dashboardDataUtils.ts                     [modify] ViolationRow + computeViolationKey
  db-schema.ts                                [modify] LineChannel + DrivingWarning + Dashboard.lineChannelId
  db.ts                                       [modify] CRUD helpers for LineChannel and DrivingWarning
  db-bulk.ts                                  [modify] allow drivingThresholds + lineChannelId in bulk
scripts/
  migrate.ts                                  [no change — drizzle migration files added under drizzle/]
drizzle/
  migrations/                                 [new file generated by drizzle-kit]
docs/superpowers/specs/2026-05-27-driving-v2-design.md  (this file)
docs/superpowers/plans/2026-05-27-driving-v2.md          [to be created by writing-plans]
```

## 12. Acceptance criteria

1. Admin can create a `Driving` dashboard with `driveHours: [4, 10]`, `restHours: [10]`. After save, the dashboard page renders four tabs: Overview · Drive Hr/day > 4 h · Drive Hr/day > 10 h · Rest Hr < 10 h.
2. Legacy dashboards with the old scalar `drivingThresholds` shape render with one Drive Hr/day tab and one Rest Hr tab (Work Hours is silently dropped — no tab, no warning). Old scalar `workingHoursMax` is ignored as documented in §4.2.
3. A driver with three completed shifts on the same day appears as **ONE** row on the Drive Hours sub-page, with `Total Drive Hrs = Σ shift.DriveHrs`, vehicle column showing "*" + tooltip "3 vehicles" if applicable, and first-login / last-logout times.
4. Each threshold sub-page shows orange + green KPI cards, a dual-axis chart, and a violations table with clock-in/out columns. Drive Hours tables sort by Total Drive Hrs DESC; Rest Hours tables sort by Rest Hrs ASC.
5. Clicking "Send warning" with no LineChannel configured for the fleet shows a disabled button with tooltip; clicking with channels available opens a popover with channel dropdown, message preview (per-day template for Drive Hours, per-shift template for Rest Hours), and optional note.
6. Sending posts a real LINE Messaging API push to the chosen group; the row status flips to "Warned ✓ · {channelName}".
7. Sending twice on the same (driver, day) Drive Hours row is a no-op (unique idx + ON CONFLICT); UI shows "Already sent". Same for a Rest Hours shift row.
8. Token rotation / wrong group / network timeout each surface a distinct user-facing error and persist `lineStatus='failed'` for audit. Retry works without producing duplicate rows.
9. `/admin/line-channels` allows admin to CRUD channels per fleet, with the access token write-only and stored encrypted in DB.
10. Bulk-editing dashboards sharing template `Driving` and the same fleet supports setting thresholds + LINE channel at once.
11. `DashboardCard` for a Driving dashboard displays both score and letter grade (e.g. `92 · A`).
12. All new strings exist in both `en` and `th`.
13. Existing Vitest suite passes; new tests cover: `normalizeDrivingThresholds` legacy migration (incl. `workingHoursMax` being ignored), `computeViolationKey` stability (incl. day-key key for drive_hrs ignoring vehicle), `bucketByDriverDay` correctness on multi-shift days, `severityForDriverDay` banding, `computeDrivingScore` formula, `sendDrivingWarning` happy path + each error code (mocking the LINE fetch) for both metric variants.

## 13. Out-of-scope / follow-ups

- **Work Hours thresholding** (dropped in v2; total work hours still shown on Overview).
- Per-driver direct-message LINE (would require driver→LINE userId table; needs onboarding workflow).
- Reading `RESTHOURFINAL`-style precomputed sheets (would need a per-dashboard "Rest Hours source gid" field and a second parser).
- A dedicated "DrivingV2" template entry — we extend `Driving` in place.
- Per-day aggregation of Rest Hours (kept per-shift in v2 since rest is the inter-shift gap, not a daily total).
- Scoring matrix tuning UI for admins (constants are code-level for v2; flip to JSONB if requested).
- LINE Flex Messages (text-only in v2 keeps the parser simple).
- Mobile push notifications.
- Scheduled / batched warnings (only on-click in v2).
