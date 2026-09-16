# Messer location history loading

Objective: fix the location history failure for Messer without changing the source spreadsheet, production configuration, data permissions, or shared date parsing.

Active root: Codex; model/effort UNKNOWN (surface not verified). Root owns integration, git and implementation. Delegated provider: Claude, read-only planning then complete-diff review. Writer lease: root only for source; reviewer may write only its receipt.

Base: 4cf5758101bfc01581f35a88ef84249e72dc30b5. Worktree: /private/tmp/songdee-messer-location-time. Branch: codex/fix-messer-location-time.

Allowed implementation paths: app/dashboards/locationVehicleFetch.ts and app/dashboards/locationVehicleFetch.test.ts. Handoff outputs stay in this directory. Do not edit .env*, database files, production configuration or other source. No delegated git mutations, commits, pushes, merges, deployments or network writes.

Evidence: live Messer dashboard shows “Track Time or Updated Time must be a date/time column to load recent vehicle history.” Its vehicle catalog succeeds. Public GViz schema reports Vehicle No in B, Track Time in D with type string, no Updated Time or Fleet column. Track Time examples are `2026-09-13  23:59:36`, `2026-09-13  23:58:36`, `2026-09-13  23:57:36` (two spaces). No private row contents are included in this artifact.

Additional evidence: a full-column bounded mismatch query found one-digit hours (`2026-09-12  9:59:52`); simple lexical sorting is unsafe. All six per-vehicle counts are below 25,000 (maximum 11,034). Fable and Opus planner launches both returned `Not logged in`; no model execution occurred. Root proceeds with the concrete bounded repair; independent Codex explorer reviews design.

Executable plan: retain native date/datetime query path. When only a text Track Time/Updated Time exists, retrieve at most 25,001 rows for the exact selected vehicle and fleet predicate. Reject an overflow instead of labelling a truncated scan as newest history. Parse timestamps using existing parseDate, sort the complete bounded vehicle result chronologically (stable sheet-order ties, missing times last), then return the requested 2,000-row page. Reject nonempty unparseable timestamps. Do not change shared parsing, metrics, caches, or scoping. Tradeoff: text-timestamp pages read more upstream rows, bounded to one selected vehicle; typed sources keep current efficient paging.

Acceptance: native date behavior unchanged; Messer text history with variable-width hours loads newest-first; supported DD/MM/YYYY sorts chronologically; invalid nonblank timestamps and overflow produce actionable errors; metadata/query errors do not become empty success; exact per-vehicle/fleet scoping and page response limits remain enforced. Add focused tests for ordering, scope, page boundaries, overflow, missing/invalid dates and cancellation. Run only locationVehicleFetch tests and affected lint locally, with a targeted Bangkok timezone pass. A live read-only function run must load real Messer records. Broad checks belong to CI.

Release impact: local source fix only. Publication/merge/deployment requires explicit approval under WORKSPACE.md; do not execute production actions. Requested planning output: concise plan and risks. Requested review output: actionable findings against exact frozen diff, with live model receipt.
