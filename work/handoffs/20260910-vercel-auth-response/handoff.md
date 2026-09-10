# Vercel authentication response fix

- Objective: restore dashboard.songdeegps.com on Vercel after middleware began returning HTTP 500.
- Requested lane: opposite-provider review of the complete frozen patch.
- Active root: Codex; model/effort UNKNOWN. Reviewer: Claude Fable/high primary; actual model recorded from execution output.
- Worktree: /private/tmp/songdee-vercel-response-fix; base 16704b72a47838fc737e471a24b260f211856b0a.
- Writer lease: Codex root alone. Reviewers are read-only and must not change files, git, environment, database, deployment, or production state.
- Allowed implementation paths: proxy.ts, app/api/auth/[...nextauth]/route.ts, app/lib/request-origin.ts, app/lib/request-origin.test.ts, app/lib/auth-request-adapters.test.ts.
- Evidence: production deployment dpl_JCaLG8BQsHD6WUU4fRtvj8C9SBFM reports `Expected an instance of Response to be returned` in /middleware. Its new NextRequest instanceof guard returns the original request if runtime/app constructors differ. Three added regression cases failed before the fix.
- Plan: return explicit request/response variants from normalization; branch on the variant in proxy and auth GET/POST; preserve direct NextAuth dispatch and Windows origin policies; exercise duplicate NextRequest constructors.
- Acceptance: cloud requests reach authentication, handlers return responses, Windows origin rejection/redirect/header/body/cookie behavior remains intact, protected routes remain authenticated, focused tests/lint pass, GitHub CI passes, production is verified live.
- Permissions: user explicitly asked to fix this on Vercel; root may publish and land the fix and use the existing GitHub deployment workflow. No DNS, database, environment, or unrelated production configuration changes are in scope.
- Review output: actionable findings with file lines, verdict, full reviewed SHA, provider/model/effort and checks. Root materializes review output and receipt.md; reviewers have no writer lease.
- Release: one small fix; no schema or environment changes. Canonical main is /Users/peuan/songdee-dashboard. Use PR and existing CI deployment after green checks.
- Planning: direct mechanical fix following reproduced failure; no architecture planning lane required.
- Validation scope: local tests restricted to the two affected test files; broad lint/test/build belongs to GitHub CI under user/project instructions.

The user-authorized Vercel repair takes precedence over the generic personal skill's user-run-only deployment guidance. This repository already deploys main through GitHub Actions.
