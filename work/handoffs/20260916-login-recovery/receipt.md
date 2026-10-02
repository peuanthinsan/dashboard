# Login recovery — 16 September 2026

Status: recovered.

The user explicitly approved restarting the existing production PostgreSQL service after the Dashboard login outage was traced to connection refusals at 127.0.0.1:5432. Dashboard's login handler displayed the database failure as invalid credentials.

Recovery completed at 2026-09-16T08:40:44Z (15:40:44 Asia/Bangkok). The existing postgresql-songdee-17 service is Running and pg_isready reports accepting connections.

Verification:
- Existing Dashboard, SVIS and OPS health checks all passed through Recover-Postgres.ps1; administrator recovery exit code 0.
- Dashboard's real authentication callback performed its database lookup and rejected one intentionally nonexistent diagnostic account with CredentialsSignin, rather than CallbackRouteError.
- Public https://dashboard.songdeegps.com/login returned HTTP 200.
- A successful sign-in with the user's own credentials remains for the user to confirm; no real password was requested or used.

Scope: start the existing stopped PostgreSQL service and verify recovery. No passwords, accounts, database data/schema, production configuration, deployment scripts or application code were changed. No GitHub sign-in/publication or deployment optimization rollout was authorized by this restart approval.

Related historical report: ../20260916-deployment-speed/report.md. Its pending database recovery statements describe the state before this recovery. The earlier benchmark's Windows compiler-cache optimization was removed; future resource-intensive benchmark work should use a separate host from production.
