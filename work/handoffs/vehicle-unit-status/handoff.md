# Vehicle unit status template

Objective: add a selectable VehicleUnitStatus dashboard template for the Vehicle
company using the supplied Google Sheet, sheet ID
1n52NbdR9St7fQG0H1Rbo_rogbHVr64rSZY7reLE1-dU, gid 1214717385.
Active root: Codex / GPT-6 / effort UNKNOWN. Delegated provider: Claude, review lane.
Base: c8dc2a25aa6507690034b9555e02ba7491e8f50d.
Isolated checkout: /private/tmp/songdee-vehicle-unit-status.

## Ownership and scope

Codex worker owns app/dashboards/vehicleUnitStatusData.ts and its test only.
Root owns VehicleUnitStatusDashboard.tsx, template registration in
dashboardDataUtils.ts and its alias tests, dashboard/[id]/page.tsx,
dashboard/DashboardCard.tsx, admin/dashboards/DashboardsClient.tsx,
docs/METRICS.md and this handoff directory. Root also owns gated QA fixture.
No overlapping writer leases. Review reads frozen files only and returns a receipt.
No env, database, auth, existing template behavior, production configuration,
publishing, ticket, commit, push, merge, or deployment changes.
Pre-existing WIP in the original checkout under simple-monthly-summary is excluded.

## Source and acceptance

The Vehicle tab queries the master sheet for username containing Vehicle.
Observed headers: vehicleno, datatime, location, gps, direction, hdop,
storagestatus, networksignal, recording, videoloss, storagealert,
storagelastalert, mainpower, battery, idkeylastdetected, devicetype,
lastupdatedtime, lastaialert, lastaialerttime, nodays_noaialert, username, speed.
The tab has one unit at inspection. Display only exact Vehicle username tokens;
apply optional explicit Fleet scope before totals. If any input row has a Fleet
column, scoped rows with blank/missing Fleet are excluded. Preserve named camera channels
and numeric video-loss channels, without inferring channel mappings or hardware
installation. No nodays_noaialert metric: its name and values have ambiguous units.
Use existing 30-minute timestamp freshness threshold and Bangkok-as-UTC convention;
invalid/missing/future timestamps are unknown, not healthy. These are update-age
categories, not an inferred overall device health score.

Template uses existing dashboard shell/tokens, four update-count KPIs, search,
update-status filter, reset, refresh/60-second auto-refresh, and a device table
with expandable telemetry/camera/AI details. English/Thai, dark/light, responsive
table overflow, empty/error states, and no fabricated source values.
Template is registered in admin picker, route resolver and dashboard cards.
No DB migration or live dashboard record creation is needed for the code template.

Verification: new parser tests, targeted resolver tests, changed-file lint,
TypeScript, browser desktop/mobile workflow and final opposite-provider review.
Broad existing suites are left to CI under user instructions.

## Completion

Implementation and targeted verification complete. Claude Sonnet 5/high requested,
actual model claude-sonnet-5; effort not independently exposed. Final review PASS.
See receipt.md and verification.md for evidence. No commit, push, merge, deploy,
database write, or live dashboard record creation performed.
The original checkout advanced independently to e4d709f (monthly-summary work)
during this task. It has no overlapping file changes; preserve that work when
integrating the nine reviewed source/test/doc paths. The worktree remains on
codex/vehicle-unit-status at its original base with the reviewed uncommitted patch.
The nine reviewed files are now integrated as uncommitted changes in the shared
workspace, after checking every tracked destination against the base and every
new destination for absence. Their SHA-256 values match source-manifest.txt.
