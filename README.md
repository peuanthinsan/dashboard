# SongdeeGPS Dashboard

Fleet safety and driving analytics dashboard for SongdeeGPS. Monitors alerts, driver performance, and fleet metrics with data sourced from Google Sheets.

## Features

- **Multi-tenant**: Companies, organizations (fleets), and role-based access
- **Dashboard templates**: Summary, Detail, Simple, Driving, Video
- **Google Sheets integration**: Dashboards pull live data from configured spreadsheets
- **i18n**: English and Thai
- **Dark mode**: System preference with manual override

## Prerequisites

- Node.js 18+
- PostgreSQL (e.g. [Neon](https://neon.tech) or local)
- pnpm (`npm i -g pnpm`)

## Environment Variables

Create `.env.local`:

```env
POSTGRES_URL="postgresql://user:pass@host/db?sslmode=require"
AUTH_SECRET="your-secret"  # Generate: openssl rand -base64 32
```

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database Migrations

Run migrations before first use:

```bash
pnpm db:migrate
```

## Google Sheets Setup

Each dashboard is linked to a Google Sheet via:

- **Sheet ID**: From the URL `docs.google.com/spreadsheets/d/{sheetId}/...`
- **GID**: The sheet tab ID (from `gid=` in the URL)

Sheets must be **published to the web** or **shared with "Anyone with the link"** (view only) for the GVIZ API to work. The app fetches data via `/api/sheets/[sheetId]/[gid]` (server-side proxy with caching).

## Scripts

| Command        | Description                    |
|----------------|--------------------------------|
| `pnpm dev`     | Start dev server (Turbopack)   |
| `pnpm build`   | Production build              |
| `pnpm start`   | Start production server        |
| `pnpm lint`    | Run ESLint                     |
| `pnpm db:migrate` | Run Drizzle migrations     |
| `pnpm test`    | Run unit tests                 |
| `pnpm test:e2e`| Run E2E tests (Playwright)     |

## Deployment (Vercel)

1. Connect the repo to Vercel
2. Add `POSTGRES_URL` and `AUTH_SECRET` in project settings
3. Run migrations against the production database
4. Deploy

## Tech Stack

- Next.js 16, React 19, TypeScript
- Drizzle ORM, PostgreSQL
- NextAuth 5 (Credentials)
- Tailwind CSS, Geist font
