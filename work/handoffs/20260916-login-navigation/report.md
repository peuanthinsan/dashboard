# Dashboard login navigation repair

Status: prepared and reviewed locally; NOT published or deployed.
Base: 6cf74ff31fb3895874f4902e3d8055b357e24135 (observed live Dashboard revision).
Branch: codex/login-navigation.
Date: 2026-09-16.

## Reported behavior and evidence

The first sign-in appears to do nothing, a retry can show a generic error, and manually refreshing reveals the authenticated dashboard. This suggests the session is established but the login action/navigation response does not complete in the browser. The exact browser exception has not been captured: the in-app browser connection timed out. This is a targeted repair for the reported failure path, not a proven diagnosis of the original client exception.

PostgreSQL was recovered separately after explicit approval. A negative-account auth probe then returned the expected invalid-credentials response rather than a database connection failure. During this investigation PostgreSQL and Dashboard were running, and the public login response returned HTTP 200 with no-store cache headers.

## Change

- Hydrated login waits for Auth.js sign-in to finish, then loads a fresh /dashboard document.
- Direct server-action form references and native POST redirects preserve login before JavaScript hydration.
- Submit stays disabled while signing in and after success, preventing a duplicate attempt during navigation.
- If the login route errors after a session was created, it checks the same-origin session endpoint once and navigates only when an authenticated session exists. Cancelled checks cannot navigate.
- Bad credentials keep their existing error and rate-limit accounting. Authentication service failures get a separate English/Thai message.

No database data, schema, credentials, environment files, deployment configuration or application services were changed by this patch. Shared application source and the previous deployment-speed work remain untouched. The package contains only ten login-related source/test files.

## Verification

48 targeted tests passed across login actions, navigation/recovery, button state, native form rendering, request origins and auth request adapters. The 47-pass main run initially exposed a test-fixture metadata issue in the native-form test; after correcting the fixture to model bound RSC server references, that single test passed. Both logs are retained. The final source change was the reviewed cancellation guard; targeted ESLint and git diff --check passed afterward.

Targeted ESLint passed for all ten files; the corrected native-form fixture and final error-boundary guard each passed follow-up lint.

Tests used already-installed dependencies, one worker, no file parallelism and a 384 MB Node heap cap. No dependency installation, production build, benchmark, full-suite run, database query or browser sign-in was performed by these tests.

Independent Codex fallback review found no remaining actionable findings. Claude was unavailable; this is not an opposite-provider review. See receipt.md.

A full build, full typecheck, real browser cookie/header behavior and authenticated end-to-end flow remain unverified. These checks should run outside the production server before deployment.

## Review artifacts

- login-navigation.patch — complete patch against the base above.
- source-hashes.json — SHA-256 of the reviewed ten files.
- receipt.md — independent final review.
- tests.log and native-form-test.log — test evidence.
- handoff.md — scope and safety boundaries.

Patch SHA-256: 7f2fba44cc00fbd994f37a115f38335718424fd8b0b12dcc34a6e5f99b4d21cc

## Next authorized boundary

Prepare a PR branch and use off-host CI after explicit approval to publish. No main push or merge: the current Windows updater builds main on this production machine. A safe rollout path must be confirmed before deployment, with database/schema changes excluded.

Previous approval covered restarting PostgreSQL and verifying recovery. WORKSPACE.md separately requires explicit approval for publishing and deployment. An earlier automatic approval review rejected GitHub sign-in/publication pending that separate authorization. No GitHub credential or device-login operation is included in this local patch.

The shared UNC repository's git status could not complete because its .git/info/exclude was inaccessible from this host. Its application files were therefore left untouched; only this new handoff directory was added.
