# Monthly alert breakdown review handoff

## Objective and lane

- Requested lane: `review`
- Objective: review the uncommitted Codex implementation that adds a chart-local
  monthly comparison view to the Detail dashboard's Daily alert trend.
- Active user-facing root: Codex
- Delegated provider: Claude Code 2.1.247
- Observed model: `UNKNOWN`
- Observed effort: `UNKNOWN`

## Frozen source state

- Base ref: `cc48d6623df598cd1bbf4ce02cce9e684b265675`
- Branch: `main`
- Review artifact: the current working-tree diff plus the two untracked files
  listed below. Any source edit after delegation invalidates this review.
- Source writer lease: Codex root. Claude is read-only for source code and may
  write only `work/handoffs/monthly-alert-breakdown/receipt.md`.

Read-only review paths:

- `app/dashboards/DetailDashboard.tsx`
- `app/dashboards/detailTrendData.ts`
- `app/dashboards/detailTrendData.test.ts`
- `app/ui/TrendChart.tsx`
- Direct dependencies needed to understand those files may also be read.

## Scope and acceptance criteria

The implementation should:

1. Preserve the existing chronological Timeline as the default.
2. Add a chart-local `Compare months` view that groups daily bars side-by-side
   by day of month.
3. Keep the global date range and dashboard filters as the data scope; month
   chips and alert-type chips must affect only this chart.
4. Give every month in the supported 24-month range a stable, distinct color,
   with textual labels so color is not the only cue.
5. Keep partial/out-of-range/invalid calendar cells absent rather than falsely
   reporting zero; use zero only for eligible dates with no matching alerts.
6. Preserve month order and color when filters or visible-month selections
   change, and reconcile stale persisted selections safely.
7. Keep mobile controls wrapped and the dense chart horizontally scrollable.
8. Avoid relevant runtime warnings/errors and avoid regressions for existing
   TrendChart callers.

## Evidence already collected

- `npm test -- app/dashboards/detailTrendData.test.ts`: 9/9 passed.
- Targeted ESLint on the four paths: 0 errors; four pre-existing warnings in
  `DetailDashboard.tsx` remain.
- `npx tsc --noEmit --pretty false --incremental false`: passed.
- `git diff --check`: passed.
- Rendered local QA with a gated temporary fixture (removed afterward):
  desktop and 390x844 mobile; July/August bars used two stable colors; hiding
  July preserved August's color and left the Total alerts KPI unchanged;
  Mobile Phone filtering recomputed both month series; tooltip rows named both
  months and omitted the cross-period total; mobile page had no horizontal
  overflow and the chart scroller moved from `scrollLeft=0` to `420`; no final
  console warnings/errors.

## Permission boundaries and required output

- Do not edit source files, tests, configuration, environment files, database
  targets, or production state.
- Do not commit, push, merge, deploy, install dependencies, or run broad test
  suites.
- Write only `work/handoffs/monthly-alert-breakdown/receipt.md`.
- The receipt must record provider/model/effort, files read, checks run (if any),
  assumptions, actionable findings with severity and file/line evidence,
  unresolved risks, and whether the patch is ready for integration.
