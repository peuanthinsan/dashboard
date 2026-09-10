# Shared UnitStatus reference template

Base: `0500e3fc29dc4d9bb7fa4950e7628f78d6b60d1f`
Patch SHA-256: `a17b6283534b5a01b7873e38865f2b55de9d58f962815a5f12eafbefe257623d`

Active root: Codex; root model/effort surface not verified (UNKNOWN).
Opposite-provider lane: read-only Claude Fable/high, named hybrid-fable-reviewer.
Writer lease: root owns integration; all delegated edits completed; four source paths frozen.

## Scope

- `app/dashboards/UnitStatusDashboard.tsx`
- `app/dashboards/unitStatusData.ts`
- `app/dashboards/unitStatusData.test.ts`
- `docs/METRICS.md`

Implement shared UnitStatus using the supplied HTML layout and source spreadsheet semantics: compact GPS, paginated damage, per-fleet checklist completion, search/customer/fleet panels; dense sortable equipment matrix; immediate adjacent details, desktop/mobile; preserve all existing raw diagnostics/filters and exact company/fleet authorization. BIGTH nine checks are eight named cameras plus Seat Vibrator, not nine physical channels. Other fleets use explicit per-unit equipment requirements, uniquely matched CH metadata, or VSS inventory. Missing positions blank; unknown expected counts remain unknown; no invented camera-to-BSD mapping. Intercom always Online; Seat/Cabin default Online only when unreported, visibly disclosed. GPS uses Bangkok report time <=10min, missing/invalid/future Unknown. Storage NonExist and AI Not Working fail. Reverse BSD damage only while GPSonline and speed>0. Inferred geofence requires full proven camera roster all offline; mark inferred and preserve independent non-camera failures. Never broaden company matching based on HTML substring logic. Source CSV/HTML is private and excluded from this review. Source has no independent Seat/Cabin trigger, no geofence and no expected counts; counts for smaller fleets cannot be guessed from current recording. Broad sheets carry blank BSD headers; these must not impose nine. VSS zero/sparse authoritative installed masks exclude phantom flattened names. Explicit numeric equipment requirements retain physical identity even with friendly names. VSS camera named Cabin must still count toward physical inventory. Preserve original 62 regression tests.

## Verification

All 89 targeted unitStatusData tests pass; final tsc --noEmit --incremental false passes; focused ESLint and git diff --check pass. Browser proof: 300 synthetic vehicles with 9/5/4/2 expectations yield correct complete/waiting totals, sparse mask camera1/4 with other slots blank, adjacent details immediately next tr on desktop1440x1000 and mobile390x844 without body overflow. Fleet filters/search/sort/reset verified and summary totals remain300. Source-backed previews load exact BIGTH125, ALCHEM40, Vinythai6 with no current browser errors; BIGTH91complete9/9 and34waiting, smaller cohorts unknown expected counts honestly. Damage pagination 1-5 then6-10 verified. Original HTML browser URL was blocked and was not bypassed; design read as source text, browser tested trusted React implementation in a local isolated worktree. Production will use existing CI SHA-gated main deployment, not preview fixtures.

## Authorization and boundaries

User approved the scoped four-file private code review and deployment earlier in this task. Review payload excludes original HTML, raw spreadsheets, vehicle records, secrets and unrelated repository contents. Reviewer must not edit, run tools, alter git state, commit, push, merge or deploy. Root owns all integration. User requested “try again” while final verification was in progress; continue the same task.

## Approval boundary

Automatic approval review rejected the external Claude command twice. After the first rejection the root verified the earlier explicit review question and subsequent user “go ahesd” through read_thread. The reviewer still required explicit approval for this current payload and destination. No command ran and no code was exported. A concise approval-or-waiver request is pending. Do not retry or use another route without resolving this boundary.

Additional browser checks passed: failed-check selection narrows 300 vehicles to the one reported Rear Left failure, Reset restores the cohort, clicking the damage entry selects that vehicle and opens its adjacent detail row. Both default-status disclosures render. Fresh preview has zero browser errors/warnings.

## Details refinement and final local review

The user asked for useful details without repeating the table. The panel now leads with report context, actual issues and conditional diagnostic suggestions, equipment configuration, and template assumptions. Full telemetry and legacy checks remain in a collapsed disclosure. A user-triggered clipboard action copies a diagnostic summary without sending a message.

Final local review passed after the Cabin identity and Reverse BSD wording fixes. All 89 targeted tests, TypeScript, focused lint, and browser checks passed. See receipt.md for exact evidence, boundaries, and the running local preview. Four source paths are frozen again. External review authorization or waiver remains pending; no production release has occurred for this revision.

## Explicit authorization received

The user replied “continue approved” on 2026-09-10 to the pending four-file Claude review and deployment continuation. This resolves the export approval boundary for the current scoped source/patch payload. Continue with the named read-only Claude review, then the normal CI deployment after a passing receipt. The original HTML, raw spreadsheet records, credentials, and unrelated files remain excluded.

## Review completed

Claude Fable/high returned PASS for the exact frozen four-file patch. Surface model was claude-fable-5; no fallback or reviewer tools were used. The source hashes were rechecked before integration. Earlier approval-boundary notes describe resolved history; the user approved and release can now continue. See claude-review.md and receipt.md.
