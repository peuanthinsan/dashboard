## Re-review receipt — VehicleUnitStatus corrected snapshot

**Model:** Sonnet 5 (`claude-sonnet-5`), answering directly (no sub-agent dispatch), `Read`-only.
**Files re-read:** `app/dashboards/vehicleUnitStatusData.ts`, `app/dashboards/vehicleUnitStatusData.test.ts`, `app/dashboards/VehicleUnitStatusDashboard.tsx`, `docs/METRICS.md` §0.6 (lines 123–153). All other integration files taken as byte-identical to the prior review, per instruction — not re-read.

### Prior findings — verified resolved

1. **Last-checked +7h shift (was: undocumented template-local divergence)** — `VehicleUnitStatusDashboard.tsx:176` unchanged in code, but `docs/METRICS.md:143-145` now explicitly states the shell's Last-checked field is shifted into Bangkok digits *for this template only* and that existing templates' rendering is untouched. **RESOLVED** — no longer a silent inconsistency, it's a documented, intentional deviation.

2. **Fleet-scope bypass on blank Fleet cells (was: per-row bypass letting blank-Fleet rows leak past a narrow scope)** — now input-wide: `hasFleetColumn = rows.some((row) => hasAliasedColumn(Object.keys(row), FLEET_ALIASES))` (`vehicleUnitStatusData.ts:72`), then any row with a blank/missing/mismatched Fleet is excluded under a scope whenever `hasFleetColumn` is true (`:83-86`); only a source with *no* Fleet key on *any* row falls back to company-membership-only. Verified against tests `vehicleUnitStatusData.test.ts:33-47` (mixed sheet — blank/missing/null Fleet rows now excluded under scope), `:49-57` (no-Fleet-anywhere source still scopes by company), `:59-69` (Fleet-key detection works from any row including an excluded-company row, and tolerates a `null` value and alias spacing/casing). **RESOLVED**, correctly and more robustly than the minimum fix (key presence, not just value presence, and case/space-tolerant via the same `normalizeLabel`).

3. **Duplicate alias/normalization for column validation (was: two independently-maintained alias checks)** — consolidated into exported `hasVehicleUnitStatusColumns()` (`vehicleUnitStatusData.ts:45-48`) built on the same `VEHICLE_NO_ALIASES`/`USERNAME_ALIASES` and the same `normalizeLabel`-based `hasAliasedColumn` helper the row parser uses. Dashboard now calls it directly (`VehicleUnitStatusDashboard.tsx:173`), no re-implemented regex. Tests confirm alias parity with the parser and correctly reject punctuation variants the parser doesn't accept (`vehicleUnitStatusData.test.ts:219-244`). **RESOLVED**.

4. **Video-loss badge severity (was: literal `"0"` rendered in a warning-colored badge)** — changed to `badgeDefault` (`VehicleUnitStatusDashboard.tsx:252`), documented at `docs/METRICS.md:152-153` as neutral including zero. **RESOLVED**.

### New issues in this diff
None found. No regressions to dedup/timestamp/company-membership logic (unchanged and still correctly tested), no unused imports introduced (`badgeWarning` still legitimately used for the stale-update badge), no drift between code and the updated §0.6 doc text.

### Verdict

**PASS** — all four prior findings are resolved as described, with test coverage matching the stated "fourteen helper tests" (counted: 10 `buildVehicleUnitRows` cases in this file + 1 dedup case + 2 `hasVehicleUnitStatusColumns` cases + 1 `isReportedValue` case = 14). No remaining actionable findings from this reviewer. Typecheck/lint/browser-QA claims were not independently re-verified here (outside `Read`-only remit) — that stays with root's separately reported gate.
