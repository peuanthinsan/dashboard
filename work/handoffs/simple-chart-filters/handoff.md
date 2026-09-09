# Monthly comparison chart filters

Objective: match Detail dashboard monthly alert totals chart with independent
chart-local alert-type and month controls. User explicitly requested the
monthly comparison to work like the monthly daily trend.
Root: Codex, model/effort UNKNOWN. Lane: opposite-provider read-only review.
Base SHA: c8dc2a25aa6507690034b9555e02ba7491e8f50d.
Allowed source: app/dashboards/SimpleMonthlyDashboard.tsx; dependencies may be
read to verify this change. Root owns all edits. No agent may mutate source,
git, configuration, environment, database, production, or deploy/publish.
Prior WIP: work/handoffs/simple-monthly-summary/ receipt/handoff/state changes.

Acceptance:
- One red total bar per month, same sizing and local pill controls as Detail.
- All sheet alert types are offered within the page's global data scope.
- Chart-only type/month changes do not alter KPIs, table or CSV exports.
- Zero-count months remain. Existing month toggle helpers preserve at least one
  month by resetting all when the last explicit month is deselected.
- Global filter changes reset chart-local selections, and stale type fallback
  is All. null is the All sentinel so a type literally named all remains valid.
- Summary parser/fetch routing and existing raw dashboards remain untouched.
- TypeScript and single changed-file ESLint pass. Browser checks underway.

Frozen source SHA-256: 6a51480a6f648605612bde37add2cc2bf41b447547477a58699698dd4e7ecb76.
Required review: inspect the single changed file against reference Detail's
monthly section and reused helper semantics. Return concise actionable findings
and PASS/FAIL receipt; root will write it. No delegation or mutations.
