# Songdee Dashboard — Customer-Facing Metrics Reference

**Read this first.** This file is the single source of truth for what every
customer-facing number on the Songdee dashboards (Detail, Summary, Simple, Video,
Driving, OverSpeed templates under `app/dashboards/`) *actually computes*, derived
directly from the code — not from what any deck or customer conversation assumed.
Derived from `songdee-dashboard` at commit `163eabd`
(`163eabda9678626ed6232feed455ddd882388f96`, 2026-07-08). If a future feedback round
disagrees with a section here, the fix is either (a) update the code and this file
together, or (b) if the code is already right, point the customer at the relevant
section instead of re-deriving from scratch.

All data comes from **customer Google Sheets** rendered client-side (no Postgres in
the metric path; Postgres only stores dashboard config, alert rules, thresholds,
driver-name overrides, and sent-warning records). Sheet timestamps are Bangkok
wall-clock (UTC+7, no marker); `parseDate` re-stamps them as UTC digits so every
month/day key and displayed time is read with `getUTC*` / `timeZone: 'UTC'` and is
identical for every viewer (see §0.3).

Template parity is maintained **by copy, not abstraction** — Detail, Summary,
Simple, Video, OverSpeed and Driving each duplicate the pipeline. Where a template
diverges from the canonical behavior, the divergence is called out explicitly below
(the biggest one: Simple does *not* drop excluded remarks, §1 edge cases).

---

## 0. Shared building blocks

### 0.1 Sheet fetch and the 25,000-row cap (`useGoogleSheet.ts`, `app/api/sheets/[sheetId]/[gid]/route.ts`)

- The client first calls the auth-gated proxy `/api/sheets/{sheetId}/{gid}`, which
  fetches the GViz JSON endpoint capped at the **25,000 most-recent rows**, ordered
  descending by the **first date/datetime-typed column** (a one-row preflight finds
  it; falls back to column A if no column is typed as a date). SlNo/column A is NOT
  assumed sequential.
- If the proxy request fails for any reason, the client silently falls back to a
  **direct browser fetch of the public GViz URL with no row cap** — so the two
  paths can disagree on very large sheets (>25k rows: proxy shows newest 25k,
  fallback shows everything).
- Responses are cached client-side (module memory + localStorage, key
  `google-sheet:v2:{sheetId}:{gid}`) with a **5-minute TTL**. "Data updated" /
  staleness badge flips at 5 minutes.
- Cell values arrive as the sheet's *formatted* strings (numbers may contain
  commas). The Driving/OverSpeed parsers strip commas (`parseNumber`); the alert
  templates' speed parse does **not** (see §1 edge cases).

### 0.2 Column lookup (`findValue`)

Every field is resolved through an ordered, case-insensitive **alias list** per
template (e.g. alert time = `['Alert Date Time', 'Track Time', 'Date']` in
Detail/Summary/Simple; OverSpeed uses a wider list starting with `Track Time`).
A header spelling missing from the alias list makes that field parse as
`—`/`0`/`null` **silently** — rows then vanish from filtered views or contribute
zeros with no error. Alias lists are copy-mirrored per template; extending one
requires grepping the others.

### 0.3 Timestamps, month/day bucketing, default month (`dashboardDataUtils.ts`)

- `parseDate` accepts `DD/MM/YYYY[ HH:MM:SS]` explicitly; anything else falls to
  `new Date(raw)` (local parse, wall-clock digits re-stamped as UTC). Unparseable
  values → `null`; null-dated rows drop out of any month/day-filtered view for
  **every** viewer (Simple drops them from *all* views, §1).
- Month key = `YYYY-MM` and day key = `YYYY-MM-DD` from **UTC getters** on the
  UTC-digit date → viewer-timezone-independent.
- **Default month = previous calendar month** (`previousMonthKey(now)`, UTC-based):
  applied once per visit (a `didSetDefaultMonth` ref), *only if* that month exists
  in the data, and *only if* no stored filter selection exists — persisted filters
  from a prior visit always win. All templates share this.
- Day pickers appear only when exactly one month is selected; changing the month
  selection away from a single month clears day filters.
- **Edge case — month-start window**: the "now" in `previousMonthKey` is read with
  UTC getters, so during the first 7 hours of the 1st (Bangkok time) the default
  month is computed from the *prior* UTC month — a Bangkok viewer opening the
  dashboard at 03:00 on 1 August gets a default of **June**, not July.
- **Edge case — prior-month comparisons are off by one for UTC+ viewers**: the
  Detail "vs last month" KPI trend (`DetailDashboard.tsx:627`) and Summary's
  previous-month rows (`SummaryDashboard.tsx:235`) derive the prior month key via
  `new Date(y, m − 2, 1)` — a **local-time** Date — then read it with UTC getters.
  For any viewer east of UTC (including Thailand, the primary audience), local
  midnight on the 1st is still the previous month in UTC, so "last month" resolves
  **two months back**. Correct for UTC/US viewers. Note `previousMonthKey` itself
  (used for the *default month*) does this correctly with `Date.UTC` — only the
  comparison paths are affected.

### 0.4 Fleet scoping (`app/dashboard/[id]/page.tsx`, `resolveScopeFleetNames`/`scopeFleetSet`)

- A dashboard's scope = `organizationIds` (jsonb, multi-fleet) → falls back to the
  legacy scalar `[organizationId]` → empty = **company-wide** (no fleet limit).
- The server resolves those org IDs to **names** and passes `organizationNames`;
  every template hard-drops sheet rows whose `Fleet` column (normalized
  trim+lowercase) is not in that name set, **before** any option list, KPI, count,
  or score is computed. This is data-level row dropping, not a UI filter.
- The fleet MultiSelect defaults to the scoped names and resets back to them; the
  selector only renders when more than one fleet survives scoping.
- Viewer access: the user must match the dashboard's company AND be entitled to
  **every** scoped fleet.
- **Edge case — org rename**: matching is by name string, so renaming an
  Organization in admin silently zeroes out every dashboard scoped to it until the
  sheet's `Fleet` values are updated to match.
- **Edge case — template exceptions**: OverSpeed reads the fleet from
  `['Fleet', 'User']` (falls back to a `User` column). DynamicTrip performs **no
  fleet scoping at all** (its sheets have no Fleet column) — a deliberate no-op.

### 0.5 ALCHEM unit offline status (`AlchemUnitStatusDashboard.tsx`, `unitDeviceStatus.ts`)

- A vehicle's overall status is forced to **Offline** when its API update timestamp
  is more than **30 minutes old**, even when the last reported GPS/device values
  were online. Exactly 30 minutes old is not yet offline.
- The sheet timestamp is parsed using the shared Bangkok-as-UTC convention (§0.3);
  the current instant is shifted to Bangkok wall-clock digits before calculating
  its age. This keeps both the Offline KPI and the relative Updated label correct
  in every viewer timezone.
- Device dots reflect each device's own last-reported value (online/offline/not
  installed) **except** when the row's overall status is Offline: any dot that
  would otherwise render green (individually "online") is dimmed to the same
  gray used for "Not Installed", so the row's dots visually agree with its own
  Offline verdict. A device already reporting offline (red) or not installed
  (gray) is unaffected. The expanded row details still identify that the
  overall Offline state was caused by an API update overdue by more than 30
  minutes.
- Missing or invalid update timestamps do not trigger this age-based override.

---

## 1. Alert count — "Total alerts" and every alert-derived number (Detail, Summary, Video; Simple diverges)

- **Display**: "Total alerts" KPI, the records table row count, donut/trend/heatmap
  totals, top-vehicle/driver rankings, unique vehicle/driver counts — all derive
  from the same filtered row set.
- **Source**: every sheet row, mapped to `{alertType, remark, speed, vehicle,
  driver, fleet, parsedDate}`.
- **Pipeline (why the dashboard count ≠ raw sheet row count, by design)**:
  1. `withDerivedRemark` trims the raw `Remarks` cell (`'—'` sentinel → empty).
  2. `applyAlertRules(alertType, rawRemark, speed, rules)` produces the final
     remark label (see rule engine below). Rows matched by an `always_exclude` or
     `false_alert_speed` rule come back as the literal remark **"False alert"**.
  3. Rows whose final remark is **blank** are dropped (`hasRemark`).
  4. Rows whose final remark contains **"false alert"**, **"no video"**, or
     **"no-video"** (case-insensitive substring, `isExcludedAlertRemark`) are
     dropped — this is what removes the rule-excluded rows from step 2 and any
     reviewer-annotated false alerts in the sheet itself.
  5. Rows outside the fleet scope are dropped (§0.4).
  6. Admin-configured allow-lists (`alertTypes`, `remarks` on the dashboard row)
     further restrict; when unset, everything passes. Rows with a blank
     `Alert Type` are dropped in Detail/Summary at this stage.
  7. Month/day/fleet/type/vehicle/driver UI filters apply last.
- **Rule engine (`DEFAULT_ALERT_RULES` + `applyAlertRules`)** — five phases, in
  order: `remap_alert_type` (unconditional rename) → `remap_alert_type_if_remark_contains`
  (conditional on the *raw* remark) → `remap_remark` (spelling normalization,
  substring match both directions) → `always_exclude` (by alert type) →
  `false_alert_speed` (remark match AND `speed < maxSpeed`).
  - **Precedence**: the server concatenates **dashboard rules before company
    rules** (`page.tsx`), and `applyAlertRules` puts all user rules **before the
    baked-in defaults** within each phase; the first match in a phase wins. Net
    order: dashboard rule > company rule > Songdee default.
  - When a *user* rule claims an alert type in phase 1 or 2, default conditional
    rules are skipped for that row (`userSealed`) so a customer's explicit mapping
    can't be overridden by the built-in Eye-Closing heuristics.
  - **Defaults worth knowing**: the six standard MDVR alert types
    (`Distraction-A2`, `Eye Closing-A2`, `Yawning-A2`, `OverSpeed`,
    `Harsh Acceleration`, `Harsh Brake`) are remapped to canonical labels.
    `Eye Closing-A2` has **no unconditional default** — it maps to
    Fatigue/Yawning/Distraction/Mobile Phone/Eating/Smoking only when the raw
    remark contains the matching keyword. An `Eye Closing-A2` row with a blank or
    unrecognized remark therefore **drops out of the count entirely** (step 3) —
    intentional, because the hardware fires that alert for many root causes and
    only reviewer-annotated rows are classified.
- **Edge case — Simple template diverges**: `SimpleDashboard.tsx` applies fleet
  scope and allow-lists but **never applies steps 3–4** — blank-remark rows and
  rows classified "False alert" by exclusion rules are still counted in its totals
  and score. It also drops **all** rows with unparseable dates (Detail/Summary
  keep them in unfiltered views). A Simple and a Detail dashboard on the same
  sheet can legitimately show different totals.
- **Edge case — speed parse**: the alert templates parse speed with
  `Number(...)`, which does **not** strip thousands separators — a missing or
  comma-formatted speed reads as `0`, which always satisfies
  `speed < maxSpeed`, so any `false_alert_speed` rule whose remark matches will
  exclude such rows.
- **Edge case — driver names**: the driver shown (and counted in "unique
  drivers"/leaderboards) is the manual override when one exists, keyed by
  `computeAlertKey` = sha1(vehicle | raw formatted time cell | alert type). If the
  sheet's *displayed* date format changes, every stored override stops matching.
- **Video count** (Detail KPI subtitle, Video template): rows with a non-empty
  `videoURL`/`Videoit` column, counted after all filters above.

## 2. Overall safety score (`computeSafetyScore`) — Detail, Summary, Simple

- **Display**: "Safety score (0–100): Higher = fewer alerts" (dashboard cards);
  score blocks in Summary; cached per dashboard (§9).
- **Formula**: `alertsPerVehiclePerDay = alerts / vehicles / days`;
  `score = round(max(0, 100 − min(70, alertsPerVehiclePerDay × 70)))`.
- **Inputs** (identical in all three templates): `alerts` = the fully filtered
  alert count (§1, *including* active month/day/vehicle/driver filters);
  `vehicles` = unique vehicles **among the filtered alerts** (min 1) — not fleet
  size; `days` = distinct calendar days **that have at least one alert** (min 1) —
  not days in the period.
- **Consequences to be able to explain**:
  - Penalty caps at 70, so the score **never goes below 30**.
  - 1 alert per vehicle per alert-day → exactly 30; ~0.5 → 65.
  - Quiet days don't dilute: 30 alerts on one day scores the same as 30 alerts on
    one day of a 31-day month — the other 30 days aren't in the denominator.
  - Vehicles with zero alerts don't help either (denominator counts only vehicles
    that appear in alert rows).
  - An empty filter result → score 100 (and 100 is also what "no data at all"
    produces).
  - The score changes with whatever filters the viewer applies — it is not a
    fixed fleet-month number.
- Summary also computes the same formula over the prior-month rows for its
  score-trend comparison — subject to the off-by-one edge case in §0.3.

## 3. Per-driver safety score (`computeDriverSafetyScore`) — Detail driver summary, Summary leaderboard

- **Display**: the score card when exactly one driver is filtered (Detail); the
  driver/vehicle leaderboard scores (Summary).
- **Formula**: `score = round(max(0, 100 − min(70, (alerts / activeDays) × 35)))`,
  where `activeDays` = distinct days on which **that driver had alerts** (min 1).
- 1 alert/day → 65; 2+ alerts/day → 30 (the floor).
- **Edge cases**: Detail shows no score (null) when none of the driver's alerts
  have parseable dates, instead of a misleading 100. Summary's leaderboard falls
  back to grouping by **vehicle** when the sheet has no driver names, using the
  same formula per vehicle.

## 4. `computeComplianceScore` — defined but currently unused

- `dashboardDataUtils.ts:514`: `100 − min(70, (violations / trips) × 70)`,
  rounded, floor 0 — documented in code as "Driving safety score for Driving
  dashboard: violations per trip".
- **At this commit it has no call sites** outside its own tests. The Driving
  template's real score is `computeDrivingScore` (§5). Keep this in mind when a
  deck or spec references "compliance score" — nothing on screen computes it.

## 5. Driving safety score & grade (`computeDrivingScore`, `drivingScoring.ts`) — Driving template

- **Display**: the dashboard-list card for Driving dashboards: "score · Grade X"
  with "N violations" (see the edge case below), tooltip "Driving safety score
  (0–100): Higher = fewer driving violations."
- **Inputs**: the month/day/driver/vehicle-filtered shift rows, bucketed into
  **driver-days** (`bucketByDriverDay`): only `COMPLETED` shifts with a parseable
  login time count; a shift spanning midnight has its drive hours and distance
  split across calendar days **proportional to elapsed time** (§6.2).
- **Severity per driver-day** (`severityForDriverDay`), banded against the
  configured thresholds (§6.1), each 0 / 1 / 3:
  - *Drive*: `totalDriveHours` ≤ lowest drive threshold → 0; > highest → 3;
    in between → 1. (With the single default threshold of 10 h there is no
    middle band: ≤10 → 0, >10 → 3.)
  - *Rest*: the **worst (minimum) positive** rest value among the day's shifts;
    ≥ highest rest threshold → 0; < lowest → 3; between → 1. Days with no
    positive rest values score 0 (no data ≠ violation).
- **Formula**: per-day weighted penalty = `drive × 1.2 + rest × 1.5`; score =
  `round(clamp(100 − mean(perDay) × 25, 0, 100))`. Worst possible day
  (3 and 3) = 8.1 → a fleet where every driver-day maxes out scores 0.
- **Grade**: A ≥ 90, B ≥ 80, C ≥ 65, D ≥ 40, F below.
- **Edge case — the card's "N violations"**: what is stored alongside the score is
  `perMetric.drive + perMetric.rest` — the **sum of severity points** (0/1/3 per
  driver-day per metric), not a count of violation rows. A single bad driver-day
  can contribute up to 6 "violations" on the card.

## 6. Driving-template violations (threshold tabs) — `drivingThresholds.ts`, `violationBuilders.ts`

### 6.1 Thresholds

- **Defaults** (`DEFAULT_DRIVING_THRESHOLDS`): drive hours **> 10 h/day**, rest
  hours **< 10 h**, continuous driving **> 4 h**. Admin-configurable per dashboard
  (inline editor); values must be 0 < v ≤ 24, max 5 entries per metric, optional
  labels ≤ 32 chars. Each threshold entry generates its own sub-page tab
  (`Drive Hr/day > N h`, `Rest Hr < N h`, `Cnt Drv > N h`), sorted ascending.
- Legacy config shape `{continuousDrivingMaxHours, restMinimumHours,
  workingHoursMax}` still normalizes (cntDrv/rest map over; **workingHoursMax is
  ignored**; drive falls back to the 10 h default).
- A drive-hours entry whose label contains "cnt drv" or "continuous" is
  re-partitioned into the cntDrv metric — labels are load-bearing.

### 6.2 Drive Hr/day tab (`buildDriveHoursRows` → `bucketByDriverDay`)

- **Row = driver × calendar day**, built from `COMPLETED` shifts with a parseable
  login time. Drive hours and distance of a shift that crosses midnight are split
  across the days it touches proportional to elapsed wall-clock time (last day
  takes the rounding remainder); a shift with no logout (or logout ≤ login) books
  entirely to the login day.
- **Violation** = `totalDriveHours > threshold` (strict). The tab lists **all**
  driver-days and highlights the exceeders in red — the table row count is not the
  violation count.
- Vehicle column shows the plate when the driver used one vehicle that day, `*`
  when several; SlNo is blank when the day aggregates more than one shift.
  Day-filter chips match the bucketed day key.

### 6.3 Rest Hr tab (`buildRestHoursViolations`)

- **Row = one COMPLETED shift** with a parseable login time and `restHours > 0`.
- **Violation** = `restHours < threshold` (strict; exactly the threshold is
  compliant). Tab lists all qualifying shifts, highlights those below.
- **Edge case**: shifts whose rest value is missing, zero, or unparseable
  (parse → 0) are **excluded from the tab entirely** and can never be flagged —
  no-rest-recorded is indistinguishable from not-applicable.

### 6.4 Cnt Drv tab (`buildCntDrvHoursViolations`)

- Sourced from the **second sheet tab** (`sheetGidCntDrv`); dashboards without one
  have no Cnt Drv data. Row = one continuous-driving segment with a parseable
  start time and `cntDrvHours > 0`.
- **Violation** = `cntDrvHours > threshold` (strict).
- The continuous-hours value is found by an exact label scan over ~15 known
  spellings (`Cnt Drv Hr`, `Cnt Drv duration`, `Continuous Driving Hrs`, …),
  skipping blank cells so an empty sibling column doesn't shadow the populated
  one, then a fuzzy fallback (any header containing cnt+drv or continuous+drv).

### 6.5 Overview-tab violation tables

- The Overview tab's violation lists use **only the first threshold of each
  metric**: cnt-drv rows where `cntDrvHours > cntDrvThresholds[0]` and shift rows
  where `0 < restHours < restThresholds[0]`. Additional configured thresholds get
  their own tabs but do not appear in the Overview lists, and **drive-hours
  violations are not listed on Overview at all**.

### 6.6 Duration / work-hours parsing (`parseDurationHours`)

- Accepts `H:MM` and `H:MM:SS` (converted to decimal hours) or a plain number
  (commas stripped). Anything else → **0**, which silently reads as
  "no data" everywhere above.
- Field alias lists: drive = `['DriveHrs', 'DriveHrs duration']`; rest = 8
  spellings (`Rest Time` … `RestHrs duration`); working hours = 10 spellings
  (`Working Hr` … `WorkHrs duration`). A customer sheet with a new spelling
  silently zeroes the metric (this exact failure — `WorkHrs duration` missing
  from the alias list — once hid all 82 of a customer's violations).
- **Note**: `workingHours` is parsed onto every shift row but no KPI, violation,
  or score consumes it at this commit; work-hour columns surface only as raw
  columns in the trip table (formatted as durations).

### 6.7 Violation identity & LINE warnings

- `computeViolationKey` = sha1(metric | driver | vehicle | eventAt ISO |
  threshold). Sent LINE warnings are stored against this key, so a "warned" badge
  survives re-fetches — but changing a threshold value, renaming a driver, or a
  driver-name override changes the key and **orphans the warning history** for
  those rows.

## 7. Driving KPIs (trips / distance / hours)

- **Total trips** = the number of *filtered shift-sheet rows* — one sheet row =
  one trip, **including non-COMPLETED rows** (violations and the driving score use
  COMPLETED only, so "trips" can exceed the rows those consume).
- **Total distance** = sum of `Distance` (commas stripped); **drive hours** = sum
  of `DriveHrs`; **rest hours** = sum of rest columns; **Cnt Drv hours** = sum
  over the second sheet's rows.
- Averages: distance/trip and rest/trip divide by shift-row count; Cnt Drv/trip
  divides by the **cnt-drv sheet's** row count.
- KPI trend arrows split the date-sorted filtered rows into first/second half
  (needs ≥ 4 dated rows) and compare the halves.
- The monthly trend chart deliberately **ignores the month filter** (other filters
  still apply) so it always spans multiple months.
- Unique-driver/vehicle counts pool both sheets' filtered rows.

## 8. OverSpeed metrics (OverSpeed template)

- **Row parse**: date from `['Track Time', 'Alert Date Time', 'DateTime', 'Date',
  'Start Time']`; speed from `['Speed', 'Max Speed', 'Spd']` (commas stripped);
  an `Over Speed` numeric column; optional explicit duration-bucket columns
  (`'>1minutes'`, `'Less than 1minutes'`, and ~10 alias spellings each).
- **> 1 min vs < 1 min classification** — two modes, decided per fetch:
  - **If any scoped row has an explicit duration column**: per row,
    `gt1min = parseNumber(rawGt1)` (missing → 0) and `lt1min = parseNumber(rawLt1)`,
    except when the <1 column is absent, where `lt1min = max(0, overSpeed − gt1min)`
    (i.e. the `Over Speed` column is treated as the total). These columns are
    **summed**, so if they carry per-row counts the totals are event counts, not
    row counts.
  - **Otherwise (heuristic)**: each row is one event; `Over Speed == 0` → counted
    as **sustained** (> 1 min), `Over Speed > 0` → counted as **brief** (< 1 min).
- **Vehicle / Driver summary tables**: group the filtered rows; `> 1 min` and
  `< 1 min` are sums as above; **Max Speed** = maximum of the `Speed` column in
  the group (0 renders as —; > 120 km/h renders red); **Total** = gt1 + lt1 —
  which is the row count only in heuristic mode.
  The vehicle table's Driver cell joins **every** driver seen on that vehicle in
  the period.
- Bar charts = top 10 vehicles/drivers by that same Total; the heatmap buckets
  dated rows by weekday × hour (UTC digits = Bangkok wall-clock).
- Scoping/default month as in §0.3–0.4 (fleet may come from a `User` column). No
  alert-rule engine and no remark exclusions run here — the sheet is assumed to be
  overspeed events only. OverSpeed computes **no safety score** (its dashboards
  show no score on the listing page, §9).

## 9. Cached score on the dashboard listing (`scoreCache.ts`, `DashboardCard.tsx`)

- Detail, Summary, Simple and Driving write their headline score to
  localStorage (`dashboard-scores`) **every time the dashboard page finishes
  loading, under whatever filters are active** — including an empty filter result
  (score 100, 0 alerts).
- The `/dashboard` listing card then shows that cached score, alert/violation
  count, and (Driving) grade. Consequences: the card reflects the viewer's **last
  visit and last filter state**, is **per-browser** (two users can see different
  scores for the same dashboard), and shows nothing until the dashboard has been
  opened once.

---

## Open questions

1. **Simple template counts excluded rows** (§1) — Simple never drops blank-remark
   or "False alert"/"no video" rows, unlike Detail/Summary/Video. Same sheet, two
   templates, two different totals. Intentional trade-off or drift to fix?
2. **Prior-month comparisons off by one for Thailand-based viewers** (§0.3) — the
   Detail "vs last month" trend and Summary's previous-month score/highlights
   build the prior-month key from a local-time Date but read it with UTC getters;
   for UTC+ viewers "last month" resolves two months back. Needs a code fix
   (`Date.UTC`, as `previousMonthKey` already does).
3. **`computeComplianceScore` is dead code** (§4) — nothing calls it; the Driving
   score is `computeDrivingScore`. Remove it, or wire it up where a spec expects
   violations-per-trip?
4. **Driving Overview violation lists use only the first threshold per metric and
   omit drive-hours violations entirely** (§6.5) — confirm customers reading the
   Overview understand the per-threshold tabs are the complete picture.
5. **Driving card says "N violations" but N is a severity-point sum** (§5) — up to
   6 points per driver-day. Rename the label or store an actual violation count?
6. **Safety score floor is 30** (§2) — the penalty cap means even a catastrophic
   month never scores below 30, and "no data" scores 100. Confirm customers
   interpret the 30–100 effective range correctly (a DHL-style feedback round
   assumed 0–100).
7. **Rest violations require a positive rest value** (§6.3) — a shift with
   missing/zero/unparseable rest can never be flagged, so a sheet that stops
   populating the rest column silently ends all rest violations.
8. **OverSpeed classification heuristic** (§8) — `Over Speed == 0` → "sustained
   > 1 min" encodes an assumption about how the tracker emits the column; confirm
   with the sheet producer, and confirm whether explicit >1/<1 columns carry
   counts (summed) or flags on every customer sheet.
9. **Comma-formatted speeds defeat `false_alert_speed` rules** (§1) — alert
   templates parse speed with `Number()`, so "1,234" or blank reads as 0 and the
   row is excluded whenever a speed rule matches its remark. Align on
   `parseNumber` (comma-stripping) if any customer sheet formats speeds.
