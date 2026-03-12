# SongdeeGPS Dashboard V2 — Complete Product Design

**Date:** 2026-03-13
**Approach:** Component-First Rebuild
**Status:** Draft

## Overview

A fleet safety analytics dashboard where fleet owners track alerts (fatigue, distraction, yawning, speeding, etc.), driving metrics (trips, distance, duration), and driver performance over time. Data is sourced from Google Sheets. The product serves fleet owners who need key insights quickly.

### Core Principles

- Clean, professional enterprise SaaS aesthetic
- Data-focused — every element earns its screen space
- Fast insight — KPIs and trends visible at a glance
- Consistent — shared design system across all views

### Product Scope

- **4 dashboard templates:** Summary, Detail, Simple, Driving (Video template removed — video evidence is now a section within Detail Dashboard. Existing Video dashboards in the database render using the Detail template with the video section visible.)
- **Admin panel:** Companies, fleets, users, dashboards with bulk operations
- **Authentication:** Email + password with admin roles
- **Data source:** Google Sheets (visualization API)
- **Bilingual:** English and Thai
- **Dark mode** with system preference detection
- **CSV export** on all dashboards

---

## 1. Design System & Visual Language

### Color Palette

- **Primary:** Indigo/blue tones — professional, trustworthy, works well for data
- **Neutrals:** Zinc scale — clean grays for backgrounds, borders, text
- **Semantic colors:**
  - Green — safe/good/excellent (safety score 90+)
  - Blue — good (safety score 70-89)
  - Amber — warning/moderate (safety score 50-69)
  - Red — danger/poor (safety score <50)
- **Chart colors:** 8-10 distinct, accessible colors using the Okabe-Ito palette (avoids red/green adjacency issues for protanopia/deuteranopia)

### Typography

- **Font:** Geist Sans — clean, modern, highly legible for data
- **Hierarchy:** Page titles → section headings → card labels → body text → captions

### Component Library

| Component | Purpose |
|-----------|---------|
| KpiCard | Metric display with label, value, trend indicator, optional unit |
| SafetyScore | Circular gauge (0-100) with color-coded thresholds |
| DonutChart | Proportional breakdown with legend |
| AlertHeatmap | 7x24 grid showing alert density by day/hour |
| DriverLeaderboard | Ranked driver list with scores and medal indicators |
| TrendChart | SVG line/bar chart for time-series data (see details below) |
| DataTable | Sortable, filterable table with consistent styling (see details below) |
| Sparkline | Small inline SVG chart for embedding trends in table rows |
| FilterGroup/FilterChip | Filter UI with clear buttons and counts |
| EmptyState | Centered message when no data matches filters |
| ExportButton | CSV download with proper encoding |

#### TrendChart

SVG-based chart component supporting multiple visualization modes:

- **Props:** `data` (array of `{label, value}` or `{label, values: Record<string, number>}` for multi-series), `mode` ("line" | "bar" | "dual-axis"), `height`, `colors` (optional, defaults to chart palette)
- **Line mode:** Connected points with optional area fill, used for alert trends over time
- **Bar mode:** Vertical bars, used for distance/trip counts
- **Dual-axis mode:** Bars on left axis + line on right axis (e.g., distance bars with trip count line overlay in Driving Dashboard)
- **Features:** X-axis labels, Y-axis ticks, hover tooltips, responsive width
- Built on the existing `buildTrendGeometry()`, `buildXAxisLabels()`, `buildYAxisTicks()` utilities in `dashboardDataUtils.ts`

#### DataTable

Generic sortable table component:

- **Props:** `columns` (array of `{key, label, sortable?, render?}`), `data` (array of row objects), `defaultSort` (optional `{key, direction}`), `onRowClick` (optional)
- **Sorting:** Click column headers to sort asc/desc, visual indicator on active sort column
- **Rendering:** Custom `render` function per column for formatting (e.g., color-coded badges, sparklines, links)
- **Styling:** Uses design token table classes (tableHead, tableRow, tableCell)
- **Scrolling:** Horizontal scroll on narrow viewports, sticky first column optional

#### Sparkline

Minimal inline SVG chart for embedding in table cells:

- **Props:** `data` (array of numbers), `width` (default 80px), `height` (default 24px), `color` (optional)
- **Renders:** Simple polyline with no axes, labels, or interactivity — just the trend shape
- **Use case:** Driver statistics table in Driving Dashboard to show monthly distance pattern per driver

### Surfaces

- Background (page level) → Surface (card level) → Inset (nested sections)
- Subtle borders, no heavy shadows — flat and modern

---

## 2. Authentication & Onboarding

### Login Page (`/login`)

- Split layout: left branded panel (SongdeeGPS logo, tagline, feature highlights), right login form
- Email + password fields with Zod validation (email format, 8-72 char password)
- Error messaging for invalid credentials
- Link to registration page

### Registration Page (`/register`)

- Same split layout for consistency
- Email + password with validation
- Rate limiting (5 attempts/min, enforced server-side via in-memory counter per IP in the server action — existing approach)
- First registered user auto-becomes admin

### Post-Login Routing

- All users route to `/dashboard`
- Admin shortcut visible on dashboard for admin users

---

## 3. Dashboard Hub (`/dashboard`)

The landing page after login — navigation to all assigned dashboards.

- **Welcome banner** — personalized greeting with user email, live data indicator
- **Dashboard cards** — grid of assigned dashboards, each showing:
  - Dashboard name
  - Template type badge (Summary/Detail/Simple/Driving)
  - Company and fleet labels
  - Click to open
- **Language toggle** (EN/TH)
- **Admin shortcut** for admin users
- **Sign out**

---

## 4. Summary Dashboard

High-level overview — "how are we doing?"

### KPI Row

- Total alerts (with trend vs previous period)
- Safety score (circular gauge, 0-100)
- Total vehicles monitored
- Total drivers

### Alert Breakdown Section (3 Donut Charts)

- **By alert type** — distraction, fatigue, yawning, speeding, etc.
- **By vehicle** — which vehicles generate the most alerts
- **By driver** — which drivers generate the most alerts

### Driver Performance Section

- Safest drivers leaderboard (top 5, with medals and scores)
- Riskiest drivers leaderboard (top 5)

### Temporal Patterns Section

- Alert heatmap — 7 days x 24 hours grid showing when alerts cluster
- Monthly trend line chart — alerts over time

### Monthly Comparison

- Current vs previous month per alert type with color coding

### Filters

- Month selector
- Fleet/organization filter

---

## 5. Detail Dashboard

Deep-dive view for investigating specific alerts.

### KPI Row

- Total alerts (with trend)
- Filtered alert count
- Unique vehicles
- Unique drivers

### Trend Section

- Line chart showing alert counts over time, broken down by remark type
- Filterable to specific alert types

### Alert Heatmap

- 7x24 day/hour grid, responsive to active filters

### Alert Timeline

- Chronological feed of the most recent 20-30 alerts
- Shows sequence of events (useful for spotting patterns like "same driver, 3 fatigue alerts in 2 hours")

### Driver Summary Cards

- When filtering to a specific driver, show a mini-profile:
  - Total alerts, most common alert type, safety score, active days

### Fleet Comparison

- When no fleet filter is active, bar chart comparing alert counts across fleets

### Alert Table

- Sortable columns: date/time, vehicle, driver, speed, fleet, remark type
- Video link column (where available)
- Remark type color coding

### Video Evidence Section

- Grouped by alert type (Fatigue, Distraction, Yawning, Smoking, etc.)
- 10 most recent videos per type
- Each video card shows: link, vehicle, driver, timestamp, speed
- No thumbnails
- Responsive to active filters

### Filters

- Month selector
- Fleet filter
- Remark type filter
- Vehicle filter
- Driver filter
- Excluded remarks toggle (false alerts, no video)

---

## 6. Simple Dashboard

Lightweight view focused on the three core driver behavior alerts only.

### Alert Type Scope

**Only tracks these 3 alert categories (ignores all others):**

- **Yawning** — includes both "Yawning" (A2 alert type) AND "Eye Closing" (A2 alert type) when remark is "Yawning"
- **Distraction**
- **Fatigue**

### KPI Row

- Total alerts (with trend)
- Date range covered
- Unique vehicles
- Unique drivers

### Trend Section

- Line chart showing alert counts over the selected date range

### Alert Summary Table

- Grouped/sortable by vehicle or driver
- Columns: vehicle, driver, alert type, count
- Compact rows for scanning

### Filters

- Date range picker
- Vehicle filter
- Driver filter
- Alert type filter (yawning/distraction/fatigue only)

---

## 7. Driving Dashboard

Fleet operations view — distance, trips, and driver activity.

### KPI Row

- Total trips (with trend vs previous period)
- Total distance in km (with trend)
- Total duration in hours (with trend)
- Average distance per trip

### Monthly Trend Section

- Dual-axis chart — distance bars with trip count line overlay
- Shows if trips are getting longer or shorter over time

### Driver Activity Section

- **Top 5 most active drivers** — ranked by distance, with trip count and avg duration per trip
- **Least active drivers** — bottom 5, helps spot underutilization

### Driver Statistics Table

- Columns: driver name, trip count, total distance, total duration, avg distance/trip, avg duration/trip
- Sortable by any column
- Sparkline trend per driver (small inline chart showing monthly distance pattern)

### Filters

- Date range picker
- Driver filter

---

## 8. Admin Panel

### Overview Page (`/admin`)

- Stat cards: total companies, fleets, users, dashboards
- Quick links to each management section
- Recent activity summary — derived from database state (e.g., newest users, recently created dashboards) rather than an event log, so no schema changes needed
- System health indicator — spot-checks a sample Google Sheet connection on page load (3-second timeout, non-blocking; shows "no dashboards" state if none exist yet)
- **Quick setup wizard** — guided flow: create company → create fleet → add dashboard → invite user

### Companies (`/admin/companies`)

- CRUD for company profiles (unique name)
- Dashboard count and user count per company
- **Bulk create** — paste a list of company names to create many at once
- **Bulk delete** — select multiple companies to remove

### Fleets (`/admin/organizations`)

- CRUD for fleet groups (name + company assignment)
- Dashboard count and user count per fleet
- **Bulk create** — paste a list of fleet names, assign all to the same company
- **Bulk reassign** — move multiple fleets to a different company
- **Bulk delete**

### Users (`/admin/users`)

- Create/edit/delete users (email, password, admin toggle)
- Assign to multiple companies and fleets (fleets filtered by company)
- Dashboard access summary per user
- **Bulk create** — paste a list of emails, auto-generated or shared password
- **Bulk assign to company** — select multiple users, assign all to a company
- **Bulk assign to fleet** — select multiple users, assign all to a fleet
- **Bulk toggle admin** — promote/demote multiple users at once
- **Bulk delete**

### Dashboards (`/admin/dashboards`)

- Create/edit/delete dashboards (name, template, Google Sheet URL with auto-extract, company, fleet, notes)
- Data status indicator — shows if linked Google Sheet is accessible
- Preview link — quick link to open dashboard without leaving admin
- **Duplicate dashboard** — copy config to create new one
- **Bulk create from template** — pick template + Google Sheet, create dashboards for multiple fleets at once
- **Bulk assign to fleet** — reassign multiple dashboards to a different fleet
- **Bulk delete**

---

## 9. Cross-Cutting Concerns

### Dark Mode

- System preference detection with manual toggle override
- CSS custom properties for all theme values
- Persisted in localStorage
- No flash of wrong theme on page load — achieved via inline `<script>` in `<head>` that reads localStorage before first paint and sets the `dark` class on `<html>`

### Internationalization (EN/TH)

- Cookie-based language switching (1-year expiry)
- All UI labels, empty states, actions, tooltips translated
- Number formatting respects locale
- Date formatting uses locale-appropriate display
- Language toggle accessible from dashboard hub

### Data Layer

- Google Sheets as sole data source via visualization API
- 5-minute localStorage cache (2MB limit) with in-memory cache
- Case-insensitive column matching
- **Yawning mapping rule (global):** "Eye Closing" A2 alerts with "Yawning" remark count as Yawning across all dashboards
- Skeleton loading screens matching each dashboard's layout
- Error recovery — clear messages when Google Sheet unreachable, with retry button
- Stale data indicator — subtle badge when showing cached data older than 5 minutes

### CSV Export

- Available on all dashboard types
- Client-side generation with BOM for Excel compatibility
- Exports filtered data (respects active filters)
- Filename includes dashboard name and date range

### Responsive Design

- Desktop-first but functional on tablet
- KPI cards reflow to stack on smaller screens
- Tables get horizontal scroll on narrow viewports
- SVG charts scale gracefully without losing legibility

### Filter Persistence (existing — verify/preserve)

- Active filters saved to localStorage per dashboard (existing `filterStorage.ts`)
- Restored on return visits
- Clear all filters button on every dashboard
- Active filter summary — visible count of how many filters are applied

### Accessibility

- Keyboard navigation for all interactive elements
- Color-blind safe chart palette — not relying solely on color
- Proper ARIA labels on charts and interactive components

---

## 10. Technical Architecture

### Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Auth:** NextAuth.js 5 (Credentials provider, bcrypt-ts)
- **Database:** PostgreSQL via Drizzle ORM
- **Styling:** Tailwind CSS with design tokens
- **Font:** Geist Sans
- **Validation:** Zod

### Database Schema (unchanged)

- **User** — id, email, password (hashed), isAdmin, companyId, organizationId
- **Company** — id, name (unique)
- **Organization** (Fleet) — id, name (unique), companyId
- **UserCompany** — userId + companyId (many-to-many)
- **UserOrganization** — userId + organizationId (many-to-many)
- **Dashboard** — id, publicId (UUID), name, template (Summary/Detail/Simple/Driving), sheetId, sheetGid, sheetUrl, notes, companyId, organizationId

### Data Flow

1. Admin creates dashboard with Google Sheet URL
2. System auto-extracts sheetId and sheetGid from URL
3. User opens dashboard → `useGoogleSheet` hook fetches data via visualization API
4. Data cached in localStorage (5-min TTL) and in-memory
5. Dashboard template parses columns, applies filters, renders visualizations
6. User interactions (filters, sorts) happen client-side on cached data

### Build Approach (Component-First)

1. Design tokens and base styles
2. Core UI components (KpiCard, DonutChart, SafetyScore, etc.)
3. Shared dashboard infrastructure (DashboardShell, filters, data utils)
4. Individual dashboards (Summary → Detail → Simple → Driving)
5. Dashboard hub
6. Admin panel with bulk operations
7. Auth pages (login/register)
