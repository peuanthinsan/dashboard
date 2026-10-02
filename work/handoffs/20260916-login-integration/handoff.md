# Integrate the login navigation repair

Objective: fix first sign-in remaining on the login page, duplicate submission errors, and the need to refresh manually.

Active root: Codex; model/effort UNKNOWN. Implementation: Codex. Requested delegated lane: Claude read-only review of the final complete diff. Base: 4cf5758101bfc01581f35a88ef84249e72dc30b5 on main.

Evidence: current login still uses the Auth.js server-action redirect. The earlier repair in ../20260916-login-navigation/login-navigation.patch was never integrated or deployed; it applies cleanly to current source. The live user's original client exception has not been captured.

Allowed source paths: app/login/actions.ts, actions.test.ts, login-navigation.ts, login-navigation.test.ts, login-form.tsx, login-form.test.ts, login-form-native.test.ts, error.tsx, page.tsx; app/site-i18n-copy.ts. Root owns all source edits. Delegates have read-only source access; browser verifier owns only its separate /private/tmp login fixture and evidence.

Plan: apply the existing repair; run only its targeted tests and lint; exercise a local isolated browser fixture with real Next.js/Auth.js cookie handling and synthetic accounts; freeze the resulting patch and obtain Claude review. Acceptance: first valid sign-in navigates without refresh, invalid input stays on login, duplicate submit is disabled, native form redirects still work, error recovery requires a confirmed session, service errors are distinct from wrong passwords.

Preserve the three pre-existing untracked handoff folders. No environment files, real database reads/writes, credentials, production configuration, service changes, dependency installs, commits, pushes, merges, or deployments. Publishing and deployment require separate explicit approval under WORKSPACE.md. Tests must remain narrow; no full suite.

Required review output: actionable findings with file/line and concrete failure, or no findings; files reviewed; provenance and limits. Review invalidated by later source changes.
