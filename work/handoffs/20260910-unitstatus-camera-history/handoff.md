# UnitStatus camera history

User request: implement, commit and deploy durable camera observation history. A camera seen in recording remains installed when later absent; omission in a fresh report means Offline. Never observed positions stay blank unless explicit installation settings establish them. Stale/missing reports must not introduce camera failures.

Additional authorized scope: visible, mouse-draggable vertical and horizontal table scrollbars, bounded table height, sticky column headings and vehicle names. Keep narrow-screen overflow inside the table and expand the table for printing.

Active root: Codex (model/effort UNKNOWN). Base: `987ba583474382d6efcd1be5dcb78ae806f5d85e`. Root owns all writes, git, integration and authorized deployment. Read-only Codex explorers cover model and storage. Claude Fable/high provides planning and frozen-patch review; surface model recorded on return.

Allowed scope: UnitStatus model, hook/UI, new authenticated snapshot and durable camera-history modules/tests, additive observation schema/migration, related metric documentation and this handoff. No source spreadsheet changes, upstream Spark edits, database target changes, credentials or production configuration changes. One additive table is required; verify production target read-only before applying its scoped migration. Do not run the broad legacy migration script for this release.

Acceptance: sequential disappearance/recovery; durable state across refreshes/viewers; explicit inventory precedence; no phantom installation from video-loss bits; stable physical/named identity; source/company/fleet/device isolation; source freshness checks; safe concurrent/out-of-order merges; authorization before fetch/persistence; source/store failure visibility; preserved BIGTH/ALCHEM/Vinythai behavior. Learning starts from fetched snapshots, with no claimed upstream backfill or unattended polling.

Proof: smallest affected unit/route/storage tests, targeted lint/typecheck, isolated rendered sequential fixture and reload, opposite-provider complete patch review, GitHub CI/deployment, authenticated production smoke checks.

Delegates must not edit, stage, commit, push, merge, deploy or change production state. External review receives synthetic source/test artifacts only, excluding credentials and live vehicle records.
