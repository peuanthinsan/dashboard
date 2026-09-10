# Executable plan

Root: Codex; model/effort UNKNOWN. Base `987ba583474382d6efcd1be5dcb78ae806f5d85e`; canonical checkout `/Users/peuan/songdee-dashboard`. Claude planning was blocked by automatic approval review on external egress; root prepared this plan locally. External review remains pending until the frozen patch is available for approval.

1. Add source-backed camera observation/identity fields and optional historical inventory to the shared model. Current explicit configuration remains authoritative. Infer omission only from fresh, valid recording snapshots. Learned inventory is not a confirmed complete checklist or geofence proof.
2. Add one append-only camera-observation table and atomic timestamp-safe upsert/read helper. Source/company/authorized fleet-ID namespace and source-reported fleet (including exact scoped account membership)/vehicle/device identity prevent cross-scope mixing. Optional CH labels do not define identity. No arbitrary client telemetry accepted.
3. Add an authenticated UnitStatus snapshot endpoint resolving stored source and exact company/all-fleet authorization. Fetch primary and CH metadata server-side, scope before storing or returning rows, and merge history. Fail visibly if history is unavailable; retain previous client history across a degraded refresh.
4. Wire the snapshot hook and clarify blank/history/omission diagnostics in English and Thai. Preserve sorting, filters, details placement and all template logic.
5. Run targeted model/endpoint/storage tests, lint/typecheck, and isolated rendered transition/reload proof. Freeze source and complete opposite-provider review.
6. Verify the production database target read-only, apply only the additive observation-table migration, commit, push main and use existing GitHub CI/deployment. Verify ALCHEM40, Vinythai6, BIGTH122 and stored observations.

User authorized implementation, commit and deployment. No changes to database targets, credentials, sheets, upstream Spark, or production configuration. Learning starts from received refreshes; there is no claimed unattended polling or historical backfill.
