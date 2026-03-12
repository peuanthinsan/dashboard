# SongdeeGPS Dashboard V2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the SongdeeGPS fleet safety dashboard from scratch with a component-first approach, delivering 4 dashboard templates, admin panel with bulk operations, and bilingual auth pages — all backed by Google Sheets data.

**Architecture:** Component-first rebuild. Build a design token system and reusable UI components first, then compose them into dashboard templates, a dashboard hub, admin panel, and auth pages. All dashboard data comes from Google Sheets via the existing `useGoogleSheet` hook. Database schema is unchanged.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, NextAuth.js 5, Drizzle ORM, PostgreSQL, Zod, bcrypt-ts, Geist Sans

**Spec:** `docs/superpowers/specs/2026-03-13-songdee-dashboard-v2-design.md`

---

## Chunk 1: Design System Foundation

### Task 1: Update Design Tokens

**Files:**
- Modify: `app/ui/design-tokens.ts`

- [ ] **Step 1: Read the current design tokens file**

Read `app/ui/design-tokens.ts` to understand the existing token structure.

- [ ] **Step 2: Update CHART_COLORS to Okabe-Ito palette**

Replace the current `CHART_COLORS` array with Okabe-Ito accessible colors:

```typescript
export const CHART_COLORS = [
  '#0072B2', // blue
  '#E69F00', // orange
  '#009E73', // green
  '#CC79A7', // pink
  '#56B4E9', // light blue
  '#D55E00', // red-orange
  '#F0E442', // yellow
  '#000000', // black
  '#332288', // indigo
  '#88CCEE', // cyan
];
```

- [ ] **Step 3: Verify existing tokens cover all spec needs**

Check that surface, typography, card, badge, button, form, table, and layout tokens all exist. Add any missing tokens needed by the spec:

- Ensure `badgeInfo` exists for template type badges
- Ensure table tokens include sticky header support class
- Add `filterChipActive` and `filterChipMuted` tokens if not present

- [ ] **Step 4: Commit**

```bash
git add app/ui/design-tokens.ts
git commit -m "feat: update chart colors to Okabe-Ito accessible palette and verify design tokens"
```

---

### Task 2: Update Global CSS and Dark Mode

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Read current globals.css and layout.tsx**

Read both files to understand current theme approach.

- [ ] **Step 2: Add inline dark mode script to layout.tsx**

Add an inline `<script>` in the `<head>` that reads localStorage before first paint to prevent flash of wrong theme:

```tsx
// In layout.tsx, inside <html> before <body>:
<head>
  <script dangerouslySetInnerHTML={{ __html: `
    (function() {
      try {
        var theme = localStorage.getItem('theme');
        if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
      } catch(e) {}
    })();
  `}} />
</head>
```

- [ ] **Step 3: Verify CSS custom properties cover light and dark modes**

Ensure `globals.css` defines CSS custom properties for both modes with the zinc/indigo palette specified in the spec. Verify all semantic color variables (success, warning, danger, info) are present.

- [ ] **Step 4: Verify no flash by testing**

Run the dev server and confirm dark mode loads without a flash:

```bash
npm run dev
```

Open browser, set dark mode in localStorage, reload. Verify no white flash.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: add inline dark mode script to prevent theme flash"
```

---

### Task 3: Build TrendChart Component

**Files:**
- Create: `app/ui/TrendChart.tsx`

- [ ] **Step 1: Define component types**

```typescript
'use client';

export type TrendDatum = { label: string; value: number };
export type MultiTrendDatum = { label: string; values: Record<string, number> };
export type TrendChartMode = 'line' | 'bar' | 'dual-axis';

interface TrendChartProps {
  data: TrendDatum[] | MultiTrendDatum[];
  mode?: TrendChartMode;
  height?: number;
  colors?: string[];
  className?: string;
  ariaLabel?: string;
}
```

- [ ] **Step 1b: Read dashboardDataUtils.ts**

Read `app/dashboards/dashboardDataUtils.ts` to understand `buildTrendGeometry()`, `buildXAxisLabels()`, and `buildYAxisTicks()` — the TrendChart builds on these.

- [ ] **Step 2: Implement the TrendChart component**

Build an SVG-based chart supporting three modes:
- **Line mode:** Connected points with optional area fill. Use `buildTrendGeometry()` from `dashboardDataUtils.ts` for coordinate calculation.
- **Bar mode:** Vertical bars with padding between them.
- **Dual-axis mode:** Bars on left Y-axis + line on right Y-axis. First series = bars, second series = line.

**Runtime type discrimination:** Detect `MultiTrendDatum[]` by checking if the first element has a `values` property (object) vs a `value` property (number). Line mode uses `TrendDatum[]`, dual-axis uses `MultiTrendDatum[]` (first key = bars, second key = line), bar mode accepts either.

Include: X-axis labels, Y-axis ticks (using `buildYAxisTicks()`), responsive width via `viewBox`, hover tooltips via title elements, ARIA label.

- [ ] **Step 3: Test in dev server**

Import the component temporarily in a dashboard to verify rendering with sample data. Check line, bar, and dual-axis modes.

- [ ] **Step 4: Commit**

```bash
git add app/ui/TrendChart.tsx
git commit -m "feat: add TrendChart component with line, bar, and dual-axis modes"
```

---

### Task 4: Build DataTable Component

**Files:**
- Create: `app/ui/DataTable.tsx`

- [ ] **Step 1: Define component types**

```typescript
'use client';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
  stickyLeft?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  defaultSort?: { key: string; direction: 'asc' | 'desc' };
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
}
```

- [ ] **Step 2: Implement the DataTable component**

Build a generic sortable table:
- Click column header to toggle sort (asc → desc → none)
- Active sort column shows arrow indicator (▲/▼)
- Custom `render` function per column for formatting
- Uses design tokens: `tableHead`, `tableHeadCell`, `tableRow`, `tableCell`
- Horizontal scroll wrapper on narrow viewports
- Optional `stickyLeft` on first column via `sticky left-0`
- Keyboard accessible headers (Enter/Space to sort)

- [ ] **Step 3: Test in dev server**

Verify sorting works, custom renderers display correctly, and horizontal scroll appears on small viewports.

- [ ] **Step 4: Commit**

```bash
git add app/ui/DataTable.tsx
git commit -m "feat: add generic DataTable component with sorting and custom renderers"
```

---

### Task 5: Build Sparkline Component

**Files:**
- Create: `app/ui/Sparkline.tsx`

- [ ] **Step 1: Implement the Sparkline component**

```typescript
'use client';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}

export default function Sparkline({
  data,
  width = 80,
  height = 24,
  color = '#6366f1',
  className = '',
}: SparklineProps) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(' ');
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label="Trend sparkline"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/ui/Sparkline.tsx
git commit -m "feat: add Sparkline component for inline trend visualization"
```

---

### Task 6a: Update Chart/Visualization Components for V2

**Files:**
- Modify: `app/ui/KpiCard.tsx`
- Modify: `app/ui/DonutChart.tsx`
- Modify: `app/ui/SafetyScore.tsx`

- [ ] **Step 1: Read KpiCard, DonutChart, SafetyScore**

Read each file to understand current implementation.

- [ ] **Step 2: Update KpiCard**

- Add `unit` prop (string, optional) displayed after the value
- Ensure trend arrow uses semantic colors from design tokens (green for positive, red for negative)
- Add `role="region"` and `aria-label` with the card's label text
- Verify all text colors use design token classes (no hardcoded hex)

- [ ] **Step 3: Update DonutChart**

- Replace any hardcoded color references with `CHART_COLORS` (now Okabe-Ito palette)
- Add `role="img"` and `aria-label` describing the chart (e.g., "Alert distribution by type")
- Verify legend text is readable in dark mode

- [ ] **Step 4: Update SafetyScore**

- Verify threshold colors (green/blue/amber/red) have sufficient contrast in both light and dark modes
- Add `role="img"` and `aria-label` (e.g., "Safety score: 85 out of 100, Good")
- Ensure the circular SVG clamps correctly at 0 and 100

- [ ] **Step 5: Commit**

```bash
git add app/ui/KpiCard.tsx app/ui/DonutChart.tsx app/ui/SafetyScore.tsx
git commit -m "feat: update KpiCard, DonutChart, SafetyScore for V2 with accessibility"
```

---

### Task 6b: Update Remaining UI Components for V2

**Files:**
- Modify: `app/ui/AlertHeatmap.tsx`
- Modify: `app/ui/DriverLeaderboard.tsx`
- Modify: `app/ui/TrendIndicator.tsx`
- Modify: `app/ui/EmptyState.tsx`
- Modify: `app/ui/ExportButton.tsx`

- [ ] **Step 1: Read AlertHeatmap, DriverLeaderboard, TrendIndicator, EmptyState, ExportButton**

Read each file.

- [ ] **Step 2: Update AlertHeatmap**

- Add `role="img"` and `aria-label` describing the heatmap
- Ensure heatmap intensity colors (green → amber → red scale) work in dark mode — avoid pure white backgrounds on cells
- Add a secondary visual cue beyond color (e.g., cell text shows count when > 0) for color-blind accessibility

- [ ] **Step 3: Update DriverLeaderboard**

- Ensure medal colors (gold #EAB308, silver #94A3B8, bronze #D97706) have sufficient contrast on dark backgrounds
- Add `role="list"` on container, `role="listitem"` on each driver row
- Verify score text color matches safety threshold semantics

- [ ] **Step 4: Update TrendIndicator, EmptyState, ExportButton**

- **TrendIndicator:** Verify green/red arrow colors have ≥4.5:1 contrast ratio in both themes. If `invertColor` is true, swap semantics.
- **EmptyState:** Ensure icon and text use `textMuted` / `textSecondary` design tokens
- **ExportButton:** Update to accept `dashboardName` and `dateRange` props, include them in the generated filename (e.g., `SummaryDashboard_2026-03.csv`)

- [ ] **Step 5: Commit**

```bash
git add app/ui/AlertHeatmap.tsx app/ui/DriverLeaderboard.tsx app/ui/TrendIndicator.tsx app/ui/EmptyState.tsx app/ui/ExportButton.tsx
git commit -m "feat: update heatmap, leaderboard, trend, empty state, export for V2"
```

---

## Chunk 2: Dashboard Infrastructure

### Task 7: Update Data Utilities

**Files:**
- Modify: `app/dashboards/dashboardDataUtils.ts`

- [ ] **Step 1: Read current data utilities**

Read `app/dashboards/dashboardDataUtils.ts` to understand all exports and the yawning mapping logic.

- [ ] **Step 2: Verify yawning mapping rule**

Confirm the `withDerivedRemark()` function correctly maps "Eye Closing" A2 alerts with "Yawning" remark to count as Yawning. This rule must be applied globally across all dashboards. If not already implemented correctly, fix it.

The rule: Any row where the alert type is "Eye Closing" (A2) AND the remark column contains "Yawning" should be treated as a "Yawning" alert.

- [ ] **Step 3: Add Video template → Detail fallback mapping**

Add a utility function to handle legacy Video dashboards:

```typescript
export function resolveTemplate(template: string): string {
  if (template === 'Video') return 'Detail';
  return template;
}
```

- [ ] **Step 4: Commit**

```bash
git add app/dashboards/dashboardDataUtils.ts
git commit -m "feat: verify yawning mapping rule and add Video→Detail template fallback"
```

---

### Task 8: Update DashboardShell

**Files:**
- Modify: `app/dashboards/DashboardShell.tsx`

- [ ] **Step 1: Read current DashboardShell**

Read `app/dashboards/DashboardShell.tsx`.

- [ ] **Step 2: Update for V2 design**

- Ensure consistent use of design tokens (`pageContainer`, `pageContent`, `cardBase`)
- Add stale data indicator badge (shows when cached data is older than 5 minutes)
- Add clear all filters button slot (passed via `actions` prop)
- Add active filter count display
- Ensure skeleton loading state matches dashboard layout structure
- Verify back navigation, title, subtitle, notes, last updated timestamp all work

- [ ] **Step 3: Commit**

```bash
git add app/dashboards/DashboardShell.tsx
git commit -m "feat: update DashboardShell with stale data indicator and V2 design tokens"
```

---

### Task 9: Update Filter Components

**Files:**
- Modify: `app/dashboards/FilterChip.tsx`
- Modify: `app/dashboards/FilterGroup.tsx`

- [ ] **Step 1: Read current filter components**

Read both filter files.

- [ ] **Step 2: Update for V2 design**

- **FilterChip:** Ensure uses design tokens, accessible keyboard navigation (focusable, Enter/Space activation)
- **FilterGroup:** Add active filter count display, ensure "clear" button is keyboard accessible, verify i18n support for labels

- [ ] **Step 3: Commit**

```bash
git add app/dashboards/FilterChip.tsx app/dashboards/FilterGroup.tsx
git commit -m "feat: update filter components with accessibility and V2 styling"
```

---

### Task 10: Update LoadingState

**Files:**
- Modify: `app/dashboards/LoadingState.tsx`

- [ ] **Step 1: Read current LoadingState**

Read `app/dashboards/LoadingState.tsx`.

- [ ] **Step 2: Update skeleton to match dashboard layouts**

Replace generic skeleton with a layout-aware skeleton that mirrors the actual dashboard structure:
- KPI row (4 skeleton cards in a row)
- Chart section (wide skeleton rectangle)
- Table section (skeleton rows)
- Use `animate-pulse` with proper dark mode colors

Add error recovery state:
- When Google Sheet fetch fails, show clear error message with retry button
- Props: `error?: string`, `onRetry?: () => void`

- [ ] **Step 3: Commit**

```bash
git add app/dashboards/LoadingState.tsx
git commit -m "feat: update LoadingState with layout-aware skeleton and error recovery"
```

---

## Chunk 3: Summary & Simple Dashboards

### Task 11: Rebuild Summary Dashboard

**Files:**
- Modify: `app/dashboards/SummaryDashboard.tsx`

- [ ] **Step 1: Read current SummaryDashboard**

Read `app/dashboards/SummaryDashboard.tsx` (612 lines) to understand the full implementation.

- [ ] **Step 2: Rebuild Part 1 — Data flow, filters, and KPI row**

Preserve existing `useMemo` optimization chain:
rows → alertRows → baseFilteredRows → currentRows/previousRows → visualizations

**Filters:**
- Month selector using `FilterGroup` + `FilterChip`
- Fleet/organization filter using `FilterGroup` + `FilterChip`
- Persist in localStorage via `filterStorage.ts`

**KPI Row:**
- 4 `KpiCard` components: Total alerts (with `TrendIndicator`), Safety score (`SafetyScore` gauge), Total vehicles, Total drivers

- [ ] **Step 3: Rebuild Part 2 — Donut charts and leaderboards**

**Alert Breakdown Section (3 Donut Charts):**
- `DonutChart` by alert type
- `DonutChart` by vehicle
- `DonutChart` by driver name
- Arrange in 3-column responsive grid

**Driver Performance Section:**
- `DriverLeaderboard` variant="safest" (top 5)
- `DriverLeaderboard` variant="riskiest" (top 5)
- Side by side in 2-column grid

- [ ] **Step 4: Rebuild Part 3 — Temporal patterns, monthly comparison, and export**

**Temporal Patterns Section:**
- `AlertHeatmap` with filtered dates
- `TrendChart` mode="line" for monthly alert trend

**Monthly Comparison:**
- Current vs previous month per alert type cards with color coding
- Use `TrendIndicator` for each comparison

**CSV Export:** `ExportButton` with filtered data, filename includes dashboard name + month

- [ ] **Step 5: Verify all KPIs, donuts, leaderboards, heatmap, and trend chart render correctly**

Run dev server and open a Summary dashboard. Verify:
- 4 KPI cards display with correct values
- 3 donut charts show by type, vehicle, and driver
- Leaderboards rank correctly
- Heatmap renders with proper color intensity
- Monthly trend line renders
- Filters work and persist in localStorage
- CSV export includes correct data

- [ ] **Step 6: Commit**

```bash
git add app/dashboards/SummaryDashboard.tsx
git commit -m "feat: rebuild Summary Dashboard with V2 component library"
```

---

### Task 12: Rebuild Simple Dashboard

**Files:**
- Modify: `app/dashboards/SimpleDashboard.tsx`

- [ ] **Step 1: Read current SimpleDashboard**

Read `app/dashboards/SimpleDashboard.tsx` (958 lines).

- [ ] **Step 2: Rebuild Part 1 — Data filtering and KPI row**

Preserve existing `useMemo` optimization patterns for derived state.

**Alert Type Filtering (applied first, before any user filters):**
Apply the yawning mapping rule via `withDerivedRemark()` from `dashboardDataUtils.ts`:
- Filter rows to only include alerts where the derived remark is "Yawning", "Distraction", or "Fatigue"
- "Eye Closing" A2 alerts with "Yawning" remark → count as Yawning

**Filters:**
- Date range picker (native date inputs)
- Vehicle filter (`FilterGroup` + `FilterChip`)
- Driver filter (`FilterGroup` + `FilterChip`)
- Alert type filter (yawning/distraction/fatigue only)

**KPI Row:**
- 4 `KpiCard` components:
  - Total alerts (with trend vs previous period)
  - Date range (display as formatted string, e.g., "1 Mar – 13 Mar 2026", not a number)
  - Unique vehicles
  - Unique drivers

- [ ] **Step 3: Rebuild Part 2 — Trend chart, table, and export**

**Trend Section:**
- `TrendChart` mode="line" showing daily alert counts

**Alert Summary Table:**
- `DataTable` with columns: vehicle, driver, alert type, count
- Sortable by any column
- Compact styling

**CSV Export:**
- `ExportButton` with filtered data — CSV must only contain the 3 allowed alert types, not all alert data
- Filename includes dashboard name + date range

- [ ] **Step 4: Verify only 3 alert types shown, yawning mapping works**

Run dev server and confirm:
- Only Yawning, Distraction, Fatigue alerts appear
- "Eye Closing" with "Yawning" remark counted as Yawning
- No other alert types leak through
- Filters work and persist
- CSV export only contains the 3 alert types

- [ ] **Step 5: Commit**

```bash
git add app/dashboards/SimpleDashboard.tsx
git commit -m "feat: rebuild Simple Dashboard with 3-alert-type scope and V2 components"
```

---

## Chunk 4: Detail & Driving Dashboards

### Task 13: Rebuild Detail Dashboard

**Files:**
- Modify: `app/dashboards/DetailDashboard.tsx`
- Create: `app/dashboards/AlertTimeline.tsx` (extracted sub-component)
- Create: `app/dashboards/VideoEvidence.tsx` (extracted sub-component)
- Create: `app/dashboards/DriverSummaryCards.tsx` (extracted sub-component)

Extracting three new sections into focused sub-components keeps `DetailDashboard.tsx` manageable (the current file is 1233 lines and would grow further with new features).

- [ ] **Step 1: Read current DetailDashboard**

Read `app/dashboards/DetailDashboard.tsx` to understand the full implementation.

- [ ] **Step 2: Build AlertTimeline sub-component**

Create `app/dashboards/AlertTimeline.tsx`:

```typescript
'use client';

interface TimelineEntry {
  timestamp: Date;
  vehicle: string;
  driver: string;
  alertType: string;
  speed: string;
}

interface AlertTimelineProps {
  entries: TimelineEntry[];
  maxEntries?: number; // default 30
}
```

Renders a compact vertical list of the most recent alerts (sorted by timestamp desc, capped at `maxEntries`):
- Each row: time (formatted HH:MM), date (DD MMM), vehicle name, driver name, alert type badge, speed
- Compact single-line rows with subtle separators
- Alternating background for readability
- Highlight when same driver appears multiple times in close succession (e.g., same driver within 2 hours gets a subtle left border accent)

- [ ] **Step 3: Build VideoEvidence sub-component**

Create `app/dashboards/VideoEvidence.tsx`:

```typescript
'use client';

interface VideoEntry {
  url: string;
  vehicle: string;
  driver: string;
  timestamp: Date;
  speed: string;
  alertType: string;
}

interface VideoEvidenceProps {
  entries: VideoEntry[];
  maxPerType?: number; // default 10
}
```

- Groups entries by `alertType`
- Shows at most `maxPerType` videos per group (sorted by timestamp desc)
- Each video card renders: "Watch video" link (opens URL in new tab), vehicle, driver, formatted timestamp, speed
- Uses `EmptyState` when no videos match

- [ ] **Step 4: Build DriverSummaryCards sub-component**

Create `app/dashboards/DriverSummaryCards.tsx`:

```typescript
'use client';

interface DriverSummaryProps {
  driverName: string;
  totalAlerts: number;
  mostCommonType: string;
  safetyScore: number;
  activeDays: number;
}
```

Renders a 4-column `KpiCard` grid showing the selected driver's mini-profile.

- [ ] **Step 5: Rebuild DetailDashboard Part 1 (KPIs, Trend, Heatmap)**

**KPI Row:**
- 4 `KpiCard` components: Total alerts (with trend), Filtered alert count, Unique vehicles, Unique drivers

**Trend Section:**
- `TrendChart` mode="line" with multi-series data (one line per remark type)
- Filterable to specific alert types via active filters

**Alert Heatmap:**
- `AlertHeatmap` component, responsive to active filters

- [ ] **Step 6: Rebuild Part 2 (Timeline, Driver Cards, Fleet Comparison)**

**Alert Timeline:**
- Import and use `AlertTimeline` component with filtered data

**Driver Summary Cards:**
- Conditional section: only appears when a single driver is selected in filters
- Import and use `DriverSummaryCards` with computed props

**Fleet Comparison:**
- Conditional section: only appears when no fleet filter is active
- `TrendChart` mode="bar" comparing alert counts across fleets

- [ ] **Step 7: Rebuild Part 3 (Alert Table, Video Evidence)**

**Alert Table:**
- `DataTable` with columns: date/time, vehicle, driver, speed, fleet, remark type
- Video link column: renders as "Watch video" clickable link opening URL in new tab (where URL available), or empty cell if no URL
- Remark type column: color-coded badge using `badgeDefault`/`badgeWarning`/`badgeDanger`
- Sortable by all columns

**Video Evidence Section:**
- Import and use `VideoEvidence` component with filtered data
- Responsive to active filters

- [ ] **Step 8: Wire up filters**

**Filters:**
- Month selector
- Fleet filter
- Remark type filter
- Vehicle filter
- Driver filter
- Excluded remarks toggle (false alerts, no video)
- All use `FilterGroup` + `FilterChip`
- Persist in localStorage via existing `filterStorage.ts`

- [ ] **Step 9: Verify all sections render and respond to filters**

Run dev server with a Detail dashboard. Verify:
- All KPIs, trend, heatmap, timeline, table, video sections render
- Filtering a single driver shows driver summary cards
- Removing fleet filter shows fleet comparison
- Video section groups correctly
- CSV export works with filtered data

- [ ] **Step 10: Commit**

```bash
git add app/dashboards/DetailDashboard.tsx app/dashboards/AlertTimeline.tsx app/dashboards/VideoEvidence.tsx app/dashboards/DriverSummaryCards.tsx
git commit -m "feat: rebuild Detail Dashboard with timeline, driver cards, fleet comparison, and video section"
```

---

### Task 14: Rebuild Driving Dashboard

**Files:**
- Modify: `app/dashboards/DrivingDashboard.tsx`

- [ ] **Step 1: Read current DrivingDashboard**

Read `app/dashboards/DrivingDashboard.tsx` (277 lines).

- [ ] **Step 2: Rebuild with V2 components**

**KPI Row:**
- 4 `KpiCard` components: Total trips (with `TrendIndicator`), Total distance km (with trend), Total duration hours (with trend), Average distance per trip

**Monthly Trend Section:**
- `TrendChart` mode="dual-axis" — distance bars on left axis + trip count line on right axis
- Shows if trips are getting longer or shorter over time

**Driver Activity Section:**
- **Top 5 most active drivers:** Ranked by total distance, showing trip count and avg duration/trip. Use a compact card layout.
- **Bottom 5 least active drivers:** Same format, helps spot underutilization.

**Driver Statistics Table:**
- `DataTable` with columns: driver name, trip count, total distance, total duration, avg distance/trip, avg duration/trip
- Sortable by any column
- `Sparkline` component in a custom render column showing monthly distance pattern per driver

**Filters:**
- Date range picker
- Driver filter

**Data transformations:** Preserve existing `parseNumber()` and `parseDurationHours()` utilities for handling comma-separated numbers and HH:MM:SS format.

- [ ] **Step 3: Verify dual-axis chart, sparklines, and driver rankings render**

Run dev server with a Driving dashboard. Verify:
- Dual-axis chart shows distance bars + trip count line
- Top 5 / Bottom 5 drivers display correctly
- Sparklines render in table cells
- Sorting works on all columns
- CSV export includes all columns

- [ ] **Step 4: Commit**

```bash
git add app/dashboards/DrivingDashboard.tsx
git commit -m "feat: rebuild Driving Dashboard with dual-axis chart, driver rankings, and sparklines"
```

---

### Task 15: Remove VideoDashboard as Standalone Template

**Files:**
- Modify: `app/dashboard/[id]/page.tsx`
- Keep: `app/dashboards/VideoDashboard.tsx` (do not delete yet — reference for video section code in Task 13)

- [ ] **Step 1: Read the template resolution logic**

Read `app/dashboard/[id]/page.tsx` — this is where the template switch/mapping happens.

- [ ] **Step 2: Update template resolution**

Import and use the `resolveTemplate()` utility added in Task 7 (`app/dashboards/dashboardDataUtils.ts`) to map `'Video'` → `'Detail'` before the template switch. Then render `DetailDashboard` for the resolved template. This ensures existing Video dashboards in the database continue to work, rendering as Detail dashboards with the video evidence section visible.

- [ ] **Step 3: Verify legacy Video dashboards render as Detail**

If any Video-template dashboards exist in the test database, open them and verify they render using the Detail template.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/
git commit -m "feat: map legacy Video template to Detail dashboard"
```

---

## Chunk 5: Dashboard Hub & Auth Pages

### Task 16: Rebuild Dashboard Hub

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `app/dashboard/WelcomeBanner.tsx`
- Modify: `app/dashboard/DashboardCard.tsx`
- Modify: `app/dashboard/LanguageToggle.tsx`
- Modify: `app/dashboard/AdminShortcut.tsx`
- Remove: `app/dashboard/DashboardList.tsx` (replaced by DashboardCard grid in page.tsx)
- Remove: `app/dashboard/styles.ts` (superseded by design tokens)

- [ ] **Step 1: Read all dashboard hub files**

Read `page.tsx`, `WelcomeBanner.tsx`, `DashboardCard.tsx`, `DashboardList.tsx`, `styles.ts`, `LanguageToggle.tsx`, `AdminShortcut.tsx`. Note: `DashboardList.tsx` and `styles.ts` will be removed — their functionality is replaced by `DashboardCard` in a grid and design tokens respectively.

- [ ] **Step 2: Update WelcomeBanner**

- Personalized greeting with user email
- Live data indicator (animated green dot)
- Use design tokens for styling
- Bilingual support via i18n copy

- [ ] **Step 3: Update DashboardCard**

- Dashboard name prominently displayed
- Template type badge: Summary (indigo), Detail (violet), Simple (emerald), Driving (amber)
- Company and fleet labels below name
- Remove Video template color — Video renders as Detail
- Hover state using `cardHover` token
- Click navigates to dashboard

- [ ] **Step 4: Update LanguageToggle and AdminShortcut**

- **LanguageToggle:** Ensure uses design tokens, proper button styling
- **AdminShortcut:** Ensure uses design tokens, only visible to admins

- [ ] **Step 5: Update hub page layout**

- Use `pageContainer` / `pageContent` tokens
- Welcome banner at top
- Dashboard cards in responsive grid (1 col mobile, 2 col tablet, 3 col desktop)
- Language toggle and admin shortcut in header area
- Sign out button
- `EmptyState` when user has no dashboards

- [ ] **Step 6: Verify hub renders with correct cards, language toggle, admin shortcut**

Run dev server, log in, verify:
- Welcome banner shows correct email
- Dashboard cards display with correct template badges
- Language toggle switches EN/TH
- Admin shortcut visible for admin users only
- Sign out works

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/
git commit -m "feat: rebuild Dashboard Hub with V2 design and template badges"
```

---

### Task 17: Rebuild Login Page

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/login/login-form.tsx`

- [ ] **Step 1: Read current login files**

Read `app/login/page.tsx` and `app/login/login-form.tsx`.

- [ ] **Step 2: Rebuild login page with split layout**

**Left panel (branded):**
- SongdeeGPS logo/title
- Tagline: "Fleet Safety Analytics Dashboard"
- 3-4 feature highlights (e.g., "Real-time safety monitoring", "Driver performance tracking")
- Professional indigo/dark background

**Right panel (form):**
- "Sign in to your account" heading
- Email input with label
- Password input with label
- Error message display area
- Submit button using `btnPrimary` token
- Loading spinner during submission
- "Don't have an account? Register" link

**Validation:** Zod schema (email format, 8-72 char password) — existing server action.

- [ ] **Step 3: Verify login flow works end to end**

Run dev server, test:
- Valid credentials → redirects to `/dashboard`
- Invalid credentials → shows error
- Loading state during submission
- Link to register works

- [ ] **Step 4: Commit**

```bash
git add app/login/
git commit -m "feat: rebuild Login page with split layout and V2 design"
```

---

### Task 18: Rebuild Register Page

**Files:**
- Modify: `app/register/page.tsx`
- Modify: `app/register/register-form.tsx`

- [ ] **Step 1: Read current register files**

Read `app/register/page.tsx` and `app/register/register-form.tsx`.

- [ ] **Step 2: Rebuild register page with split layout**

Same split layout as login for consistency:
- Left branded panel (identical to login)
- Right panel: "Create your account" heading, email + password fields, submit button, error display, "Already have an account? Sign in" link
- Rate limiting (5 attempts/min) — existing server action
- First user auto-becomes admin — existing logic

- [ ] **Step 3: Verify registration flow**

Run dev server, test:
- New email → creates account, redirects to login
- Duplicate email → shows error
- Weak password → shows error
- Link to login works

- [ ] **Step 4: Commit**

```bash
git add app/register/
git commit -m "feat: rebuild Register page with split layout and V2 design"
```

---

## Chunk 6: Admin Panel — Core & Companies/Fleets

### Task 19: Update Admin Shell and Navigation

**Files:**
- Modify: `app/admin/AdminShell.tsx`
- Modify: `app/admin/AdminNav.tsx`
- Modify: `app/admin/admin-ui.ts`
- Modify: `app/admin/admin-components.tsx`

- [ ] **Step 1: Read all admin layout files**

Read AdminShell, AdminNav, admin-ui, admin-components, and also check `admin-utils.ts`, `admin-client-utils.tsx`, `types.ts`, `AdminModal.tsx`, `ConfirmDeleteDialog.tsx` if they exist — these shared admin files may need token updates too.

- [ ] **Step 2: Update AdminShell with V2 design**

- Use `pageContainer` / `pageContent` tokens
- Clean header with back navigation
- Professional enterprise styling
- Consistent spacing and borders

- [ ] **Step 3: Update AdminNav**

- 5-section navigation: Overview, Companies, Fleets, Users, Dashboards
- Active state with indigo accent
- Hint text per section
- Responsive: horizontal tabs on desktop, dropdown or stacked on mobile

- [ ] **Step 4: Update admin-ui tokens**

Ensure admin tokens reference the V2 design system consistently. Update button, section, card, form tokens.

- [ ] **Step 5: Update admin-components**

- `AdminSection`: Consistent card wrapper for content sections
- `AdminSectionHeader`: Title + optional action button
- `AdminStatCard`: Stat display with label, value, optional link

- [ ] **Step 6: Commit**

```bash
git add app/admin/AdminShell.tsx app/admin/AdminNav.tsx app/admin/admin-ui.ts app/admin/admin-components.tsx
git commit -m "feat: update Admin Shell, Nav, and shared components with V2 design"
```

---

### Task 20: Rebuild Admin Overview Page

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Read current admin overview page**

Read `app/admin/page.tsx`.

- [ ] **Step 2: Rebuild overview with new features**

**Stat Cards Row:**
- 4 `AdminStatCard` components: Total companies, Total fleets, Total users, Total dashboards
- Each links to its management section

**Quick Links Grid:**
- Cards for each management section with description and icon

**Recent Activity Summary:**
- Query database for: 5 newest users (by ID desc), 5 newest dashboards (by ID desc)
- Display as simple list with timestamps
- No schema changes — derived from existing data

**System Health Indicator:**
- Pick one dashboard's Google Sheet URL, attempt a fetch with 3-second timeout
- Show green "Connected" or red "Unreachable" badge
- Show "No dashboards" if none exist
- Non-blocking: render page first, health check runs client-side

**Quick Setup Wizard Card:**
- A card with "Quick Setup" title, description, and a button linking to `/admin/quick-setup` (the wizard built in Task 25)

- [ ] **Step 3: Verify overview renders with stats, activity, health check**

Run dev server as admin. Verify:
- Stat cards show correct counts
- Recent activity shows newest users and dashboards
- Health indicator shows connection status
- Quick links navigate correctly

- [ ] **Step 4: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: rebuild Admin overview with activity summary and health indicator"
```

---

### Task 21: Rebuild Companies Admin with Bulk Operations

**Files:**
- Modify: `app/admin/companies/CompaniesClient.tsx` (or equivalent)
- Modify: `app/admin/companies/page.tsx` (server component)

- [ ] **Step 1: Read current companies admin files**

Read the companies admin page and client component.

- [ ] **Step 2: Rebuild with V2 design and bulk operations**

**Existing CRUD:**
- Add company form (name input + submit)
- Edit company (inline edit or modal)
- Delete company (with confirmation)

**New features:**
- Dashboard count per company (query from DB)
- User count per company (query from DB)
- **Bulk create:** Textarea where admin pastes company names (one per line), creates all at once via server action
- **Bulk delete:** Checkbox per company row, "Delete selected" button with confirmation

**Server actions:** Add `bulkCreateCompanies(names: string[])` and `bulkDeleteCompanies(ids: number[])` to a new `app/db-bulk.ts` file. All bulk operations go here to avoid bloating `app/db.ts` (already 640 lines). The new file imports the `db` connection and schema from `app/db.ts`.

- [ ] **Step 3: Verify CRUD and bulk operations work**

Test:
- Create single company
- Bulk create 3 companies from textarea
- Edit company name
- Bulk delete 2 companies
- Verify counts update

- [ ] **Step 4: Commit**

```bash
git add app/admin/companies/ app/db-bulk.ts
git commit -m "feat: rebuild Companies admin with bulk create/delete and usage counts"
```

---

### Task 22: Rebuild Fleets Admin with Bulk Operations

**Files:**
- Modify: `app/admin/organizations/OrganizationsClient.tsx` (or equivalent)
- Modify: `app/admin/organizations/page.tsx`

- [ ] **Step 1: Read current fleets admin files**

Read the organizations/fleets admin page and client component.

- [ ] **Step 2: Rebuild with V2 design and bulk operations**

**Existing CRUD:**
- Create fleet (name + company dropdown)
- Edit fleet (name, company assignment)
- Delete fleet

**New features:**
- Dashboard count per fleet
- User count per fleet
- **Bulk create:** Textarea for fleet names + company selector, creates all fleets assigned to selected company
- **Bulk reassign:** Checkbox per fleet row, "Reassign selected" button with company dropdown
- **Bulk delete:** Checkbox per fleet row, "Delete selected" button

**Server actions:** Add `bulkCreateOrganizations(names: string[], companyId: number)`, `bulkReassignOrganizations(ids: number[], companyId: number)`, `bulkDeleteOrganizations(ids: number[])` to `app/db-bulk.ts`.

- [ ] **Step 3: Verify CRUD and bulk operations work**

Test all operations including bulk create with company assignment and bulk reassign.

- [ ] **Step 4: Commit**

```bash
git add app/admin/organizations/ app/db-bulk.ts
git commit -m "feat: rebuild Fleets admin with bulk create/reassign/delete and usage counts"
```

---

## Chunk 7: Admin Panel — Users, Dashboards & Wizard

### Task 23: Rebuild Users Admin with Bulk Operations

**Files:**
- Modify: `app/admin/users/UsersClient.tsx` (or equivalent)
- Modify: `app/admin/users/page.tsx`

- [ ] **Step 1: Read current users admin files**

Read the users admin page and client component.

- [ ] **Step 2: Rebuild with V2 design and bulk operations**

**Existing CRUD:**
- Create user (email, password, admin toggle)
- Edit user (email, password optional, admin toggle)
- Assign to companies and fleets (fleets filtered by company)
- Delete user (self-deletion prevention)

**New features:**
- Dashboard access summary per user (count of accessible dashboards based on company/fleet assignments)
- **Bulk create:** Textarea for emails (one per line) + shared password field, creates all users at once
- **Bulk assign to company:** Checkbox per user, company dropdown, "Assign selected" button
- **Bulk assign to fleet:** Checkbox per user, fleet dropdown (filtered by company), "Assign selected" button
- **Bulk toggle admin:** Checkbox per user, "Toggle admin" button
- **Bulk delete:** Checkbox per user, "Delete selected" button (excludes current user)

**Server actions:** Add to `app/db-bulk.ts`:
- `bulkCreateUsers(emails: string[], password: string)`
- `bulkAssignUsersToCompany(userIds: number[], companyId: number)`
- `bulkAssignUsersToOrganization(userIds: number[], orgId: number)`
- `bulkSetAdmin(userIds: number[], isAdmin: boolean)` — named "set" not "toggle" since the boolean param sets a specific state rather than toggling per-user
- `bulkDeleteUsers(userIds: number[])`

- [ ] **Step 3: Verify all CRUD and bulk operations**

Test:
- Create single user
- Bulk create 3 users
- Bulk assign to company
- Bulk assign to fleet
- Bulk toggle admin on/off
- Bulk delete (verify current user excluded)
- Dashboard access summary shows correct count

- [ ] **Step 4: Commit**

```bash
git add app/admin/users/ app/db-bulk.ts
git commit -m "feat: rebuild Users admin with bulk operations and dashboard access summary"
```

---

### Task 24: Rebuild Dashboards Admin with Bulk Operations

**Files:**
- Modify: `app/admin/dashboards/DashboardsClient.tsx` (or equivalent)
- Modify: `app/admin/dashboards/page.tsx`

- [ ] **Step 1: Read current dashboards admin files**

Read the dashboards admin page and client component.

- [ ] **Step 2: Rebuild with V2 design and bulk operations**

**Existing CRUD:**
- Create dashboard (name, template selector — now 4 options: Summary/Detail/Simple/Driving, Google Sheet URL with auto-extract, company, fleet optional, notes)
- Edit dashboard
- Delete dashboard

**New features:**
- Data status indicator: Client-side fetch of the dashboard's Google Sheet with 3-second timeout. Green "accessible" or red "unreachable" badge per dashboard.
- Preview link: Button that opens `/dashboard/[id]` in new tab
- **Duplicate dashboard:** "Duplicate" button per row that pre-fills the create form with existing dashboard's config (different name)
- **Bulk create from template:** Select a template + Google Sheet URL + company, then checkboxes for which fleets to create dashboards for. Creates one dashboard per fleet with auto-generated names (e.g., "[FleetName] Summary").
- **Bulk assign to fleet:** Checkbox per dashboard, fleet dropdown, "Reassign selected" button
- **Bulk delete:** Checkbox per dashboard, "Delete selected" button

**Server actions:** Add to `app/db-bulk.ts`:
- `bulkCreateDashboards(dashboards: {name, template, sheetId, sheetGid, sheetUrl, companyId, organizationId?, notes?}[])`
- `bulkReassignDashboards(ids: number[], organizationId: number)`
- `bulkDeleteDashboards(ids: number[])`

**Edge case for bulk create from template:** If a fleet already has a dashboard with the auto-generated name (e.g., "[FleetName] Summary"), append a numeric suffix (e.g., "[FleetName] Summary (2)") to avoid duplicates.

- [ ] **Step 3: Verify all operations including data status check**

Test:
- Create dashboard with Google Sheet URL auto-extraction
- Duplicate a dashboard
- Bulk create for 3 fleets at once
- Data status indicator shows green/red per dashboard
- Preview link opens correct dashboard
- Bulk reassign and delete

- [ ] **Step 4: Commit**

```bash
git add app/admin/dashboards/ app/db-bulk.ts
git commit -m "feat: rebuild Dashboards admin with bulk operations, data status, and duplicate"
```

---

### Task 25: Rebuild Quick Setup Wizard

**Files:**
- Modify: `app/admin/quick-setup/page.tsx` (existing file — rebuild, not create)
- Modify: `app/admin/quick-setup/QuickSetupClient.tsx` (existing file — rebuild as the wizard component)

Note: The codebase already has `app/admin/quick-setup/`. We rebuild these existing files rather than creating a new `/admin/setup/` route.

- [ ] **Step 1: Read existing quick-setup files and design the wizard flow**

Read `app/admin/quick-setup/page.tsx` and `app/admin/quick-setup/QuickSetupClient.tsx` to understand the existing implementation, then rebuild with the following flow:

4-step guided flow:
1. **Create Company** — name input, create button
2. **Create Fleet** — name input, auto-assigned to company from step 1
3. **Add Dashboard** — name, template, Google Sheet URL, auto-assigned to company + fleet from steps 1-2
4. **Invite User** — email, password, auto-assigned to company + fleet from steps 1-2

Each step shows progress indicator (step 1 of 4, etc.) and allows skipping ahead if entities already exist (dropdown to select existing).

- [ ] **Step 2: Rebuild QuickSetupClient component**

Leverage any useful logic from the existing `QuickSetupClient.tsx`. Props:

```typescript
'use client';

interface QuickSetupClientProps {
  companies: { id: number; name: string }[];
  organizations: { id: number; name: string; companyId: number }[];
}
```

Multi-step form with state tracking:
- Current step (1-4)
- Created/selected company ID
- Created/selected fleet ID
- Created dashboard ID
- Each step has "Create New" form or "Use Existing" dropdown
- Submit each step independently via server actions
- Progress bar at top

- [ ] **Step 3: Implement server page**

Server component that loads existing companies and organizations, passes to `SetupWizard`.

- [ ] **Step 4: Verify admin overview links to quick-setup**

Task 20 already adds a Quick Setup button on the admin overview. Verify it links to `/admin/quick-setup`. Update the link if it points elsewhere.

- [ ] **Step 5: Test full wizard flow**

Run through the complete wizard:
- Create new company → create new fleet → add dashboard → invite user
- Also test using existing entities in each step

- [ ] **Step 6: Commit**

```bash
git add app/admin/quick-setup/
git commit -m "feat: rebuild Quick Setup Wizard for streamlined fleet onboarding"
```

---

## Chunk 8: Internationalization & Final Polish

### Task 26: Update ThemeToggle for V2

**Files:**
- Modify: `app/theme/ThemeToggle.tsx`

The spec requires "manual toggle override" for dark mode. The existing `ThemeToggle.tsx` component exists but initializes with `useState<Theme>('light')` causing a flash. Update it to work with the inline script from Task 2.

- [ ] **Step 1: Read current ThemeToggle**

Read `app/theme/ThemeToggle.tsx`.

- [ ] **Step 2: Update ThemeToggle to sync with inline script**

- On mount, read the actual state from `document.documentElement.classList.contains('dark')` instead of defaulting to 'light'
- On toggle, update both `localStorage.setItem('theme', ...)` and `document.documentElement.classList.toggle('dark')`
- Use design tokens for the toggle button styling
- Ensure the toggle is keyboard accessible

- [ ] **Step 3: Commit**

```bash
git add app/theme/ThemeToggle.tsx
git commit -m "feat: update ThemeToggle to sync with inline dark mode script"
```

---

### Task 27: Update i18n Translations

**Files:**
- Modify: `app/dashboard/i18n.ts`
- Modify: `app/dashboard/i18n-copy.ts`

- [ ] **Step 1: Read current i18n files**

Read both i18n files.

- [ ] **Step 2: Add missing translation keys**

Ensure all UI labels across the app have both EN and TH translations:
- Dashboard hub labels (existing — verify complete)
- All filter labels (existing — verify)
- Empty states
- Admin panel labels — specifically:
  - Section names: Companies, Fleets, Users, Dashboards
  - Bulk action buttons: "Bulk Create", "Delete Selected", "Reassign Selected", "Assign Selected"
  - Setup wizard step labels: "Create Company", "Create Fleet", "Add Dashboard", "Invite User"
  - Stat cards: "Total Companies", "Total Fleets", "Total Users", "Total Dashboards"
  - Health indicator: "Connected", "Unreachable", "No dashboards"
- Tooltips on chart components
- Error messages (login, register, Google Sheet errors)
- Stale data indicator text

Add number formatting utility:
```typescript
export function formatNumber(value: number, lang: string): string {
  return new Intl.NumberFormat(lang === 'th' ? 'th-TH' : 'en-GB').format(value);
}
```

Add date formatting utility:
```typescript
export function formatDate(date: Date, lang: string): string {
  return new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric'
  }).format(date);
}
```

- [ ] **Step 3: Verify language toggle switches all labels**

Switch between EN and TH, verify all visible text changes.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/i18n.ts app/dashboard/i18n-copy.ts
git commit -m "feat: update i18n with complete translations and locale-aware formatting"
```

---

### Task 28: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Full flow test — Login → Hub → Each Dashboard**

1. Log in with valid credentials
2. Verify dashboard hub shows all assigned dashboards
3. Open Summary dashboard — verify all sections render with real data
4. Open Detail dashboard — verify all sections including video evidence
5. Open Simple dashboard — verify only 3 alert types shown
6. Open Driving dashboard — verify dual-axis chart and sparklines
7. Navigate back to hub between each

- [ ] **Step 2: Admin flow test**

1. Log in as admin
2. Verify admin overview stats, activity, health check
3. Test CRUD + bulk operations on each section (companies, fleets, users, dashboards)
4. Run through quick setup wizard
5. Verify newly created dashboard appears in hub

- [ ] **Step 3: Dark mode test**

Use the ThemeToggle (updated in Task 26) to switch to dark mode, then verify:
- No flash on page load (reload after setting dark mode)
- All pages render correctly in dark mode
- Charts and heatmaps readable
- Form inputs and buttons styled correctly

- [ ] **Step 4: Language test**

Switch to Thai and verify:
- All hub labels in Thai
- Dashboard labels in Thai
- Number and date formatting uses Thai locale
- Switch back to English works

- [ ] **Step 5: Responsive test**

Resize browser to tablet width and verify:
- KPI cards stack properly
- Tables scroll horizontally
- Charts resize without breaking
- Navigation remains usable

- [ ] **Step 6: CSV export test**

On each dashboard type:
- Apply some filters
- Click export
- Verify CSV contains filtered data
- Verify Simple dashboard CSV only contains the 3 allowed alert types
- Verify filename includes dashboard name and date range
- Open in Excel and verify BOM encoding works

- [ ] **Step 7: Stale data indicator test**

Open a dashboard, wait for data to load. Verify the stale data badge does not appear on fresh data. Clear localStorage cache, disconnect network briefly, reload — verify the error recovery UI appears with retry button.

- [ ] **Step 8: Final commit if any fixes needed**

```bash
git add app/
git commit -m "fix: final integration fixes for V2 dashboard"
```
