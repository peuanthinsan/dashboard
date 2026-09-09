# Shared UnitStatus

User: one UnitStatus template for all companies, preserving the new layout,
following BIGTH requirements, with Intercom forced online because the data has
no trigger logic. This supersedes the Vehicle-only task.

Active root: Codex / GPT-6 / effort UNKNOWN. Claude review lane reads frozen files.
Base worktree c8dc2a25aa6507690034b9555e02ba7491e8f50d; integration target e4d709f.
Worktree /private/tmp/songdee-vehicle-unit-status. Main workspace prior Vehicle
changes belong to this task. Preserve unrelated monthly-summary work.

## Ownership
Root: unitStatusData.ts, useUnitStatusSheet.ts, docs/METRICS.md, handoff and QA fixture.
Codex UI lane: UnitStatusDashboard.tsx (replaces VehicleUnitStatusDashboard.tsx).
Codex registration lane: dashboardDataUtils.ts/test, DashboardCard.tsx,
admin/dashboards/DashboardsClient.tsx and dashboard/[id]/page.tsx.
Codex test lane: unitStatusData.test.ts (replaces vehicleUnitStatusData.test.ts).
No overlapping writers. No env, DB/config, auth, external messaging, git commits,
push, merge, production changes or deploy. Root integrates reviewed files only.

## Evidence and acceptance
BIGTH code reads Unitstatus + CH. Common checklist: GPS, Status AI, Device Status,
CH1 AI, Reverse BSD, Front, Front BSD, Rear Right, Rear Left, Left BSD, Right BSD,
Cabin, Storage, Seat Vibrator, Intercom. Camera active count uses CH1 AI, Front,
Rear Right, Rear Left, Cabin; expected count from CH vehicle lookup. Filters:
complete datetime range, vehicle search, fleet/vehicle/driver/type multiselect.
Damage matrix and installation-by-fleet summaries. Preserve prior shell/table/
expandable detail layout and raw telemetry, en/th, light/dark, mobile.

Source workbook inspected through authenticated browser XLSX export. Linked
Vehicle tab has raw telemetry. Its Unitstatus tab currently contains SC formulas
and is NOT evidence for BIGTH derivation; do not copy its 15-minute/168-hour or
camera-wiring formulas. Existing BIGTH component has no age-derived health.

Shared classifier accepts BIGTH words + sheet check/cross symbols; failure wins.
Absent/unrecognized status is Unknown, not a fabricated failure. Intercom always
Online, including stale or GPS-offline units. Raw named camera signals match only
literal unambiguous names; numeric/Driver/AI/Reverse 1 wiring is not inferred.
Thirty-minute update age is supplementary, independent device health.
Missing expected cameras remains unknown. CH unavailable does not block primary
unit data. Fresh primary/CH reads every 60 seconds with manual refresh.

Canonical UnitStatus only in pickers/cards. Legacy aliases route common UI;
legacy BIGTH keeps named Unitstatus source. Ordinary admin edit must preserve
legacy source mode despite canonical display. CompanyName is passed from the
existing authorized company lookup. Hard fleet scope applies before metrics;
raw username membership exact when company-wide. Blank/missing fleet does not
pass a configured scope. CH installation totals bound to authorized fleets.

Validation: new model tests, focused resolver tests, changed-file lint and types,
browser desktop/mobile workflow with fixtures, Claude review of frozen patch.
Broad suites left to CI. Prior Vehicle review invalidated by this scope change.

## Integration status
Final source integrated as local uncommitted WIP after initial review corrections.
Final re-review requires specific authorization following automaticapproval rejection.
See receipt.md andverification.md. No externalstatechanged.
