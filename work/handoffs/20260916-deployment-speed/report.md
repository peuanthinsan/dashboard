# Deployment speed review — Dashboard, SVIS and OPS

Prepared 16 September 2026. Changes are local and reviewed; no GitHub sign-in, push, merge, controller installation or rollout has occurred.

**Immediate recovery needed:** the rejected Windows compiler-cache experiment exhausted host memory. PostgreSQL service postgresql-songdee-17 entered Stopped at 13:37:42 Bangkok time, during the incident. OPS /api/health returns 500. All benchmark-owned runaway workers were stopped and memory recovered. Dashboard and SVIS passed live health probes. Windows denied the normal PostgreSQL restart; administrator recovery approval is pending. Recovery requires starting the existing service, then verifying all three applications. No database data or configuration was changed.

## Measured build and packaging savings

| Project | Before (warm baseline) | Final revised build | Saved | Reduction |
| --- | ---: | ---: | ---: | ---: |
| Dashboard | 3m 07.916s | 2m 44.297s | 23.619s | 12.6% |
| SVIS | 3m 27.471s | 34.817s | 2m 52.654s | 83.2% |
| OPS | 1m 54.778s | 1m 45.835s | 8.943s | 7.8% |
| All three sequentially | 8m 30.165s | 5m 04.949s | 3m 25.216s | 40.2% |

Method: clean isolated checkouts on this Windows host, Node 24.19.0, account gps01, identical application revision per comparison, public settings {}, dummy auth/database build inputs, same per-app warmed npm download cache. Both versions run their existing installs, tests, builds and packaging. Compare baseline-warm.json with optimized-safe-first.json: the latter uses the final source after removing Windows compiler-cache reuse, with npm already warm. Checkout time is excluded. Baseline cold and initial optimized trials are retained for transparency.

These are individual local measurements, not statistical guarantees or measured push-to-live savings. Production uses NETWORK SERVICE and its real public settings. Polling, shared build queue, candidate copy, health probes, activation and cloud queues are excluded. OPS's smaller change is more susceptible to normal timing variation. End-to-end production and Vercel savings remain unmeasured until approved rollout.

## Changes prepared

- All projects: persistent per-app npm cache, prefer-offline package retrieval, phase timing logs/reports, optional non-Windows compiler cache with configuration/lockfile isolation and bounded retention.
- Dashboard: remove unused Vercel CLI from the application dependency tree (994 to 598 lockfile entries; no retained dependency versions changed). Pin the deployment CLI separately. Cache Linux CI builds. Separate Vercel upload and readiness checks, compress uploads, explicitly require READY before promotion, and print failure logs.
- SVIS: use a separate locked Windows server dependency set (1090 to 216 lockfile entries; no retained dependency versions changed). Exclude Expo/mobile dependencies from server installation and release packages. Check every bundled external import against the runtime manifest. Preserve mobile/root dependencies and CI typechecking. Use npm ci for the Vercel web build.
- OPS: npm cache and timing support. Its existing Vercel integration is retained.
- Shared Windows updater: check ancestry and migration paths before install/build, while keeping the existing final checks. Exempt only db/README.md from the schema-path rule. The OPS target e888ae6 was blocked by this documentation path; actual SQL/schema changes remain blocked.
- A guarded administrator installer validates reviewed and existing hashes, acquires the existing deployment mutex, backs up scripts, verifies copies and rolls back failed installation. It changes only Controller.ps1, worker.cjs and the new change-policy.cjs, not runtime configuration.

**Rejected optimization:** restoring Turbopack compiler caches into a fresh Windows checkout caused 1,154 runaway build workers, a failed 10m 32s Dashboard trial, and resource exhaustion. That behavior is disabled in the final build helpers. Dashboard also explicitly disables build filesystem caching on Windows. npm caching remains enabled. The failed report is preserved; it is not included in the savings comparison. The final builds passed with a scoped worker-count watchdog, which did not trigger and has been stopped.

## Existing deployment gates

### Windows, shared by all three

1. Scheduled controller invocation, one global deployment mutex and one build worker. The three apps are processed sequentially. Recover an interrupted activation journal before proceeding.
2. Enabled deployment state, valid current main SHA, skip already deployed revisions, and do not automatically retry a known failed SHA without the retry option.
3. Clean checkout at the exact requested SHA under the restricted build account. Reject actual environment files; pass only approved public build settings and dummy secrets. Omit only the documented .env.local.example template from the disposable checkout.
4. New early ancestry and schema/migration checks. History rewrites and schema changes stop before dependency installation.
5. Locked dependency installation, existing regression tests, full production compilation/typechecks and packaging. No node_modules or completed releases are reused.
6. Validate build receipt, app/SHA match, path containment and absence of reparse points; copy into the protected candidate tree.
7. Retain the original final ancestry/schema checks.
8. Launch the candidate on the alternate port and pass application health probes. These include rendered pages, SVIS static assets, relevant database health, Dashboard auth URL/CSRF behavior and blocked-host behavior.
9. Recheck main before activation; discard a superseded candidate.
10. Journal the activation, stop the app service, move the release, update service paths, restart and probe health. Restore the prior release on failure.
11. Retention cleanup is nonfatal after a healthy activation.

Dashboard Windows tests use Vitest; SVIS uses host/proxy/PostgreSQL-adapter tests; OPS uses Windows-hosting/admin-auth/schema/API-boundary tests. Their existing coverage remains in place.

### GitHub and Vercel

Dashboard: push/PR trigger, newest-run concurrency cancellation, npm ci, helper checks, lint, unit tests and build. Main deployment depends on those gates. Then current-main check, production configuration pull, production build, staged upload without assigning the domain, explicit READY check, current-main recheck, promotion and final SHA check. Existing 20-minute job limits remain; upload and readiness have separate bounded steps.

SVIS: helper checks, npm ci, Windows API dependency coverage, app typecheck and unit tests, web install and build. Native Vercel Git integration remains active. OPS retains its existing native Vercel integration; this work does not create an additional cloud deployment pipeline.

## Update interval and original commit

GitHub/Vercel builds are push-triggered, subject to queue and build time. Windows uses a scheduled poll, followed by the shared serial queue. The exact scheduled-task repetition interval could not be read with this account's privileges and has not been changed. The installer will record the schedule when run with administrator rights. The controller's 3-second build-result poll is not the GitHub update interval.

Historical Windows events show Dashboard 7aabe34 deployed at 04:48:22 UTC (11:48:22 Bangkok) on 16 September, about 7m 47s after its commit. Detection/build started at 04:41:16, packaging completed 04:47:22 and candidate verification completed 04:48:16. Dashboard subsequently advanced to 6cf74ff.

The original GitHub/Vercel deployment job exceeded its 20-minute maximum; see [run 35056518408](https://github.com/peuanthinsan/dashboard/actions/runs/35056518408). Authenticated logs were unavailable, so no precise cause or Vercel time saving is claimed.

## Validation and review

- All three final production build/package runs passed.
- Hosting/cache/policy tests passed across all three projects.
- Dashboard lint: zero errors, 19 existing application warnings.
- Workflow YAML parsed and all 22 shell steps passed Bash syntax checking.
- SVIS root-bundle dependency coverage, typecheck and unit tests passed.
- SVIS packaged runtime started and served HTML and its compiled JavaScript using dummy settings and no database queries. It needed approximately 15 seconds to start; the initial six-second smoke allowance was too short.
- PowerShell parser checks passed for controller and installer; worker JavaScript syntax and git whitespace checks passed.
- Independent read-only Codex fallback review found no actionable issues, including a follow-up after disabling Windows compiler-cache reuse. Claude is unavailable on this host, so the WORKSPACE opposite-provider review has not been claimed completed.
- Manifest updated hashes match the reviewed scripts; expected originals match saved baseline and installed files. The new policy file is absent live, as expected.

Detailed results and raw timings are included beside this report.

## Remaining actions

1. Approve administrator elevation to restart the existing PostgreSQL service and verify OPS, Dashboard and SVIS health. Recovery script is included for review.
2. Approve GitHub sign-in and publication of the three reviewed changes, plus administrator installation of the Windows updater. Recheck current upstream revisions and review any integration changes before publishing.
3. Activate through the normal gates, verify deployed SHAs and measure actual push-to-live timings. Recheck OPS's previously failed revision when the new commit arrives or through the explicitly approved retry path.

Automatic approval review rejected starting GitHub device sign-in because implementation/benchmark authorization did not include sign-in or publishing; WORKSPACE.md requires separate approval for publication and production changes. No authentication workaround was attempted.
