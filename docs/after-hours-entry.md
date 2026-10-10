# After-Hours Customer Entry

Template key: `AfterHoursEntry`. Thai report title: **รถเข้าพื้นที่ลูกค้านอกเวลา**.

## Admin setup

Choose AfterHoursEntry in Admin → Dashboards → Create dashboard or Edit. It is also available in bulk creation and Quick setup (not selected by default).

Provide the Google Sheet link, company and optional fleet scope using the existing controls. Set the allowed start/end time and enter customer-area names, one per line, copied from **Geofence Name**. For the supplied source use **Thongfleet** and **08:00–16:00** initially. Scoped fleet names must match the **Fleet** column (for example **Thong**); the old THONGTRANSPORT User Name mapping is no longer used. If the saved Admin fleet name differs, correct the dashboard's fleet scope before using it; do not broaden access to compensate.

Settings are stored once per dashboard in `Dashboard.afterHoursSettings`. Admin can edit allowed hours directly on the report using **Save shared hours**, or through Admin Create/Edit. The server action requires Admin and the same company/all-fleet assignments as the report, validates the hours, and updates only this dashboard's schedule. All customer areas on one dashboard use the same hours every day in Asia/Bangkok. Saving different hours recalculates historical records; version one does not version schedules or support holidays, weekday overrides, or overnight windows. Viewers can change date/vehicle/fleet filters but cannot save shared hours.

## Source and counting rules

- Google Sheets only. No uploads or writes to the source spreadsheet.
- Required unique headers: `Vehicle No`, `Driver Name`, `Fleet`, `Alert Type`, `Alert Date Time`, `Geofence Name`. Columns may be in any order; they are mapped by header name, never by column letter/number. Other columns remain untouched.
- Entry events: `Unauthorised Entry` (also accepts the US spelling `Unauthorized Entry`).
- `Geofence Name` must contain at least one configured customer-area name, case-insensitively.
- Fleet scoping matches the entire `Fleet` cell, ignoring case/outer spaces. The original trimmed Fleet value is displayed. User Name and Geofence Name never substitute for Fleet. An empty Fleet is excluded from scoped dashboards and shown as `—` in company-wide dashboards.
- `Driver Name` appears between Vehicle No and Fleet, preserving the source value (including `NA`). Empty driver cells display `—`.
- Strict displayed `dd/mm/yyyy h:mm:ss` parsing. Invalid dates are excluded and reported separately, never counted as within-hours entries.
- Before start = early; after end = late; the exact start/end instants are within hours. For 08:00–16:00, 16:00:00 is within hours and 16:00:01 is late.
- Each source entry counts once. Separate visits by the same vehicle remain separate events. The vehicle KPI counts distinct nonblank vehicles among after-hours entries.

The supplied spreadsheet displays day/month dates but its underlying Google date values use different calendar dates. This template deliberately reads the displayed date text, without altering the sheet. It scans source-order pages of 1,000 rows and filters those dates on the server. It does not use GViz typed-date predicates or a 25,000-row total cap. Large sheets therefore take longer to load; totals are displayed only after all pages succeed. Errors do not become zero/partial totals. A configuration change between pages requires a refresh.

## Viewer controls

Default: Today. Other periods: Yesterday, This week (Monday through today), This month (first through today), and Custom range (both dates inclusive). There is no All dates option. Presets use Bangkok time independent of the viewer's device time zone.

Vehicle No and Fleet use searchable multiple-selection controls populated from authorized entries in the selected period. Empty selection means all. Choices within one selector are combined with OR; vehicle and fleet selectors combine with AND. Clear filter restores all choices. Date, vehicle and fleet selection update KPIs, charts and table together. Hourly and daily charts show all statuses in that selection. The separate table-status selector defaults to after-hours entries and does not alter the summary KPIs. Empty periods explicitly show no data. Refresh reads the current source and saved schedule again.

## Files for further modification

| File | Responsibility |
| --- | --- |
| `app/dashboards/afterHoursEntry.ts` | Settings validation, strict dates, presets, fleet/area matching, classification and chart counts |
| `app/dashboards/afterHoursFetch.ts` | Paginated read-only Google Sheets loader |
| `app/api/after-hours/[dashboardId]/route.ts` | Session/company/all-fleet authorization; resolves source and schedule from the database; returns only scoped date-range entries |
| `app/dashboards/useAfterHoursEntries.ts` | Complete-load state, cancellation, pagination and configuration consistency |
| `app/dashboards/AfterHoursEntryDashboard.tsx` | English/Thai report, periods, vehicle search, KPIs, charts and table |
| `app/dashboards/AfterHoursScheduleEditor.tsx`, `afterHoursActions.ts` | Inline Admin schedule form and authorized server save; demo applies hours locally |
| `app/admin/dashboards/AfterHoursAdminFields.tsx` | Reusable Admin schedule/customer-area fields |
| `app/admin/dashboards/{DashboardsClient,page}.tsx` | Template picker and Admin Create/Edit actions |
| `app/admin/quick-setup/{QuickSetupClient,page}.tsx` | Quick setup registration and settings forwarding |
| `app/db-schema.ts`, `app/db.ts`, `app/db-bulk.ts`, `app/admin/types.ts` | Persistent settings and single/bulk create/update payloads |
| `app/dashboard/[id]/page.tsx`, `app/dashboards/dashboardDataUtils.ts` | Rendering and template-name registration |
| `app/dashboards/DashboardShell.tsx`, `app/dashboards/dateFormat.ts` | Optional Bangkok freshness display; existing templates retain their formatting default |
| `scripts/after-hours-entry.sql`, `scripts/migrate.ts` | Additive settings-column migration |
| `app/e2e-fixtures/after-hours/` | Synthetic preview, available only in development with ALLOW_E2E_FIXTURES=true |

`tsconfig.json` also enables downlevel iteration: the existing Headers iteration in `proxy.ts` otherwise fails the ES5 type check on this checkout.

## Validation

- Source snapshot and actual live loader: 212 entries over 1–5 October 2026; 29 early, 44 late, 139 within hours; 73 outside hours and 22 distinct outside-hours vehicles.
- Unit/route tests cover strict dates, boundaries, Bangkok calendar presets, changed schedules, fleet scope, authorization, pagination beyond 25,000 rows and source/schema errors.
- Browser preview covers empty Today, inclusive Custom range, invalid-range handling, vehicle search, table status and hourly/daily chart switching.
- The preview uses generated DEMO vehicles/drivers and three fleets (Thong, Demo East, Demo West), not bundled customer data. Open `/e2e-fixtures/after-hours`, add `?lang=th` for Thai or `?mode=admin` to inspect Admin fields. The preview starts on Custom range 1–5 October 2026 so all 212 demo entries are visible immediately; normal dashboards still default to Today. **Apply demo hours** recalculates the demo locally and resets to 08:00–16:00 on page reload; it does not write to a database.

## Deployment sequence (not executed)

1. Complete review and obtain explicit deployment approval under WORKSPACE.md.
2. Apply **only** `scripts/after-hours-entry.sql` to the intended database using the existing authorized database tooling. This adds a nullable JSONB column and leaves existing records unchanged. It must be applied before switching the running application because the ORM selects this column.
3. Build/package the reviewed checkout with the existing Windows hosting process; see `hosting/README.md`. Do not replace release files manually or reuse production configuration during local testing.
4. Deploy through the existing release controller, then create the new dashboard in Admin and verify with an assigned user. Check 1–5 October 2026 against the expected totals above.

For rollback, restore the prior application release and retain the additive nullable column. Do not drop stored configuration or delete source data. The migration and a real database save/reload have not been exercised on the live database during development.
