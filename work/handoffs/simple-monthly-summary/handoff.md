# Simple monthly summary

- Objective: support the linked three-column monthly alert summary in Simple,
  retaining the existing raw-event Simple dashboard without behavior changes.
- Active root: Codex; model/effort: UNKNOWN. Requested lane: review (after freeze).
- Base SHA: 6bf0c5bce69390ebb76548622366fe88bd216b4a on main.
- Source: Google Sheet 1xn6G5Fl7ah4C2FdrTerlzm7If82a_EDvEPGlOy6T-O8, gid 0.
  Headers: เดือน (YYYY-MM), ประเภท (คอลัมน์ H), จำนวนสรุป.
  28 summary rows, 12 alert types, June–August 2026; actual CSV and GViz response
  are /tmp/songdee-summary.csv and /tmp/songdee-summary-gviz.txt.
- User clarified that existing dashboards with raw-data spreadsheets must work.

## Ownership and scope

- Root owns SimpleDashboard.tsx, RawSimpleDashboard.tsx (unchanged original),
  SimpleMonthlyDashboard.tsx, simpleSheetFetch.ts, simpleSheetFetch.test.ts,
  useSimpleSheet.ts, and dashboard card copy, plus temporary QA fixtures.
- Codex worker owns simpleSummaryData.ts and simpleSummaryData.test.ts only.
- All source paths above live in app/dashboards/ except card copy in
  app/dashboard/DashboardCard.tsx. No overlapping writer leases.
- Pre-existing WIP is excluded: app/api/sheets/[sheetId]/[gid]/route.ts,
  LocationDataV1Dashboard.tsx, app/ui/MultiSelect.tsx, locationVehicleData.ts,
  locationVehicleFetch.ts, useLocationVehicleData.ts.
- No env, database, production configuration, publishing, commit, push, merge,
  or deployment changes.

## Acceptance and verification

1. Probe headers; recognized summary format loads all summary rows, while raw
   sheets retain the original Simple behavior. Probe failure falls back to the
   existing raw fetch/proxy/cache behavior.
2. Summary counts are summed, never counted as raw events. Every sheet type is
   included by default; arbitrary future types are discovered dynamically.
3. All source months appear chronologically by default. Month and type filters
   control grouped bars, monthly pivot table, totals and CSV together.
4. Missing month/type combinations display zero. Invalid summary data has a
   visible error and cannot silently display partial totals.
5. No vehicle/day safety score is computed from monthly summaries. Existing
   route authorization is retained; summary sheets are pre-scoped sources.
6. Targeted parser/fetch tests, lint, type check and desktop/mobile interaction
   QA. No broad local test suites.
7. Opposite-provider review against the final frozen snapshot. Any source change
   invalidates the review. Reviewer may read listed paths and dependencies only,
   and returns findings plus a receipt; no git or production mutation.

## Frozen verification evidence

- Source fingerprints are in source-manifest.txt (temporary QA fixture excluded).
- RawSimpleDashboard SHA-1 equals the original SimpleDashboard at HEAD:
  2d8076a3f95e78a32a99f505f99885612139ffb8. Original content is unchanged.
- npm test -- app/dashboards/simpleSummaryData.test.ts: 38 passed.
- npm test -- app/dashboards/simpleSheetFetch.test.ts: 17 passed, including
  post-probe cancellation, timeout/raw fallback and summary error isolation.
- TypeScript no-emit check passed; all changed paths lint clean.
- Browser plugin unavailable, agent-browser CLI unavailable. Used installed
  Playwright with a temporary development-only fixture, removed after QA.
- Playwright exercised live public sheet fetching and actual summary totals:
  June 888, July 2073, August 203, total 3164, all 12 alert types.
- Mobile Phone filter: 77/138/18, total 233; June + August filter: total 95;
  downloaded CSV contains those two months and totals exactly.
- Storage Error filter retained all three months with 2/0/0; Reset restores all.
- Invalid count shows a row-specific error without partial KPIs; refresh recovers.
- Raw-data fixture: original Daily trend and six-column Alert table, 3 alerts.
- No application console or runtime errors, no framework overlay.
- Desktop 1440x1100; mobile 390x844. Mobile document width 390 with no page
  overflow; chart/table internal scroll widths 1152/1378 in 324px containers.
- Evidence and temporary scripts remain outside the repo:
  /tmp/simple-summary-desktop.png, /tmp/simple-summary-phone.png,
  /tmp/simple-summary-mobile.png, /tmp/simple-summary-raw-compat.png,
  /tmp/simple-summary-interactions.cjs, /tmp/simple-summary-filtered.csv.
- Source-of-truth numbers were read from the supplied public Google Sheet;
  fixture raw rows were synthetic and involved no database access.

## Post-review corrections (new frozen snapshot)

The initial receipt is superseded after three scoped fixes:
- isSimpleSummarySheet now rejects known raw event columns (timestamp, vehicle,
  driver, remarks, fleet, speed), even when Month/Alert Type/Total helpers exist.
- Numeric alert-label object ordering now drives chartColors explicitly, keeping
  each type's colors consistent with the table after JavaScript reorders keys.
- Full-summary timeouts now produce a clear retry message.
- Targeted parser tests: 52 pass; fetch tests: 19 pass, including raw-plus-summary
  helper columns issuing only the bounded probe, and friendly timeout handling.
- TypeScript and changed-path lint pass after corrections. Final source hashes
  replace the original source-manifest; initial receipt is not the final verdict.

## Final browser rerun

All prior browser checks passed on the corrected snapshot. The raw fixture now
includes Month/Total helper columns and still renders the original daily view.
An additional numeric-label fixture proves chart series colors stay matched to
the table. No page errors, console errors or framework overlays. Temporary
fixture removed and the task-owned local server stopped after verification.
