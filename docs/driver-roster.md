# Summary dashboard driver roster

Summary dashboards can combine a current vehicle/driver roster with the alert sheet. The roster is optional and configured per dashboard in Admin. Actual names are read from Google Sheets, never embedded in application code.

## Data and matching

- Alert events still come from the dashboard's existing alert sheet and configured alert rules. Date, fleet, vehicle, driver and type filters continue to apply.
- The roster is read by the authenticated `/api/driver-roster/[dashboardId]` endpoint. Its source comes only from saved settings. Company and fleet authorization are checked before loading; entries outside the dashboard's fleet scope are removed on the server.
- Matching uses trimmed, case-insensitive **fleet + vehicle number**. It is exact matching, not a substring match. A roster with two different drivers for one vehicle/fleet is rejected; identical duplicates are collapsed.
- The current-name policy maps matching alerts to the roster driver, including historical periods. It does not change source alert records. The recorded-name policy preserves populated names from individual alerts and uses the roster to fill missing names. Historical recorded drivers and current roster drivers can then appear separately.
- A vehicle with alerts but no roster assignment remains visible as “From alert records.” Unclassified alerts appear in Other so table totals reconcile.
- Roster rows require vehicle and driver columns. Accepted headers include the supplied ` Vehicel No.` and `Name.`. A Fleet column is used when present; otherwise the configured fallback fleet is required. Incomplete or conflicting assignments cause a visible error rather than silent omission.

## Display and counting

The table starts with every roster assignment at zero, then adds filtered alerts. It shows All / With alerts / No alerts tabs, name/vehicle search, pagination, explicit numeric zero cells, a status label, and a table export that includes all matching rows across pages. Driver totals count unique normalized names; table rows count vehicle/driver assignments, so a driver with two vehicles has two rows and counts once in the driver total.

OverSpeed stays visible even when zero. Standard category matching normalizes spaces, hyphens and case, consistently across table counts and highlights. Configured alert inclusion rules still determine which events enter the Summary.

Roster-enabled views require a complete date range and complete successful alert and roster loads. Source errors show Retry; errors or partial downloads are never presented as zero alerts. The roster reloads on page load and with Refresh roster. Changes in the source sheet are therefore reflected on refresh, not through a live subscription.

“No alerts recorded” refers to the selected period and filters. It does not establish that a driver drove, a device reported successfully, or a driver earned a perfect score. Zero-alert roster drivers are omitted from safety leaderboards. An entirely zero-alert roster view displays “Not enough data” for safety score and does not write a numeric score to the dashboard cache. Existing alert-based score calculations retain their observed-vehicle/day denominator; adding roster vehicles does not dilute it.

The header CSV remains an event export. Use **Export table** for the complete roster with zero counts.

## Airliquide Service configuration

Verified read-only on 2026-10-10:

- Dashboard: `fe35d065-aa5a-47d1-9aa8-1ef05f395bf0` (Summary).
- Workbook: `1lpV3WHzQxWDi9CiF5v38rKULc6THdImKsxgjOSTKQHw`.
- Roster tab: `Vehicel alt_service`, gid `1146184501`, 15 populated vehicle/driver assignments.
- Fallback fleet: `SERVICE`.
- Prepared policy: current roster names (`vehicle`). Example: the current roster spelling YUNGYUT is used for vehicle 3669 even if a historical alert recorded YONGYUT. Switch to `recorded` in Admin to retain alert-record names.

Admin → Dashboards → edit Summary → Driver roster accepts the specific tab URL, fallback fleet and name policy. Use a tab link with its `gid`; a workbook-only URL is intentionally rejected to avoid connecting the alert sheet by mistake. Clearing the roster URL disconnects the feature.

## Rollout and rollback

Production was not changed during implementation. WORKSPACE.md requires explicit approval for deployment and production mutations.

1. Back up the target dashboard's existing settings through the normal production process.
2. Apply `scripts/driver-roster.sql` before deploying: it adds the nullable `driverRosterSettings` JSONB column. The normal migration script now includes this additive migration; do not run unrelated migrations without checking their scope.
3. Deploy the reviewed application, then apply `scripts/configure-airliquide-driver-roster.sql` or the equivalent Admin form settings. The SQL guards for exactly one matching Summary dashboard and updates only its roster settings.
4. Verify the authenticated target dashboard for a known alert period and a zero-alert period; confirm names, fleet scope, all 15 assignments, OverSpeed zero, filters, and table export.

Rollback: clear the target dashboard's roster URL/settings and/or restore the previous application build. Keep the additive nullable column; no destructive schema rollback is needed. Source sheets and historical alerts are unchanged.

The local preview `/e2e-fixtures/driver-roster` uses synthetic names/data and is gated by development mode and `ALLOW_E2E_FIXTURES`. It is for design review, not a production-data report.
