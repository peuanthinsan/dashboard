# Claude review receipt

Provider: Claude
Surface-reported model: `claude-fable-5`
Requested effort: high
Route: Fable primary; no fallback
Raw response SHA-256: `137e8beb9ab650791f20c3d39fb55d8dd97a7fda40c281b9bb26378260169100`

I reviewed the frozen four-file patch as supplied text, read-only, with no tool execution per your instruction. I attempted to falsify each stated requirement against the patch and the supplied model source. Summary: **no blocking correctness, authorization, source-semantics, regression, or rendering defect found.** Details of the falsification attempts that came closest, then the verdict block.

## Falsification attempts that did not produce defects

**Time semantics (Bangkok-as-UTC invariant #2).** `monitorGpsStatus` (`unitStatusData.ts`) and `reportAgeLabel` (`UnitStatusDashboard.tsx`) both compare `now.getTime() + 7h` against `parseDate(...)` output. Since `parseDate` stamps Bangkok wall-clock digits into a UTC instant, adding the 7-hour offset to the real UTC clock puts both sides in the same clock domain. This matches the pre-existing `nowWallClockMs` in `buildUnitRows`. The ≤10-minute boundary is inclusive-online, negative age (future) and unparseable values are Unknown — matching "missing/invalid/future Unknown." The `observationTime = max(now, lastUpdated)` memo closes the transient false-future gap between fetch receipt and the 30-second display tick, and is threaded consistently into `buildUnitRows`, `buildUnitMonitorRows`, and `UnitDetails`. No inconsistency found.

**BIGTH nine = eight named cameras + Seat Vibrator, not nine channels.** `MONITOR_EQUIPMENT` is exactly that list; the nine-default (`requiredPositions === 9 → requiredKeys = MONITOR_EQUIPMENT keys`) applies only when `bsdLayout` is true, which requires an exact normalized `bigth` company or username token — `BIGTHMCS`/`MyBIGTH` are rejected by exact-token comparison, and the test covers it. No substring/HTML-derived broadening exists anywhere in the matching path; `buildUnitRows` company/fleet authorization is untouched.

**No invented camera→BSD mapping.** In `buildUnitMonitorRows`, numeric channels promote to named keys only via a unique literal `channelname`/`RAW_CAMERA_NAMES` match (`rawNames.filter(...).length === 1`), and never when the numeric key is itself explicitly required (`!source.requiredKeys?.includes(check.key)`). I traced the friendly-name tests (Camera1 named "Cabin", named "Intercom", `Front;;;AI`) through the code by hand; each keeps its physical `cN` identity, is counted once, and forced-online Intercom survives. The blank-BSD-headers case yields `present:false` positions and `requiredPositions: null` for non-BIGTH — headers do not impose nine.

**Geofence inference guards.** Inference requires `requiredPositions !== null && installed.length === requiredPositions && cameras.length > 0 && cameras.every(offline)`, so unknown/missing positions, unmapped required tokens (which inflate the denominator via `expectedPositions`), zero-camera configs (mask 0), and an explicit `outside` value all block it. Seat Vibrator (non-camera) failures and storage/AI failures survive suppression in `getUnitMonitorDamage`. Camera damage suppression plus the `displayStatus:'inactive'` dash is disclosed in both badge and details note, and raw values persist in the collapsed telemetry.

**Reverse BSD gate.** Damage requires `gpsStatus === 'online' && Number(speed) > 0`; the details panel shows the "assessment pending" note (not "no failure") when parked/offline/unreported speed and not geofenced — matching the latest request. `Number('') → NaN` paths are shielded by `isReportedValue`.

**Storage/AI failure semantics.** `monitorStorageStatus` makes any `NonExist` disk offline, all-Exist online, blank unknown; `statusAi` treats `AI Not Working` as offline, other reported alerts online, blank unknown; explicit `Status AI`/`Device Status` columns — including explicit blank → Unknown — take precedence. Device-status offline deduplicates against an existing storage damage entry.

**Regression preservation.** The test diff is purely additive after line 706 plus import additions; the original 62 tests and their imports (`buildInstallRows`, `getUnitCameraChecks`, `getUnitChecks`, `readUnitHealth`) are untouched, and those exports remain in `unitStatusData.ts`. `buildUnitRows`'s signature is unchanged (only the new `monitorSource` field is added), so legacy call sites are unaffected. All removed dashboard imports (`KpiCard`, `heading2`, table tokens, `dashboardSectionClass`, `getUnitCameraChecks`, `buildInstallRows`, `PRIMARY_CHECKS`) have no remaining references in the new component body.

**Details rewrite (latest request).** Report age/movement/context, source-backed issue cards with conditional suggestions (`issueExplanation`), setup/assumption disclosures, collapsed raw telemetry that reproduces the legacy `getUnitChecks` values, unreported-fields toggle, and clipboard-only copy with success/failure feedback (guarded `navigator.clipboard?.writeText`, try/catch, `aria-live` status) are all present. Nothing composes or sends a message; nothing invents history or confirmed locations.

**Rendering/state.** Sort comparator keeps nulls last in both directions with a stable vehicle tiebreak; `damagePage` is clamped against shrinking entry lists; `focusDamageUnit`'s `reset()`-then-set sequence batches correctly (last `setExpanded` wins); expanded details reuse the proven `sticky left-0 w-[100cqw]` container pattern; per-row `checks` objects are freshly constructed per `buildUnitMonitorRows` call, so the `displayStatus` mutation cannot leak across renders.

## Verification limits

- Source CSV/HTML reference is private and excluded, per instruction — reference-fidelity claims (panel layout, 125/40/6 cohort numbers) rest on the root's browser evidence, not on my inspection.
- Tools were disabled: I could not recompute the patch SHA-256, verify the base ref exists, run the 89 tests, `tsc`, or ESLint. Those pass/fail claims are accepted as root-supplied evidence, consistent with what the patch text supports.
- `sourceRow`/`cameraRow`/`noScope`/`now` test fixtures live in the unchanged test region and were not visible; my traces assume `now` = 2026-09-09 12:00:00 Bangkok, which the boundary assertions corroborate.

```text
Review route: Fable primary
Requested reviewer: Fable/high
Base ref: 0500e3fc29dc4d9bb7fa4950e7628f78d6b60d1f
Reviewed patch or SHA: patch SHA-256 a17b6283534b5a01b7873e38865f2b55de9d58f962815a5f12eafbefe257623d (four files: app/dashboards/UnitStatusDashboard.tsx, app/dashboards/unitStatusData.ts, app/dashboards/unitStatusData.test.ts, docs/METRICS.md)
Verdict: PASS
Findings: No concrete correctness, authorization, source-semantics, regression, or rendering defect identified. Company/BIGTH matching is exact-token only; nine-position default is checklist-based, never channel-based; geofence inference requires a complete proven camera roster; Reverse BSD damage is gated on online GPS and positive speed; explicit blanks stay Unknown; original 62 tests are untouched and their exports retained; details rewrite is clipboard-only with disclosed assumptions and preserved raw telemetry.
Verification commands: none executed — tools disabled by request; review performed by static analysis of the supplied frozen patch and model source; test/tsc/ESLint/browser results accepted as root-supplied evidence.
Git actions: none
Deployment actions: none
```
