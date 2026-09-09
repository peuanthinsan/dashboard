Provider: Claude
Surface-reported model: claude-fable-5
Requested effort: high (CLI)
Raw receipt SHA256: 8bbc87935b27f5c363a465f792f47b3668b5027d68eac14d03d3d176a48904a7

Using no tools, per the review mandate: this is a bounded source-only review of the frozen patch against the four provided files. I did not run tests, lint, git, or browsers, and I do not re-claim the validation the root already recorded.

# Review receipt — shared UnitStatus (Codex patch)

**Verdict: PASS** (no blocking finding; four low-severity, actionable notes below)

## What I checked, and how it holds up

**Status correctness.** `readOverallStatus` (unitStatusData.ts, new function after `getUnitChecks`) enforces the agreed precedence: stale update / GPS offline / Device Status offline → Offline; any reported offline check → Warning; missing GPS or missing installed-camera health → Unknown; only fully reported checks → Healthy. Intercom is still forced Online in `readDeviceStatuses` and cannot make a unit healthy on its own (the "requires GPS and some camera evidence" test pins this). Unknown update time correctly does not force Offline, and the details panel discloses it (`unknownUpdateIssue`) — this matches the "last-reported status vs staleness stay separate" contract and the METRICS text.

**VSS contract.** `parseCameraMask` rejects booleans, negatives, non-integers, `>0xffff`, and malformed strings; `usableChs` is treated strictly as a bitmask (sparse 9 → positions 1+4, zero → none, telemetry on unused inputs ignored — all tested). `malformedHealth` guarantees a present-but-invalid `module.record` / `alarm.videoLost` never yields Online. Record-only masks yield Unknown, not Online. Numeric loss never establishes presence (`present[channel]` uses `namedLoss`, not `loss`). CH count never becomes contiguous installation. `channelname` position lookup wins over legacy HOWEN names when a mask exists; exact-single-match only, ambiguity skipped. All contract points I could falsify are covered by a matching test.

**Camera visibility / UI.** Nine fixed slots in a 3×3 grid keep positions spatially stable; absent positions render as blank `aria-hidden` placeholders; labels are friendly names or "Camera N" (no channel jargon); the legend explains ✓/×/?. Details render inline directly below the row via `Fragment` + a second `<tr colSpan={10}>`, with `sticky left-0 w-[100cqw]` inside the `[container-type:inline-size]` scroll wrapper so the panel fits the viewport during horizontal scroll — a sound mobile approach. `useId`-scoped `aria-controls`, `aria-expanded`, sr-only status text, and per-row region labels are all correct.

**Regressions / boundaries.** All legacy filters retained; reset and `activeFilterCount` include the new location/failed-check/overall filters. `buildUnitRows` scoping (username token membership, Alcsongdee alias, fleet scope, CH disambiguation, dedup) is untouched, and boundary tests are unchanged. `buildInstallRows` and installation totals untouched. Raw recording/videoloss/zero telemetry preserved in details. No cross-row or cross-company data flows in the new camera parsing (row-local only).

## Findings (all Low; none blocks release)

1. **Low — same-camera double count when a literal name links a checklist column to a raw channel.** `unitStatusData.ts` — `cameraAdditionalChecks` (in `buildUnitRows`) includes `front`/`rearRight`/`rearLeft` when the column is reported, while the override block in `readCameraChannels` binds the matching channel (e.g. recording/loss token `Front` → c1) to that same column's value. Trigger: mask absent, a reported `Front` column, and `recording`/`videoloss` containing the literal `Front`, with the column offline. Consequence: `getUnitChecks` returns both `front` and `c1` as offline, so the issues list and damage matrix count one physical camera twice — contradicting the `getUnitChecks` docstring ("counted once") and the METRICS "without duplicating raw telemetry" sentence. Values stay consistent (the override mirrors the column), so this inflates counts rather than contradicting status.
2. **Low — dead "Failed check" option for Intercom.** `UnitStatusDashboard.tsx`, `checkOptions` memo: `getUnitChecks` always includes `intercom`, which is forced Online, so selecting Intercom in the failed-check filter can never match any row. Consequence: a permanently empty-result filter choice; confusing, not harmful.
3. **Low — nondeterministic aggregate label for `ch1Ai`.** `aggregateCheckLabels` (UnitStatusDashboard.tsx) normalizes only `c1–c9`; the `ch1Ai` key is labeled "AI camera" by checklist-source units but "CH1 AI" by channel-source units, and the damage matrix / dropdown keep whichever unit appears first. Consequence: the same check's label can change with row order on mixed dashboards. Cosmetic.
4. **Low — doc/code tension on record-bit-clear channels.** `readCameraChannels` both-valid-masks branch: an installed channel with record bit 0 and loss bit 0 is classified `offline` (so it feeds Warning and the damage matrix), while the patched METRICS §0.6 says "A zero recording mask means no current recording, not proof of a hardware defect." The code direction is conservative (never silently Online), and no test covers this exact corner (record-bit clear, loss-bit clear, within a complete valid mask). Reconcile the sentence or the classification in a follow-up; not a safety risk.

## Coverage and limitations

- Reviewed: the full frozen diff and the four supplied current files; logic traced by hand against every acceptance point and the VSS contract, cross-checked against the new test assertions.
- Not verified here: runtime rendering, the 58-test run, TypeScript/lint (already validated by the root's recorded gates and browser fixtures — I did not re-run them and make no claim about them).
- Out of scope by mandate: other repository files (e.g. `dashboardDataUtils.ts`, `useUnitStatusSheet.ts` internals were taken as-is), secrets, real vehicle data, integration.

The declared fallback limitation (current sheets lack VSS inventory fields, so blanks mean "no evidence", not "not installed") is implemented and documented exactly as specified — intentional, not a blocker.

```text
Review route: Fable primary
Requested reviewer: Fable/high
Base ref: 1855bbcdbcd2ed11088bbf60e3be4f28ffa78c0f
Reviewed patch or SHA: patch SHA256 f69edb074b6ce9d93416da6ec97f0e16f8552a3a56049e42b94cf3c6df82dc4f
Verdict: PASS
Findings: (all Low, non-blocking) 1) literal-name camera double count in getUnitChecks/cameraAdditionalChecks (unitStatusData.ts) inflates issues list and damage matrix; 2) Intercom appears in the failed-check filter but can never match (UnitStatusDashboard.tsx checkOptions); 3) ch1Ai aggregate label ("AI camera" vs "CH1 AI") depends on row order (aggregateCheckLabels); 4) installed channel with record bit 0 and loss bit 0 classified Offline vs METRICS "not proof of a hardware defect" sentence — reconcile doc or code; corner untested.
Verification commands: none — tool use prohibited by the bounded review mandate; source-only manual trace of the frozen patch and four supplied files.
Git actions: none
Deployment actions: none
```

Root resolution: all four low findings addressed in the final frozen patch; initial receipt superseded by final review.
