# Initial review — superseded by corrections

Review complete. Here is the receipt and findings.

## Review receipt — Simple monthly summary (frozen)

**Reviewer:** Claude, model surface-verified `claude-fable-5`; effort requested high (surface did not expose an effort value → UNKNOWN per WORKSPACE.md). Lane: read-only opposite-provider review of Codex implementation.
**Base ref:** `6bf0c5bce69390ebb76548622366fe88bd216b4a` (from handoff.md; this session has no Bash/git tool, so the base tree and manifest hashes could not be independently verified — see verification commands).

**Files read (manifest):** `SimpleDashboard.tsx`, `RawSimpleDashboard.tsx` (head, export/props/import surface), `SimpleMonthlyDashboard.tsx`, `simpleSummaryData.ts` + test, `simpleSheetFetch.ts` + test, `useSimpleSheet.ts`, `app/dashboard/DashboardCard.tsx` (targeted grep).
**Dependencies read:** `googleSheetParse.ts`, `googleSheetGvizUrl.ts`, `app/ui/MultiSelect.tsx`, `app/ui/ExportButton.tsx` (props), `app/ui/TrendChart.tsx` (props, grep), `app/dashboard/[id]/page.tsx:60-119`, `app/e2e-fixtures/simple-summary-qa/page.tsx` (security spot-check only; excluded from findings as instructed — it is correctly dev-gated via `notFound()` at line 6).

### Acceptance coverage — verified

- **All types included, counts summed not row-counted:** `simpleSummaryData.ts:95-103` sums `จำนวนสรุป`; test locks total 3164 and monthly 888/2073/203 against the real 28-row sheet including `False alert`, `Maintenance`, `Storage Error` (`simpleSummaryData.test.ts:46-59`). Dynamic future types covered (`test.ts:74-85`).
- **Default all months/types; filters drive bars/table/export/KPIs together:** empty selection = all (`simpleSummaryData.ts:121-122`); chart, table rows, export data, and KPI totals all derive from the single `comparison` memo (`SimpleMonthlyDashboard.tsx:43-61,85,102`), so they cannot disagree.
- **Zero-filled missing pairs:** `simpleSummaryData.ts:129-131`; tested (`test.ts:139-149`). `typeTotals` correctly respects the month filter (`:133-138`).
- **Explicit invalid-data errors, no partial totals:** every failure path returns empty records plus a row-numbered message (`simpleSummaryData.ts:32-34,81-98`); overflow past `Number.MAX_SAFE_INTEGER` rejected. Broad invalid-input tests including prototype-key safety (`test.ts:168-184`).
- **Bounded probe + fallback + cancellation:** 5 s probe / 30 s full fetch via `AbortSignal.any` (`simpleSheetFetch.ts:12,23,33`); caller abort is rethrown, never mistaken for a raw fallback (`:24-30`); post-detection failures stay visible instead of silently going raw. The 17 fetch tests cover every branch I could falsify, including abort-during-body-read.
- **Raw preservation:** wrapper delegates untouched props to `RawSimpleDashboard` (`SimpleDashboard.tsx:14`); raw CSV filename `"SimpleDashboard"` unchanged (`RawSimpleDashboard.tsx:589`). Detection rejects partial schemas, extra count columns, and raw headers (`test.ts:99-108`); duplicate header labels fall back to raw via the exactly-one-match rule (`simpleSummaryData.ts:50-54` with `assignUniqueFieldKeys` keeping labels intact).

### Findings (ordered by severity)

1. **Medium — summary false positive on a raw sheet is expensive and has no escape hatch.** Aliases are deliberately broad: `type`/`alert type`, `total`/`count`, `month` (`simpleSummaryData.ts:24-28`). Every raw alert sheet already has `Alert Type` (`googleSheetGvizUrl.ts:33`). If a customer adds two helper columns named e.g. `Month` and `Total` to a raw sheet — a common spreadsheet habit — detection flips to summary, the full fetch then pulls the entire raw sheet with **no row cap, column pruning, or date window** (`simpleSheetFetch.ts:31-33`, comment assumes "summary sheets are already small"; raw sheets run to 25k–50k rows), and the dashboard replaces a working raw view with a hard validation error on data row 1. Acceptance #1 ("raw sheets retain the original Simple behavior") does not hold for that header shape. Follow-up suggestion (not a rewrite): add a modest row cap to the full summary fetch and/or tighten detection (e.g. require at least one exact Thai header, or reject when known raw columns like `Alert Date Time`/`Vehicle No` are also present).
2. **Low — probe latency regression for every legacy raw dashboard.** Each mount now serializes a client-side header probe (up to 5 s on a hang) before `RawSimpleDashboard` mounts and starts its own loading (`SimpleDashboard.tsx:13-24`, `simpleSheetFetch.ts:23`); the probe result is not cached per source, and Refresh in summary mode re-pays both requests. Accepted trade-off per the frozen design, but it is a visible behavior change on existing dashboards and produces a brief double loading-shell flash.
3. **Low — error-message usability.** (a) A 30 s timeout of the full summary fetch rejects with the raw `TimeoutError` DOMException; `useSimpleSheet.ts:17` only substitutes friendly copy for non-`Error` causes, so users see browser-dependent text like "signal timed out" instead of the "Check sheet access and retry" copy at `simpleSheetFetch.ts:14`. (b) All fetch/parse error strings are English-only while the rest of the dashboard is bilingual (`simpleSummaryData.ts:66-97`) — Thai-language dashboards get English validation errors.
4. **Info — row numbers can be off by one** when GViz echoes the header as data row 0: `googleSheetParse.ts:51` trims it, but `Row ${index + 2}` (`simpleSummaryData.ts:82`) then points one row high.
5. **Info — per-dashboard raw config silently ignored in summary mode.** `allowedAlertTypes`, `alertRules`, `organizationNames` pass through the spread but do nothing (`SimpleMonthlyDashboard.tsx:38-39`). Deliberate and documented (acceptance #5), but an admin who configures rules on a summary-backed dashboard gets no indication.
6. **Info — locale-dependent type ordering.** `localeCompare` with no fixed locale (`simpleSummaryData.ts:107,127`) can order types differently across browsers (column order/colors vary by viewer, not wrong data). A purely numeric alert-type label would additionally be hoisted by JS integer-key ordering in `counts` objects, misaligning chart colors (`SimpleMonthlyDashboard.tsx:54-56`). Cosmetic.
7. **Process — two claims unverifiable in this session** (no git tooling exposed): the byte-for-byte `SimpleDashboard` → `RawSimpleDashboard` copy, and manifest-hash freeze integrity. Commands for the Haiku root below. `MultiSelect` is base-committed (the pre-copy dashboard already imports it, `RawSimpleDashboard.tsx:45`) and the summary dashboard uses only the base prop surface, not the WIP `selectionMode` — confirm at integration since that file carries excluded WIP.

**Assumptions:** working-tree files match the manifest hashes; base-SHA `MultiSelect`/`TrendChart`/`ExportButton` match their current committed surfaces (all invoked props exist in the working tree; handoff reports tsc green); reported test/lint/tsc results are accurate.
**Risks:** finding 1 is the only path by which an existing customer dashboard degrades, and it depends on customer sheet headers we cannot enumerate from here; findings 2–3 are minor UX costs on the legacy path.
**Readiness:** Ready to land once the root verifies the two process items (byte-for-byte copy hash, manifest integrity) and the temporary QA fixture is dropped from the landing set. Findings 1–3 are recommended follow-ups, not blockers; any source change to address them invalidates this receipt.

```text
Review route: Fable primary
Requested reviewer: Fable/high
Base ref: 6bf0c5bce69390ebb76548622366fe88bd216b4a
Reviewed patch or SHA: frozen working-tree snapshot per work/handoffs/simple-monthly-summary/source-manifest.txt (9 files, SHA-256 pinned)
Verdict: PASS
Findings:
1. MEDIUM simpleSummaryData.ts:24-28 + simpleSheetFetch.ts:31-33 — broad Month/Type/Total aliases can misdetect a raw sheet with helper columns as summary; full fetch is then uncapped and the working raw dashboard becomes a hard error; no force-raw escape hatch.
2. LOW SimpleDashboard.tsx:13-24, simpleSheetFetch.ts:23 — uncached serialized probe adds up to 5 s before every legacy raw dashboard mounts; double loading-shell flash.
3. LOW useSimpleSheet.ts:17, simpleSummaryData.ts:66-97 — full-fetch timeout surfaces raw DOMException text; all validation/fetch errors are English-only on bilingual dashboards.
4. INFO simpleSummaryData.ts:82 vs googleSheetParse.ts:51 — row-number errors off by one when a duplicated header row is trimmed.
5. INFO SimpleMonthlyDashboard.tsx:38-39 — raw scoping config silently inert in summary mode (documented/intended; no admin indication).
6. INFO simpleSummaryData.ts:107,127; SimpleMonthlyDashboard.tsx:54-56 — locale-dependent type ordering; numeric-only labels could misalign chart colors.
7. PROCESS — byte-for-byte RawSimpleDashboard copy and manifest freeze not verifiable without git in this session; verify before landing.
Verification commands:
- git --no-optional-locks show 6bf0c5bce69390ebb76548622366fe88bd216b4a:app/dashboards/SimpleDashboard.tsx | shasum -a 256   # expect d5d5c3e33165a664151e1b4f798b272777c56030195d1fee6e6cee641385ae0f
- shasum -a 256 -c work/handoffs/simple-monthly-summary/source-manifest.txt
- git --no-optional-locks diff --no-ext-diff --no-textconv 6bf0c5bce69390ebb76548622366fe88bd216b4a -- app/dashboards app/dashboard/DashboardCard.tsx
Git actions: none
Deployment actions: none
```