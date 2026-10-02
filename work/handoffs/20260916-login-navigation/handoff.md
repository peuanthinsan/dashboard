# Login navigation repair

User reports: first login does not navigate; retry can show a generic error; manual refresh shows the authenticated dashboard.

Base: 6cf74ff31fb3895874f4902e3d8055b357e24135, currently deployed. Branch: codex/login-navigation. Root provider Codex, model/effort UNKNOWN. Shared source and deployment-speed WIP remain untouched.

Allowed paths: app/login/actions.ts, actions.test.ts, login-navigation.ts, login-navigation.test.ts, login-form.tsx, login-form.test.ts, login-form-native.test.ts, error.tsx, page.tsx; app/site-i18n-copy.ts; this handoff directory.

Evidence: database recovered and authentication query probe passed. Public login response is no-store. Source uses Auth.js server action redirect and client useActionState; user reports session is visible after document reload. Browser attachment timed out, so exact client error and full user-session reproduction remain unverified.

Implementation: return explicit authentication success with redirect:false, navigate via window.location.replace('/dashboard') only after success, disable submission while pending or successful, preserve validation/rate limits for bad credentials, distinguish service errors in EN/TH.

Safety: no builds, dependency installs, benchmarks, production edits, credentials, database writes or configuration changes. Only bounded targeted unit tests and lint using already-installed tools. Production rollout/sign-in requires separate approval; previous approval was only PostgreSQL restart.

Acceptance: wait for successful auth before a full document navigation; failed login stays in the form; prevent resubmission after success; preserve limits for wrong credentials; infrastructure failures do not become invalid-password messages. Full build/browser verification must occur outside the production host before rollout.

Review correction: preserve the direct server-action form reference. Hydrated requests receive explicit success and navigate in an effect; native posts retain the server redirect. The login error boundary checks /api/auth/session once per error and recovers only an already-authenticated session; failed checks keep the retry UI. Native form metadata is tested with actual React hooks.
