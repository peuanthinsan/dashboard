# Verification

Source: the supplied Vehicle tab (gid 1214717385), observed through Chrome and
loaded live by the template using the existing Google Sheets hook. The generic
browser CSV export returned the master tab; only its exact Vehicle membership
row was used for reference. No master-sheet data was added to the repository.

## Functional checks

- Live source: one unit, 69-8617; one stale update, zero recent/unknown updates.
- Source camera names and Reverse 1 retained. Recording summary is six channels;
  video loss is the literal 7, 8. Speed zero stays zero; NA power/battery display
  as not reported. API update 06:30:50 and telemetry 06:30:47 remain distinct.
- Vehicle and location search work; unmatched search clears the table and counts.
- Recent filter returns zero, stale returns one; Reset restores all data.
- Detail expansion/collapse, auto-refresh checkbox and Refresh respond.
- Refresh retains the shared hook's five-minute cache. The one-minute interval
  checks for a new snapshot; it does not promise one-minute source freshness.
- Thai labels and expanded source values verified at mobile width.
- Desktop 1440×1000 and mobile 390×844: no document overflow; mobile table is
  1000px wide inside a 316px scroll region. Details stack outside that scroll area.
- Final render has no runtime failure or framework error overlay. A temporary
  hot-reload missing-export error occurred while parallel helper edits were in
  progress; it resolved when those edits completed. Initial dependency symlink could not be used
  by Turbopack; a local APFS copy restored the repo's normal Turbopack preview.
- 14 new helper tests pass, also under America/Los_Angeles. Four targeted template
  resolver tests pass. Changed-file lint and TypeScript no-emit checks pass.
- Existing broad suites/build are left to CI under the user's test-scope rule.

## Visual checks and deliberate adaptations

Built-in Image Gen produced design-concept.png from a brief covering the existing
Songdee shell, four update counts, filter toolbar, eight-column unit table and
three-column expanded details. Chrome CUA captured light/dark desktop and mobile
screenshots. Both the concept and final light desktop screenshot were inspected
with view_image in the same pass; mobile was inspected separately.

1. Layout: header, four counts, filters, table and details follow the concept.
   Existing DashboardShell replaces the concept's invented top navigation.
2. Copy: primary labels and source values match the brief. Existing shell labels,
   the selected vehicle heading, additional source telemetry fields and the
   explicit displayed/total count are intentional additions for app consistency
   and correct multi-unit detail identification. No new marketing copy.
3. Typography: app-native sans-serif with a 30px desktop title, 14px body/controls,
   11px table headers and 12px secondary timestamps. Existing UI tokens retained.
4. Palette: white panels on zinc-50 with red actions, amber stale-update badges,
   neutral video-loss badges and green recent count; native dark variants verified. Neutral
   device text intentionally replaces inferred green dots on a stale report.
5. Spacing/containers: app-native 16px corners, subtle borders and shared KPI
   styling replace generated KPI icons. Extra raw telemetry extends the detail
   region below the initial concept viewport; mobile details stack clearly.
6. Interactions/responsiveness: all shown controls work; wide table scroll is
   internal, with readable detail fields outside its horizontal overflow.

Above-fold copy comparison: all task controls present; deviations are the existing
shell and KPI component treatment listed above. The implementation follows the
concept's structure with these explicit existing-design-system adaptations.
No unresolved clipping, overlapping controls or mobile overflow was observed.
The Last checked display was corrected from UTC to Bangkok digits during QA.
Final render was also captured at the concept's actual native viewport,
1505×1045, and both final images were inspected with view_image again. The final
reviewed preview is preview.png; its extra height comes from the documented
additional source telemetry in expanded details.

Opposite-provider review prompted two additional corrections: input-wide fleet
column detection now prevents blank/missing cells bypassing a configured scope;
the UI and parser now share the same source-header aliases. Video-loss badges
were made neutral because an arbitrary reported value does not establish severity.
Claude Sonnet 5 re-reviewed all corrections and returned PASS with no remaining
actionable findings. Final receipt is receipt.md. Temporary QA route removed;
local preview server stopped after capture. Source changes are copied back to the
shared workspace only after verifying each destination still matches the base.
Integration completed into /Users/peuan/songdee-dashboard at HEAD e4d709f;
all nine file hashes match the reviewed worktree. No overlapping changes or
unrelated WIP were overwritten. source-manifest.txt verifies the final files.

Screenshots originally captured outside the repo:
/private/tmp/vehicle-unit-desktop-light.png,
/private/tmp/vehicle-unit-desktop.png (dark),
/private/tmp/vehicle-unit-mobile.png,
/private/tmp/vehicle-unit-thai-mobile.png.
