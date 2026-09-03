# Monthly alert totals review handoff

## Objective and lane

- Requested lane: `review`
- Objective: review the uncommitted Codex follow-up that replaces the Detail
  dashboard's day-by-month comparison with one total-alert bar per month and
  derives the complete month domain from the active global date range.
- Active user-facing root: Codex
- Delegated provider: Claude Code 2.1.252
- Observed model: `UNKNOWN`
- Observed effort: `UNKNOWN`

## Frozen source state

- Base ref: `336af20282bb430d108163c983e0ddac3511ea5a`
- Branch: `main`
- Review artifact: the current working-tree diff and untracked QA report listed
  below, including the 2026-09-03 range-domain correction.
- The prior `monthly-alert-breakdown` receipt covers an obsolete design and is
  invalid for this follow-up.
- Source writer lease: Codex root. Claude is read-only for source and may write
  only `work/handoffs/monthly-alert-totals/receipt.md`.

Read-only review paths:

- `app/dashboards/DetailDashboard.tsx`
- `app/dashboards/detailTrendData.ts`
- `app/dashboards/detailTrendData.test.ts`
- `app/ui/TrendChart.tsx`
- `app/ui/TrendChart.test.ts`
- `design-qa.md`
- Direct dependencies needed to understand these files may also be read.

Out of scope and owned by the user:

- `package.json`
- `bun.lock`

## Scope and acceptance criteria

The implementation should:

1. Aggregate all eligible alerts into one chronological total per selected
   month, retaining selected zero-alert months.
2. Render one vertical bar for every calendar month intersecting the active
   date range, in chronological order, with evenly spaced
   `0 / 10 / 20 / 30`-style ticks. February 2026 through January 2027 is only a
   representative QA fixture, never a hard-coded production domain.
3. Use a single alert-red color, with no month-color legend or per-month dots.
4. Show only the hovered month's label and total in the tooltip.
5. Retain chart-local alert-type and month pills; they must not change page
   KPIs or unrelated dashboard content.
6. Preserve readable desktop side-by-side comparison and contained horizontal
   scrolling at narrow widths.
7. Preserve semantic chart data for assistive technology and avoid regressions
   for generic single- and multi-series `TrendChart` callers.
8. Use the exact date-range start/end timestamps to determine eligible alert
   rows while retaining zero-count partial boundary months.
9. Clear chart-local month selections when the global date range changes so
   newly introduced range months are visible by default.

## Evidence already collected

- `npm test -- app/dashboards/detailTrendData.test.ts app/dashboards/dateTimeRange.test.ts app/ui/TrendChart.test.ts`:
  21/21 passed across three files.
- Targeted ESLint on the five changed production/test paths: 0 errors; four
  pre-existing warnings in `DetailDashboard.tsx`.
- `npx tsc --noEmit --pretty false --incremental false`: passed.
- `git diff --check`: passed.
- Browser-rendered production-component QA used temporary environment-gated
  fixtures, removed after capture. Final 12-month component evidence:
  `/private/tmp/monthly-alert-totals-final-component.png`; final integrated
  dashboard evidence: `/private/tmp/monthly-alert-totals-final-dashboard.png`;
  deselected-month evidence:
  `/private/tmp/monthly-alert-totals-final-integrated.png`; sparse mobile
  evidence: `/private/tmp/monthly-alert-low-count-mobile.png`.
- Verified full totals `0,2,0,5,4,28,12,0,7,0,3,6`; Fatigue totals
  `0,1,0,2,1,9,4,0,2,0,1,2`; KPI remained `67`; July selection removed only
  July; July tooltip was `Jul 2026 / Alerts / 28` and `... / 9` when filtered.
- Desktop measured 12 labels with `scrollWidth = clientWidth = 1168px`;
  mobile measured a contained `1152px` SVG inside a `318px` chart scroller.
- Final console contained no application errors.
- Range-domain tests now cover partial boundary months, cross-year chronological
  ordering, Thai labels, and invalid/incomplete ranges. Existing date-range
  tests cover exact inclusive timestamps and the 24-month safety cap.
- The prior independent Codex fallback verdict is stale after this correction;
  a fresh current-snapshot review has been requested.

## Permission boundaries and required output

- Do not edit source, tests, QA report, configuration, environment files,
  database targets, or production state.
- Do not commit, push, pull, merge, deploy, install dependencies, or run broad
  test suites.
- Write only `work/handoffs/monthly-alert-totals/receipt.md`.
- Record provider/model/effort, files read, checks run (if any), assumptions,
  findings ordered by severity with file/line evidence, unresolved risks, and
  integration readiness.
