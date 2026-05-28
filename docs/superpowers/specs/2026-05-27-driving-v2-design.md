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

## 2. Non-goals

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
  metric           varchar(16)  NOT NULL CHECK (metric IN ('drive_hrs','work_hrs','rest_hrs')),
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
  driveHours: DrivingThresholdEntry[]; // > h
  workHours: DrivingThresholdEntry[];  // > h
  restHours: DrivingThresholdEntry[];  // < h
};

export const DEFAULT_DRIVING_THRESHOLDS: DrivingThresholds = {
  driveHours: [4],
  workHours: [8],
  restHours: [10],
};

export function normalizeDrivingThresholds(raw: unknown): DrivingThresholds;
// - Accepts legacy scalar shape { continuousDrivingMaxHours, workingHoursMax, restMinimumHours }
//   and widens it to single-element arrays.
// - Accepts already-widened shape and validates each entry is a positive number
//   (or { value: positive number, label?: string }).
// - Rejects/coerces invalid entries to defaults.

export function parseDrivingThresholdsFromFormData(fd: FormData): DrivingThresholds;
// Reads hidden field 'drivingThresholdsJson' (admin chip-input serializes to JSON).
// Zod-validates: at most 5 entries per metric, each value > 0 and ≤ 24, optional label ≤ 32 chars.

export function thresholdEntryValue(e: DrivingThresholdEntry): number;
export function thresholdEntryLabel(e: DrivingThresholdEntry, fallback: string): string;
```

`app/db-schema.ts` `dashboards.drivingThresholds` type annotation widens to `DrivingThresholds`.

`app/dashboards/dashboardDataUtils.ts` adds a violation row type:

```ts
export type ViolationMetric = 'drive_hrs' | 'work_hrs' | 'rest_hrs';

export type ViolationRow = {
  driver: string;
  vehicle: string;
  date: string;               // formatted GB date
  eventAt: Date;
  driveHours: number;
  workingHours: number;
  restHours: number;
  distanceKm: number;
  loginAt: Date | null;
  logoutAt: Date | null;
  loginLocation: string;
  logoutLocation: string;
  metric: ViolationMetric;
  threshold: number;
  thresholdLabel: string;
  violationKey: string;       // sha1 of `${driver}|${vehicle}|${eventAtIso}|${metric}|${threshold}`
  warning: { sentAt: Date; channelName: string } | null;
};

export function computeViolationKey(args: {
  driver: string; vehicle: string; eventAtIso: string;
  metric: ViolationMetric; threshold: number;
}): string;
```

## 5. Routing and sub-page derivation

Single route per dashboard: `/dashboard/{publicId}?tab={slug}`. No new Next.js routes.

`<DrivingDashboard>` (client) derives the tab list from the threshold arrays:

```ts
type SubPage =
  | { kind: 'overview'; slug: 'overview'; label: string }
  | { kind: 'drive_hrs'; slug: `drive-hrs-${number}`; threshold: number; label: string }
  | { kind: 'work_hrs';  slug: `work-hrs-${number}`;  threshold: number; label: string }
  | { kind: 'rest_hrs';  slug: `rest-hrs-${number}`;  threshold: number; label: string };

function deriveSubPages(t: DrivingThresholds, lang: DashboardLang): SubPage[] {
  const overview: SubPage = { kind: 'overview', slug: 'overview',
    label: lang === 'th' ? 'ภาพรวม' : 'Overview' };
  const drive = sortAsc(t.driveHours).map((e) => ({
    kind: 'drive_hrs' as const,
    slug: `drive-hrs-${thresholdEntryValue(e)}` as const,
    threshold: thresholdEntryValue(e),
    label: thresholdEntryLabel(e,
      `${lang === 'th' ? 'ขับรถ' : 'Drive Hr'} > ${thresholdEntryValue(e)} h`),
  }));
  // … same for work_hrs and rest_hrs (rest uses < instead of >) …
  return [overview, ...drive, ...work, ...rest];
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
  workingHours: number;       // WorkHrs
  restHours: number;          // RestHrs
  distanceKm: number;         // Distance
  status: string;             // Status ('COMPLETED' | ...)
  fleet: string;              // Fleet / Login Location, normalized via existing fleet logic
};
```

### 6.2 Per-sub-page row-level filters

| sub-page | filter |
|---|---|
| `drive_hrs` (threshold T) | `status === 'COMPLETED'` AND `driveHours > T` AND `loginAt != null` AND `fleet matches dashboard org` |
| `work_hrs`  (threshold T) | `status === 'COMPLETED'` AND `workingHours > T` |
| `rest_hrs`  (threshold T) | `status === 'COMPLETED'` AND `restHours > 0` AND `restHours < T` |

Date / driver / vehicle filters from the shared `FilterBar` apply on top of these.

### 6.3 Why one gid is enough

ThongTrans's `ContDrv>4` and `Workhour>8` tabs share the same schema and (during inspection) the same rows. Both tabs expose `WorkHrs`, `DriveHrs`, `RestHrs`, `Status`, `Distance`, `Login Time`, `Logout Time`. So one tab suffices for all three sub-page metrics. The dashboard admin picks one raw-shift tab as the source via the existing `sheetGid` field. No new gid columns required.

`RESTHOURFINAL` is explicitly out of scope per §2 (Rest Hours reads from the raw shift tab).

### 6.4 Cnt Drv vs Drive Hours

Cnt Drv and Drive Hours are merged into a single **`driveHours`** metric. A customer who wants both Cnt Drv > 4 h and Drive Hr > 10 h configures `driveHours: [{value: 4, label: 'Cnt Drv > 4 h'}, {value: 10, label: 'Drive Hr > 10 h'}]`. Both sub-pages read from the same `DriveHrs` column with different thresholds.

This decision is grounded in the reference customer's sheet, which exposes only one drive-hours column. If a future customer's sheet exposes a distinct `Cnt Drv Hr` column, the `DriveHrs` lookup in `parseDriveHours` can be extended to prefer it for low-threshold entries — but that is YAGNI today.

## 7. UI composition

### 7.1 `DashboardShell` additions

A horizontal tab strip sits below the existing header, sticky on scroll:

```
[ Overview ] [ Drive Hr > 4 h ] [ Drive Hr > 10 h ] [ Work Hr > 8 h ] [ Rest Hr < 10 h ]
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
   - Series 1 (left axis, bar): sum of the metric's hours across violating rows that day/month.
   - Series 2 (right axis, line): sum of distance (km) across the same rows.
4. **Violations table** using `<DataTable>` with `pageSize={15}`:
   - Columns (sortable): No., Driver, Vehicle, Login (clock-in), Logout (clock-out), Login Loc, Logout Loc, Continuous Drive Start, Duration (h), Distance (km), Status, [Send warning].
   - `Status` cell: `Warned ✓ {channelName} · {time}` if `row.warning`, else `—`.
   - Action cell: `<SendWarningButton row={row} … />` — disabled if `!canWarn` with tooltip "LINE not configured for this fleet".

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
  tabOverview, tabDriveHrs, tabWorkHrs, tabRestHrs,
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
  violation: z.object({
    driver: z.string().min(1).max(128),
    vehicle: z.string().min(1).max(64),
    eventAt: z.string().datetime(),
    metric: z.enum(['drive_hrs', 'work_hrs', 'rest_hrs']),
    threshold: z.number().positive().max(24),
    valueHours: z.number().min(0).max(48),
    distanceKm: z.number().min(0).max(10_000).nullable(),
    loginAt: z.string().datetime().nullable(),
    logoutAt: z.string().datetime().nullable(),
    loginLocation: z.string().max(256).nullable(),
    logoutLocation: z.string().max(256).nullable(),
  }),
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

Thai default (matches the existing dashboards' default `lang === 'th'`):

```
⚠ การฝ่าฝืน {metricLabel}
คนขับ: {driver}
รถ: {vehicle}
ค่าที่วัดได้: {valueHours} ชม. ({comparator} {threshold} ชม.)
เริ่มกะ: {loginAt} ({loginLocation})
จบกะ: {logoutAt} ({logoutLocation})
ระยะทาง: {distanceKm} กม.
[ หมายเหตุ: {operatorNote} ]
— แดชบอร์ด {dashboardName}
```

English fallback (when dashboard `lang === 'en'`):

```
⚠ {metricLabel} violation
Driver: {driver}
Vehicle: {vehicle}
Measured: {valueHours} h ({comparator} {threshold} h)
Shift start: {loginAt} ({loginLocation})
Shift end:   {logoutAt} ({logoutLocation})
Distance: {distanceKm} km
[ Note: {operatorNote} ]
— Dashboard {dashboardName}
```

### 8.3 Flow (numbered for the executor)

1. `auth()` → if no session, return `{ status: 'error', code: 'unauth', message: 'Sign in required.' }`.
2. Parse `formData` against `Input`; on failure return `code: 'invalid-input'`.
3. Look up the dashboard by `publicId`. If the user is not admin and `dashboard.companyId` is not in `user.companyIds` (or `organizationId` not in `user.organizationIds` when set), return `code: 'forbidden'`.
4. Look up `lineChannelId`. If `LineChannel.organizationId !== dashboard.organizationId`, return `code: 'channel-mismatch'`.
5. Compute `violationKey = computeViolationKey(violation)`.
6. `INSERT INTO "DrivingWarning"(…, lineStatus='pending', sentByUserId=user.id) ON CONFLICT ("dashboardId", "violationKey") DO NOTHING RETURNING id`. If no `id` returned, the warning already exists — fetch the existing row's `sentAt` and `lineChannelId`, return `code: 'already-sent'` with success-shaped payload so the UI still shows the green badge.
7. Decrypt the channel's token: `SELECT pgp_sym_decrypt("accessToken"::bytea, $LINE_TOKEN_ENC_KEY) AS token, "groupId" FROM "LineChannel" WHERE id=$1`.
8. Build the message body per §8.2.
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

Replaces today's three number inputs. One row per metric (Drive Hours, Work Hours, Rest Hours). Each row:

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
export const METRIC_WEIGHTS = { driveHours: 1.2, workHours: 1.0, restHours: 1.5 } as const;
export const SEVERITY_PENALTY_PER_SHIFT_MULTIPLIER = 25;

export type DrivingGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export function severityForRow(
  row: DrivingRow,
  thresholds: DrivingThresholds,
): { drive: 0|1|3; work: 0|1|3; rest: 0|1|3 };
// drive: 0 if driveHours ≤ lowest threshold; 3 if > highest; 1 otherwise.
// work : same banding for workingHours.
// rest : 0 if restHours ≥ highest (rest higher = better); 3 if < lowest; 1 otherwise.

export function computeDrivingScore(
  rows: DrivingRow[],   // already COMPLETED only
  thresholds: DrivingThresholds,
): { score: number; grade: DrivingGrade; perMetric: { drive: number; work: number; rest: number } };

export function gradeFromScore(score: number): DrivingGrade;
// 90–100 A, 80–89 B, 65–79 C, 40–64 D, 0–39 F.
```

Formula:

```
totalRows       = rows.length || 1
weightedPenalty = Σ_rows (severityScore.drive*1.2 + severityScore.work*1.0 + severityScore.rest*1.5)
perShift        = weightedPenalty / totalRows
score           = round(clamp(100 - perShift * 25, 0, 100))
grade           = gradeFromScore(score)
```

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

1. Admin can create a `Driving` dashboard with `driveHours: [4, 10]`, `workHours: [8]`, `restHours: [10]`. After save, the dashboard page renders five tabs: Overview · Drive Hr > 4 h · Drive Hr > 10 h · Work Hr > 8 h · Rest Hr < 10 h.
2. Legacy dashboards with the old scalar `drivingThresholds` shape render with one tab per metric and one threshold each (no regression).
3. Each threshold sub-page shows orange + green KPI cards, a dual-axis chart, and a violations table with clock-in/out columns.
4. Clicking "Send warning" with no LineChannel configured for the fleet shows a disabled button with tooltip; clicking with channels available opens a popover with channel dropdown, message preview, and optional note.
5. Sending posts a real LINE Messaging API push to the chosen group; the row status flips to "Warned ✓ · {channelName}".
6. Sending twice on the same row is a no-op (unique idx + ON CONFLICT); UI shows "Already sent".
7. Token rotation / wrong group / network timeout each surface a distinct user-facing error and persist `lineStatus='failed'` for audit. Retry works without producing duplicate rows.
8. `/admin/line-channels` allows admin to CRUD channels per fleet, with the access token write-only and stored encrypted in DB.
9. Bulk-editing dashboards sharing template `Driving` and the same fleet supports setting thresholds + LINE channel at once.
10. `DashboardCard` for a Driving dashboard displays both score and letter grade (e.g. `92 · A`).
11. All new strings exist in both `en` and `th`.
12. Existing Vitest suite passes; new tests cover: `normalizeDrivingThresholds` legacy migration, `computeViolationKey` stability, `severityForRow` banding, `computeDrivingScore` formula, `sendDrivingWarning` happy path + each error code (mocking the LINE fetch).

## 13. Out-of-scope / follow-ups

- Per-driver direct-message LINE (would require driver→LINE userId table; needs onboarding workflow).
- Reading `RESTHOURFINAL`-style precomputed sheets (would need a per-dashboard "Rest Hours source gid" field and a second parser).
- A dedicated "DrivingV2" template entry — we extend `Driving` in place.
- Scoring matrix tuning UI for admins (constants are code-level for v2; flip to JSONB if requested).
- LINE Flex Messages (text-only in v2 keeps the parser simple).
- Mobile push notifications.
- Scheduled / batched warnings (only on-click in v2).
