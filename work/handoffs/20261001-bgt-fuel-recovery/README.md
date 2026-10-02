# BGT fuel recovery snapshot

Completed and verified local dashboard, 2026-10-01. Claude review explicitly
skipped by user. Current source is under source/; verified state and hashes are
under handoff/. Base SHA ab97c752ae5a8fbb7c92293d4852bcdc1adb36a7.
This is a recovery copy, not an independent Git checkout. No telemetry rows,
credentials or environment files are included. No commits, deployment, database
or production changes were made. Unrelated original checkout WIP is preserved.

Working preview: http://127.0.0.1:3107/e2e-fixtures/bgt-fuel
Working checkout: /private/tmp/songdee-bgt-fuel-20261001
Branch: codex/bgt-fuel-dashboard

If the temporary worktree is lost, create a checkout at the recorded base and
restore the 13 files from source/, preserving relative paths. The preview route
requires development mode and ALLOW_E2E_FIXTURES=true; use the repository's local
dev setup. Do not restore this snapshot blindly over unrelated edits.
