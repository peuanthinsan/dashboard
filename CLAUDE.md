# songdee-dashboard

Multi-tenant fleet driver-safety dashboards (Next.js App Router) rendering customer
Google Sheets. **Full project context lives in the user-global skill
`songdee-dashboard-dev` — invoke it at the start of any task here.** This file holds only
the always-needed basics; the skill holds the depth (architecture map, debugging
playbook, escalation triggers).

## Commands

- **Dev:** `npm run dev` · **Build:** `npm run build` · **Lint:** `npm run lint`
- **Unit tests:** `npm test` (Vitest, co-located `app/**/*.test.ts`) · **e2e:** `npm run test:e2e`
- **Migrations:** `npm run db:migrate` runs `scripts/migrate.ts` — hand-maintained inline
  SQL; it does NOT execute `migrations/*.sql`. New migrations go in BOTH places.
- Vercel builds with npm (vercel.json); ignore the extra bun/pnpm lockfiles — known drift,
  don't clean up.

## Top invariants (details in the skill)

1. **Template parity is by copy** — filter/scoping/persistence changes and findValue
   alias-list changes must be mirrored across every template that carries the equivalent
   block — grep them all; DynamicTrip's fleet-scoping is a deliberate no-op. One-template
   fixes are incomplete. Shared alias constants (e.g. `ALERT_TIME_ALIASES` in
   `dashboardDataUtils.ts`) are the preferred home for new aliases.
2. **One timezone convention (Bangkok-as-UTC)** — since `c0cbd77`, `parseDate` stamps each
   sheet timestamp's Bangkok wall-clock digits into a UTC instant (`Date.UTC`), and every
   reader formats with `getUTC*` / `timeZone:'UTC'`, so values are identical for any viewer
   timezone. Sole exception: `app/ui/exportCsvFormat.ts` (own parser, deliberate local
   round-trip). Reading a parsed value with local getters reintroduces a viewer shift.
3. **Fleet scoping matches Organization NAMES to the sheet's Fleet column** — renaming an
   org in admin silently breaks existing dashboards.
4. **`Dashboard.organizationId` stays mirrored to `organizationIds[0]`** — LINE channels,
   permissions, and sheet access still read the scalar.
5. **Dashboard counts intentionally differ from raw sheets** — blank-remark rows and
   "false alert"/"no video" remarks are excluded by design.

## Verification before claiming done

`npm run lint && npm test && npm run build` — there is no CI beyond Vercel's build.

## Workflow

- **Models:** plan on Fable/Opus; code with Codex by default (codex-delegation skill — Codex prompts must forbid git); review/verify/git on Fable/Opus. Sequencing, verification matrix, escalation: `songdee-fleet-workflow`.
- **Git:** worktree + feature branch + PR. The main checkout is often mid-feature — don't disturb it (`git-rescue-and-parallel-sessions`).
- **Deploy:** a push NEVER deploys (`git.deploymentEnabled:false`, region `sin1`); `vercel deploy --prod` on user request — commands in `peuan-portfolio`.
- **Metrics:** semantics live in `docs/METRICS.md` — update it in the same PR when they change.
- Related repos: the six `~/*-dvis` customer inspection apps (see `dvis-fleet-apps` — inspection/unit-status screens live there, not here).
