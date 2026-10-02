# Executable plan

Base/worktree/permissions: see handoff.md. Codex root model/effort UNKNOWN.
Claude Fable planner failed: CLI signed out, no model usage. One Opus fallback failed to launch with `fork: Resource temporarily unavailable`. Planning fallback: root-owned plan and independent repository exploration; provider review remains outstanding.

1. Add strict fuel parser with Bangkok wall-clock UTC digits, sorted per vehicle, numeric/missing validation, dedup/conflict handling and tests. Compare consecutive readings only within ten minutes, both in the selected period. Minimum delta defaults to 5 source units, adjustable. These are positive sensor-reading changes, never confirmed refills or consumption. Stationary requires both endpoint speeds exactly zero; ignition does not establish refuelling.
2. Add a small-sheet GViz fetch with status/header validation, no alert pruning, abort/timeout, visible error and stale snapshot. Reuse project direct-public-sheet precedent; preserve existing normal dashboard authentication and entitlements. No cached telemetry committed.
3. Reuse application components for shell, KPIs, tables, export and daily bar chart. Dedicated native SVG timeline uses actual millisecond positions, zero baseline, missing/gap breaks, per-vehicle lines and keyboard/tap selectable increase markers. Two chart instances, about 1.5k readings; no new packages. Tables provide exact accessible fallback. Neutral gray context, blue fuel line, orange detected change, dark selected outline.
4. Global vehicle and date filters apply to charts, KPIs, details, exports. Filters remain local component state (identifiers stay out of URLs); reset restores All and full period. Secondary timeline vehicle selector for multi-vehicle clarity; no persistence required. Units default to source units; user can explicitly select litres without changing values. Desktop charts stack on mobile, horizontal chart scroll preserves readable axes.
5. Register FuelTopUp in protected viewer, admin and dashboard cards. Hide irrelevant alert controls. Add development-only gated preview for supplied sheet. Update metric definitions.
6. Run only new/affected tests and targeted lint, render local preview, verify default + filter/reset + empty + mobile states, request exact-diff Claude review. Do not deploy or create DB records. Report any unavailable checks accurately.

Writer ownership: fuel_data worker owns fuelData.ts and fuelData.test.ts only. Root owns all other paths. No worker git or production mutations. Acceptance matches handoff.md.
