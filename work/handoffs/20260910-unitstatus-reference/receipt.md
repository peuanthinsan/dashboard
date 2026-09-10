# UnitStatus verification receipt

Base: `0500e3fc29dc4d9bb7fa4950e7628f78d6b60d1f`
Four-file patch SHA-256: `a17b6283534b5a01b7873e38865f2b55de9d58f962815a5f12eafbefe257623d`

## Ownership and scope

Codex is the active root. Root model and effort were not verified by the surface (UNKNOWN). The four implementation paths are UnitStatusDashboard.tsx, unitStatusData.ts, unitStatusData.test.ts, and docs/METRICS.md. Delegated edits are complete and root owns integration. Existing unrelated Simple dashboard changes were committed by another task before this patch was frozen.

## Verification

- All 89 targeted model tests pass, including the original 62 regressions.
- Final TypeScript, focused ESLint, and git diff --check pass. Broad tests remain assigned to CI under the repository agreement.
- Source previews load exactly 125 BIGTH, 40 ALCHEM, and 6 Vinythai vehicles. Smaller fleets without an expected count show unknown completion rather than an invented count.
- A 300-vehicle fixture covers 9, 5, 4, and 2 required positions, sparse VSS inventory, blank unused cells, search, fleet filtering, sorting, reset, damage pagination, and adjacent details.
- The diagnostic panel shrank from 1,014 to 395.75 pixels for one camera fault at 1440 by 1000. At 390 by 844, the body is 384 pixels wide and the detail panel is 358 pixels wide, without horizontal body overflow.
- Raw telemetry starts collapsed. The optional unreported-fields control preserves all 43 fields in the test case, including 26 missing values hidden by default. Copy diagnostic summary waits for clipboard success and provides accessible feedback.
- Missing timestamps and configuration, stale Storage NonExist, inferred geofence, duplicate recording, and parked Reverse BSD at 8/9 have explicit explanations. Fresh receipt time prevents transient false future timestamps; refresh preserves the expanded vehicle.
- Independent Codex review: PASS after correcting physical Cabin identity/deduplication, shared blank BSD headers, and suppressed Reverse BSD wording. No remaining concrete findings in the final recheck.
- Fresh browser previews have no error or warning logs. This is local verification, not a claim of full accessibility compliance or confirmed physical hardware condition.

## External review and release boundary

The user explicitly authorized the scoped review and continuation with “continue approved” on 2026-09-10. Claude completed its read-only review with PASS and no findings. The surface reported `claude-fable-5`; requested effort was high, route Fable primary, no fallback. The receipt matches the exact base and four-file patch hash above. See claude-review.md for the complete returned review and its limits.

The review payload excluded the HTML attachment, spreadsheets, real vehicle records, credentials, and unrelated repository contents. No environment, database, source-sheet, or production configuration changes were made. The existing SHA-gated CI deployment is the authorized release route; commit/push and live verification follow this receipt.

## Local preview

The isolated preview runs at http://127.0.0.1:3013/e2e-fixtures/unitstatus-template?mode=mixed and remains available for user inspection. Server session: 55285. Worktree: /private/tmp/songdee-unitstatus-template-20260910. Its fixture routes, local Next.js configuration, and hook interception must never enter the production patch.

Screenshot/audit directory: /private/tmp/unitstatus-details-audit-20260910. Frozen patch, hashes, and pending review transport: /private/tmp/unitstatus-reference-review-20260910. These private transport files are not staged.

## Authorized release baseline

The user explicitly approved continuing the pending scoped Claude review and deployment on 2026-09-10. The command was accepted and the read-only review passed. Root verified remote main still equals the frozen base, whose CI deployment succeeded. Current live configured dashboards load ALCHEM 40, Vinythai 6, and BIGTH 122. The reference source preview count of 125 for BIGTH is from the supplied reference tab, not the configured live source; no source configuration was changed.
