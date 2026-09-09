# Review and verification receipt

**Surface model: Fable 5 (claude-fable-5), Fable/high review lane.**

All acceptance items verified against source:

- **Isolation holds.** `chartTypeFilter`/`chartMonthFilters` feed only `chartData` (SimpleMonthlyDashboard.tsx:74-80) and pill state. KPIs (127-129), `tableRows` (81-85), and `ExportButton` data (110) depend solely on `comparison` from global filters; `activeFilterCount` (54) excludes chart-local state.
- **Zero-count months remain.** `buildSimpleSummaryComparison` (simpleSummaryData.ts:133-157) keeps every month present in records; `chartData` defaults to 0 (line 78). BarMode renders a zero-height bar with label.
- **Month helpers correct.** `toggleTrendMonthFilter` (detailTrendData.ts:110) returns `[]` when the last month is deselected; `resolveSelectedTrendMonths` (79-86) treats `[]`/fully-stale as all.
- **Reset + sentinel.** Both global `MultiSelect` handlers call `resetChartFilters()` (122-123); stale type falls back to All via membership check (63-64); `null` sentinel keeps a type literally named "all" valid.
- **Detail parity.** TrendChart props (169-175) match DetailDashboard.tsx:1226-1240 exactly, including `MONTHLY_CHART_COLORS=[CHART_COLORS[0]]`.

**Findings (minor, non-blocking):**
1. SimpleMonthlyDashboard.tsx:169 — `key={JSON.stringify([...])}` fully remounts TrendChart on every pill/global-filter click. Detail has no such key. Harmless but unnecessary churn; parity deviation.
2. Line 161 — month pills omit Detail's `inline-flex items-center` (DetailDashboard.tsx:1204). Cosmetic only.
3. Stale `chartTypeFilter` is displayed-as-All but retained in state; if the type reappears after refresh it silently re-activates. Arguably intended.

**Accepted limitations:** frozen SHA-256 and "only file changed" not independently verified (no shell/git tools granted); browser checks remain with root.

```text
Review route: Fable primary
Requested reviewer: Fable/high
Base ref: c8dc2a25aa6507690034b9555e02ba7491e8f50d
Reviewed patch or SHA: app/dashboards/SimpleMonthlyDashboard.tsx (frozen SHA-256 6a51480a…ecb76, unhashed locally)
Verdict: PASS
Findings: 3 minor (chart remount key L169; pill class parity L161; retained stale chartTypeFilter) — none blocking
Verification commands: none run (Read/Grep only; no shell granted)
Git actions: none
Deployment actions: none
```

Root verification (Codex; model/effort UNKNOWN):
- Only production change: SimpleMonthlyDashboard.tsx. Frozen SHA verified.
- Changed-file ESLint, TypeScript no-emit, git diff --check: pass.
- Browser plugin and agent-browser CLI unavailable; used installed Playwright.
- Temporary development fixture at localhost:3001/e2e-fixtures/simple-chart-qa;
  a stale dev route initially returned 404; restarting the server fixed it.
- Desktop 1440x1100, mobile 390x844: all targeted browser checks pass.
- Initial red bars 888/2073/203. All 12 sheet types offered in chart controls.
- Mobile Phone bars 77/138/18; chart month selection hides only corresponding
  bars. Table and KPI remain unchanged at global totals 3164 / 3 months / 12 types.
- CSV after chart filtering still includes all three months/all 12 types and
  total 3164. Type tooltip accurately reads Jul 2026 / Mobile Phone / 138.
- Storage Error bars 2/0/0; last month deselection resets all months.
- Global Fatigue filter resets local selections and produces 2/30/4, KPI 36.
- Mobile page width equals viewport 390; chart scrolls 360px within 324px.
- No app console errors, runtime errors, framework overlay, or page overflow.
- Screenshots: /tmp/simple-chart-filters-all.png, simple-chart-filters-phone.png,
  simple-chart-filters-mobile.png. Script /tmp/simple-chart-filters-qa.cjs.
- Temporary fixture removed after QA; no env/database/production edits, commits
  or deployments by this task.
- Kept chart key intentionally: remount clears any tooltip from the prior filter.
- No new mirrored unit tests for this UI-only change; data/month helpers unchanged.
