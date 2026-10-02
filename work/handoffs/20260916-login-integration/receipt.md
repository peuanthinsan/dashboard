# Login integration review receipt

Date: 2026-09-16. Base: 4cf5758101bfc01581f35a88ef84249e72dc30b5.

Implementation provider: Codex; model/effort UNKNOWN.
Review provider: independent Codex fallback (/root/login_trace); model/effort UNKNOWN.
Claude Fable/high review was attempted, but its CLI returned `Not logged in · Please run /login`, with empty modelUsage. See claude-review.json. This is not an opposite-provider review; the WORKSPACE.md review requirement remains unmet.

Frozen patch SHA-256: 3fde34166e877d67b6f614d05fdd427b166b1ab1ab5a0bd22ff51b6022453724.
All ten source files match source-hashes.json. Any source or scope change invalidates this receipt.

Fallback verdict: PASS, no actionable correctness or security findings.

Reviewed all ten files in review.patch: login actions, navigation helpers, form, page, error boundary, four test files, and bilingual site copy. Confirmed authentication completes before navigation, native form redirect remains available, submission stays disabled after success, recovery requires a server-confirmed session and guards cancellation, validation/rate limits are retained, redirect destinations are fixed local paths, and service errors expose no internals.

Review limits: source/diff review and hash verification only; no browser or production verification by reviewer. No edits, test reruns, builds, database access, commits, pushes, merges, or deployments by reviewer.

Root validation: all 19 tests across the four added login test files passed; targeted ESLint for all ten changed source/test files and git diff --check passed. Broad suites/builds are left to CI under the local test-scope agreement.

## Browser verification

Five scoped Playwright Chromium checks passed against an isolated Next 16.2.12/Auth.js fixture at http://127.0.0.1:3107, with exact copies of the changed login source and real session cookies. Synthetic in-memory accounts replaced the database; no production traffic or real credentials were used. All 27 copied source/dependency/assets matched repository hashes after testing. Browser plugin/agent-browser CLI unavailable; used the already-installed Playwright and Chromium without installs.

- First hydrated sign-in: one action POST, disabled pending button, session cookie, fresh dashboard document with correct synthetic identity, no refresh or page/console errors.
- Wrong password: inline error, no session, form re-enabled; next correct attempt reaches dashboard without refresh.
- Stale second login tab: reproduced the ordinary authenticated redirect that breaks the action response; session verification then recovered the authenticated dashboard automatically. Expected caught boundary console messages only; no unhandled page errors or final overlay.
- Synthetic service failure: distinct unavailable message, form remains usable.
- Native form: exact page/form/action POST redirected to the authenticated dashboard through a /native-login fixture alias without JavaScript. Scope limit: original /login showed its pre-existing loading.tsx streaming fallback in this dev fixture with JavaScript disabled. This proves native action transport, not full original-route no-JS rendering.

Rendered checks: intended URL/title, meaningful login/dashboard content, no persistent framework overlay, console inspection and screenshots. Test fixture minimal dashboard intentionally replaces the real fleet page. Real production host/proxy, HTTPS and database remain untested. Existing logo aspect-ratio warning was unrelated to login.

Evidence: /private/tmp/songdee-login-browser-20260916/receipt.md, results.json, source-verification.json, and screenshots in the same directory. Owned fixture server stopped cleanly; existing localhost:3000 was untouched.

## Release status

Source repair is integrated locally and ready for publication review. No commit, push, merge or deployment occurred. The three prior handoff folders remain untouched. Publishing/deployment requires explicit approval under WORKSPACE.md, and Claude review remains unavailable as recorded above.

### Publication authorization (subsequent turn)

The user answered "yes please" to publishing and deploying the repair using the completed Codex review. This authorizes publication, merge and rollout of this login patch and accepts the disclosed review fallback. No additional approval is required for those actions.

Fetched main at 6cf74ff31fb3895874f4902e3d8055b357e24135; the two intervening changes are unrelated location-history fixes. Login/auth/proxy/hosting/workflow paths are unchanged. Fast-forwarded the release branch and verified all ten source hashes still match the frozen reviewed/browser-tested patch. Source-only commit: 46d676e, branch codex/login-navigation-fix. Prior handoffs and unrelated deployment optimization artifacts are excluded from publication.

PR https://github.com/peuanthinsan/dashboard/pull/259 passed full GitHub CI (lint, all unit tests and production build), run 35082127279. Merged 2026-09-16T09:58:01Z as ab97c752ae5a8fbb7c92293d4852bcdc1adb36a7. Local main fast-forwarded to origin/main. All ten reviewed source hashes remain identical. The user-approved Windows scheduled updater now has this main revision available; actual public rollout verification is pending.

Pre-rollout public baseline: /login HTTP 200, /api/auth/session HTTP 200 with null, build ID xjW93jBb8r94YA0ZtN1ft. Component-specific public JavaScript confirms repair absent in this old build. Evidence: /private/tmp/songdee-login-live-verification/baseline.md and baseline-meta.json. Public Windows deployment is distinct from GitHub's separate Vercel workflow.

### Public rollout verified

At 2026-09-16T10:03:35Z the public Windows site switched to build TUEm3xHq-a9wZHhESKkK7. New LoginForm chunk 2q8bux81fnago.js includes success:false initial state, pending-or-complete submit locking, and document replacement after confirmed success. New error chunk 09ao2he64n5b1.js includes no-store same-origin session verification, session.user gating, and cancellation guards. These are the reviewed repair's component-specific features. Public resources do not expose the exact git SHA, so this is build/feature verification rather than a read of the host deployment-state.json.

Final read-only production browser check at 2026-09-16T10:10:41Z: /login HTTP 200 with correct Thai sign-in title and visible email/password/submit controls, hydration confirmed, meaningful body, no runtime overlay, no console/page errors. /api/auth/session HTTP 200 with null for the unauthenticated verification browser. No production login attempt or real credentials used. One transient TLS EOF occurred during the minute-spaced rollout watch; subsequent page and session checks passed.

Evidence: /private/tmp/songdee-login-live-verification/rollout-receipt.md and rollout-login-rendered.png. GitHub main run 35082366898 passed all lint/unit/build gates. Its separate Vercel deployment was still staging when the Windows/public-site goal completed; do not claim Vercel promotion complete. The local gh watch process was stopped; the remote workflow was not cancelled or modified.

Outcome: approved login repair published, merged, and verified on the live public dashboard. Local main matches origin/main at ab97c752ae5a8fbb7c92293d4852bcdc1adb36a7; only the four task/historical handoff directories remain untracked. No environment files, database/schema, deployment configuration, or unrelated optimization patches were changed.
