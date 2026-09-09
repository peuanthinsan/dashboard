Provider: Claude
Surface-reported model: claude-fable-5
Requested effort: high (CLI; independently reported effort unavailable)
Review route: Fable primary; no fallback
Raw receipt SHA256: eea31bae8a8f42547794c075797b734cf4850accd78fb31c127f4e940db5bb55
Patch hash independently verified by root: 2e05a02741b73a0c1b64515981871abe7719a8f21da92fa4294eff7b3e934e5b

Using no tools, as instructed: this is a bounded source-only re-review of the frozen patch and the four provided files. I did not run tests, hashing, git, or any commands, and I make no claims about the browser/CI validation beyond what was reported to me. (The session hooks request a `workflow` skill invocation; no such tool exists in this session and the review mandate forbids tool use, so it is skipped.)

# Review receipt — shared UnitStatus, final complete-patch re-review

**Patch hash (echoed from provided value, not independently computed):** `2e05a02741b73a0c1b64515981871abe7719a8f21da92fa4294eff7b3e934e5b`
**Base SHA:** `1855bbcdbcd2ed11088bbf60e3be4f28ffa78c0f`

## Verdict: PASS

All four prior low notes are verifiably addressed in source:

1. **Same-camera dedup** — `readCameraChannels` (unitStatusData.ts, explicit-override block) adds only actual literal-name matches to `representedChecklistKeys`, and `cameraAdditionalChecks` excludes exactly those keys while keeping independent (`Camera9`, AI-loss) and conflicting-direct cases (`recording:'Front', Front:'offline', Camera1:'online'`). The four new tests (`counts explicit positional failures once…`, `retains a conflicting explicit positional check…`, `counts an explicit Front failure once when VSS names place that same camera on slot 4`, `does not infer online cameras from a recording mask when a supplied loss mask is malformed` plus the record/loss-zero case) pin each behavior.
2. **Intercom excluded from failure filter** — `checkOptions` filters `check.key !== 'intercom'` (UnitStatusDashboard.tsx); Intercom remains forced Online in `readDeviceStatuses` and can never satisfy the offline predicate anyway.
3. **Uniform AI-camera naming** — `CAMERA_FIELDS`/`DEVICE_FIELDS` `ch1Ai` is now `AI camera / กล้อง AI` everywhere; `STATUS_ALIASES.ch1Ai` still reads the literal `CH1 AI` source column, unchanged.
4. **Docs** — METRICS.md §0.6 now states a cleared record bit is Offline recording health, not a hardware-defect diagnosis.

Acceptance criteria re-checked against source: BIGTH-primary shared model with explicit-column precedence intact; Intercom forced Online for all companies; nine at-a-glance positions with friendly names or `Camera N` (no channel jargon), absent positions rendered as blank `aria-hidden` slots padded to nine; loss wins inside the installed mask; malformed/missing health stays Unknown (never silently Online); numeric loss and CH counts never establish installation; details render inline directly below the row (`Fragment` + colSpan-10 row, sticky `100cqw` panel inside the `container-type:inline-size` scroller) with a11y wiring (`aria-expanded`, conditional `aria-controls`, `sr-only` status text, symbol legend); legacy filters plus location/failed-check/overall added and all cleared in `reset`; username/fleet boundary code and `buildInstallRows` untouched; raw recording/videoloss preserved in details. Both colSpans match the 10-column header.

## Remaining findings (all non-blocking)

- **LOW — blank literal-named checklist column can mask a valid VSS mask reading.** `app/dashboards/unitStatusData.ts`, `readCameraChannels` explicit-override block. Trigger: VSS inventory present with `channelname` naming a slot `Front` (or recording lists `Front`), plus a present-but-empty `Front` column. The override runs on column *presence*, so `readUnitHealth('')` downgrades a mask-derived Online/Offline at that slot to Unknown, and `overallStatus` drops to Unknown. Direction is conservative (never false-Online) and consistent with the `readDeviceStatuses` "explicit column, including unknown, wins" convention, but this exact combination (blank explicit column over a *valid* health mask for the *same* camera) has no test and no doc sentence. Suggested follow-up: one test or one METRICS.md line declaring it intentional.
- **LOW — failed-check filter semantics for represented cameras.** `UnitStatusDashboard.tsx`, `checkOptions`/`filtered`. When a Front failure is represented at a raw slot (`c1`/`c4`), the unit matches only the `cN` key; selecting the "Front camera" (`front`) option will not surface it. Consistent with count-once semantics, but a user hunting Front failures across mixed cohorts must know to also check the slot option. Also, the dropdown always offers every `DEVICE_FIELDS` entry (MCR, IVMS, Fatigue AI…) even for cohorts whose sheets never report them, yielding never-matching options. UX polish only.
- **INFO — mask bits 9–15 accepted but unrepresentable.** `parseCameraMask` allows up to `0xffff`; a mask with only bits ≥ 9 set yields `inventoryKnown: true`, `expectedCameras: 0`, and a Healthy `0/0`. Within the declared nine-position scope; noting for completeness.

## Coverage and limitations

- Reviewed: the full frozen patch and the four current files (dashboard component, data model, tests, METRICS.md), line-by-line for status derivation, camera presence/health precedence, dedup, overall-status hierarchy, filters, table/a11y structure, and company/fleet boundary preservation.
- Not verified: patch hash (echoed as supplied), test execution, TypeScript/lint, browser behavior of the container-query sticky panel, fixture parity, and any repository files outside the four provided. The documented fallback limitation (sheet lacking VSS inventory cannot prove installation) is accepted as intentional per the established contract.
- No `workflowId` release-cohort triple was supplied, so no single-line review JSON is emitted.

```text
Review route: Fable primary
Requested reviewer: Fable/high
Base ref: 1855bbcdbcd2ed11088bbf60e3be4f28ffa78c0f
Reviewed patch or SHA: patch SHA256 2e05a02741b73a0c1b64515981871abe7719a8f21da92fa4294eff7b3e934e5b (hash echoed from root; not independently computed)
Verdict: PASS
Findings: LOW unitStatusData.ts readCameraChannels — blank literal-named checklist column overrides valid VSS mask health to Unknown for the same slot (conservative, untested/undocumented combination); LOW UnitStatusDashboard.tsx checkOptions — represented positional failures match only cN keys and dropdown lists never-reported device options (UX only); INFO parseCameraMask — bits 9–15 accepted, mask-only-≥9 renders Healthy 0/0. None blocking.
Verification commands: none run (tool-free source review); root may re-verify with `shasum -a 256 <patch>` and `git --no-optional-locks diff --no-ext-diff --no-textconv 1855bbcdbcd2ed11088bbf60e3be4f28ffa78c0f..<reviewedSha>`
Git actions: none
Deployment actions: none
```

## Root disposition

Final review accepted. Remaining low notes do not require source changes: explicit columns including blanks intentionally override inferred camera health; positional and numbered failure filters retain distinct identities unless a literal camera match proves equivalence. Unknown accessory choices remain available across the shared template. More than nine camera positions are outside the requested product scope.

Local verification: 62 targeted model tests passed, TypeScript no-emit passed, all three changed code files passed ESLint, diff check passed. Final preview verified 300 BIGTH units, friendly AI-camera labels, Intercom absent from failure options but Online in checklist, adjacent detail region and no console errors; ALCHEM retained 40 units. Earlier nine/sparse/zero VSS, Vinythai, mobile, filtering/reset and fixed installation-total checks remain valid.

Root owns git and deployment. User previously authorized deployment and explicitly approved the bounded Claude review on 2026-09-09. Production runs through existing GitHub Actions main gates and promotion guards. This receipt records the reviewed state before publication; deployment outcome is recorded separately.
