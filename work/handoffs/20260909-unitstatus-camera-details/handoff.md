# Shared UnitStatus camera and details regression fix

Active root: Codex. Provider/model/effort: Codex / UNKNOWN / UNKNOWN.
Base: 1855bbcdbcd2ed11088bbf60e3be4f28ffa78c0f.
Requested lane: read-only Claude review. User explicitly authorized sending the scoped patch with “go ahesd” on 2026-09-09.

## Objective and acceptance

Restore adjacent vehicle details and at-a-glance cameras, combine legacy ALCHEM/VINYTHAI/BIGTH features with shared BIGTH status precedence, force Intercom Online, support up to nine camera positions, leave positions without camera evidence blank, and retain exact company/Fleet boundaries.

Allowed paths are the four source files listed by hash below. The exact frozen diff is archived locally at /private/tmp/unitstatus-review-20260909/change.patch; its hash is bound in receipt.md and can be reproduced against the base SHA. Review source and targeted tests only. No edits, git mutation, deployment, production configuration, environment files, database access, or third-party messages. Do not transmit real vehicle records, credentials, or the whole repository. Root owns integration and git.

## Camera evidence

Read-only source inspection of songdee-spark-site established VSS usableChs as an installation bitmask, channelname as index-aligned semicolon labels, and lastStatusJson module.record/alarm.videoLost as health masks. Complete masks are authoritative; unused loss bits do not prove installation. Sparse mask 9 means positions 1 and 4, not nine cameras. Do not copy Spark's fail-open/default-roster behavior or its fixed BIGTH channel mapper into this status page.

The current Google Sheet lacks the inventory fields. No VSS-to-Sheets writer or authenticated dashboard bridge was found in Spark. The user has been asked where the writer lives. Until those fields are supplied, blank sheet-only positions mean no observed camera evidence, not proven non-installation. No sibling repository, DB, live API, or source sheet was changed.

## Validation

- 62 targeted model tests pass, including company/Fleet boundaries, named/raw/direct camera statuses, nine positions, sparse/zero inventory, phantom loss, malformed and partial masks, custom VSS names, mixed explicit/raw failure visibility, and BIGTH count preservation.
- Full TypeScript no-emit check passed. Changed-file ESLint and git diff --check passed.
- Independent bounded Codex review passed after correcting its concrete findings.
- Browser: 300-row VSS/BIGTH/Vinythai fixtures, adjacent expansion, failed-camera filtering, Reset, and fixed installation totals passed.
- Browser: saved real ALCHEM source with spreadsheet-formatted timestamps loaded all 40 units; restored Camera 3 failure filter found 10 units; Reset restored 40. Last-report statuses and stale warnings remain separate; Intercom stays Online.
- Mobile detail panel measured x=34..350 inside viewport 384. Desktop detail panel measured width 1166 inside viewport 1274. No app console errors/warnings or framework overlay observed.
- Isolated browser fixture exists only in /private/tmp/songdee-vehicle-unit-status. Screenshots: /private/tmp/unit-status-alchem-desktop.jpg and /private/tmp/unit-status-alchem-mobile.jpg.

## Review boundary

An earlier automatic approval review rejected transmitting private repository source to Claude without explicit user authorization. The user subsequently explicitly approved this scoped transmission with “go ahesd” on 2026-09-09. This resolves the authorization boundary. Review is limited to the four-file patch and matching source, without credentials or real vehicle records.

## Final frozen source hashes

Patch SHA256: `2e05a02741b73a0c1b64515981871abe7719a8f21da92fa4294eff7b3e934e5b`

- `app/dashboards/UnitStatusDashboard.tsx`: `bf64f1bdd101cfd9bdcb4da413f6bdab008fde24705d696c19df9708c4f63834`
- `app/dashboards/unitStatusData.ts`: `2b965131046a1be88b7e062b5761a7f932ae60b7fbeac330cea1b3b785b7465b`
- `app/dashboards/unitStatusData.test.ts`: `c2803c22def55b14a1f932ad80bf2a487b63b2de0532c1dc76cfda47af12ef87`
- `docs/METRICS.md`: `26206c45f5bce4884bf063ea43610e0957dab38b52e29d0a128261451ce69dea`
