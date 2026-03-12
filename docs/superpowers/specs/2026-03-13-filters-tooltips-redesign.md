# Filters & Tooltips Redesign

Unified filter system and rich tooltips across all dashboards.

## Goals

1. Replace clunky filter patterns with two clean primitives: InlineMonthPicker and MultiSelect dropdown
2. Add rich, styled tooltips to every chart, KPI card, safety score, and leaderboard entry
3. Consistent filter layout across all 5 dashboards

## Decisions

- **MonthPicker layout**: Inline horizontal row (`‹ 2026 › | Jan Feb ... Dec | ✕`) replacing the stacked flex-col grid
- **All filters become dropdowns**: Vehicle, driver, fleet, and alert type all use the same MultiSelect dropdown component (searchable, checkboxes, clear all / select all)
- **No bare text inputs**: Every filter is a structured component
- **Date range removed**: SimpleDashboard switches from date range to InlineMonthPicker (month-level filtering everywhere)
- **Tooltip approach**: React `<Tooltip>` and `<ChartTooltip>` components, portal-based, replacing SVG `<title>` elements
- **Tooltip coverage**: Everything — charts, KPI cards, safety score, leaderboard entries

---

## Component 1: InlineMonthPicker

Replaces the current `MonthPicker` component. Same API (`value: string`, `onChange: (v: string) => void`), new layout.

**Layout**: Single horizontal row in a bordered container:
```
‹ 2026 › | Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec | ✕
```

**States**:
- No selection: all months in muted gray
- Selected: active month in indigo-600 bg with white text, clear button (✕) appears
- Year nav: ‹ / › buttons to change year

**Styling**:
- Container: `inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1`
- Year buttons: `h-5.5 w-5.5 rounded bg-zinc-100` with hover
- Month buttons: `px-1.5 py-0.5 rounded text-xs font-medium`
- Selected month: `bg-indigo-600 text-white`
- Separator: vertical `|` in zinc-200
- Clear: `text-zinc-400 hover:text-zinc-600`

**File**: `app/ui/InlineMonthPicker.tsx` (new file, old `MonthPicker.tsx` deleted after migration)

---

## Component 2: MultiSelect Dropdown

Reusable searchable multi-select dropdown for vehicle, driver, fleet, and alert type filters.

**Props**:
```typescript
type MultiSelectProps = {
  label: string;           // "All vehicles", "All drivers", etc.
  options: string[];       // Available options from data
  selected: string[];      // Currently selected values
  onChange: (selected: string[]) => void;
  className?: string;
};
```

**States**:
- Default: gray border, `"All {label}"` text, ▾ chevron
- Active (has selections): indigo background (#eef2ff), indigo border (#c7d2fe), `"N {label}"` text in indigo-600, ▾ chevron
- Open: indigo border, ▴ chevron, dropdown panel below

**Dropdown panel**:
- Search input at top with placeholder "Search..."
- Checkbox list of options (checked items get indigo checkbox + light indigo row bg)
- Footer with "Clear all" (left) and "Select all" (right) buttons
- Max height with overflow scroll for long lists

**Behavior**:
- Click trigger to open/close
- Click outside or press Escape to close
- Search filters the option list
- Checkboxes toggle individual items
- When all items selected, show "All {label}" (default state)

**File**: `app/ui/MultiSelect.tsx` (new)

---

## Component 3: Tooltip

Simple wrapper tooltip for non-chart elements. Shows text on hover.

**Props**:
```typescript
type TooltipProps = {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom';  // default: 'top'
};
```

**Rendering**:
- Portal-based (renders to `document.body`) to avoid overflow clipping
- Dark background (`#18181b` / zinc-900), white text, rounded-md, small arrow
- Fade in with 100ms delay to avoid flicker on fast mouse movement
- Smart positioning: flips to opposite side if near viewport edge

**Usage targets**:
- KpiCard: explain what the number means (e.g. "Total alerts across 5 vehicles")
- SafetyScore: show calculation context (e.g. "Based on 42 alerts across 8 vehicles")
- DriverLeaderboard rows: show alert breakdown per driver (e.g. "Fatigue: 5, Yawning: 3, Distraction: 1")

**File**: `app/ui/Tooltip.tsx` (new)

---

## Component 4: ChartTooltip

Rich tooltip for chart data points with colored series, formatted values, and totals.

**Props**:
```typescript
type ChartTooltipRow = {
  color: string;
  label: string;
  value: number;
};

type ChartTooltipProps = {
  visible: boolean;
  x: number;            // mouse X position
  y: number;            // mouse Y position
  header?: string;      // e.g. "April 2026"
  rows: ChartTooltipRow[];
  showTotal?: boolean;  // show sum row at bottom
};
```

**Rendering**:
- Portal-based, positioned at (x, y) with offset
- Dark background, same style as simple Tooltip
- Header row in muted text (zinc-400)
- Each row: colored dot (7px circle) + label + right-aligned value (tabular-nums)
- Optional total row with top border separator
- Arrow pointing down toward the data point

**Usage targets**:
- TrendChart: show all series values at hovered date
- DonutChart: show slice label, value, percentage
- AlertHeatmap: show day, hour, alert count

**File**: `app/ui/ChartTooltip.tsx` (new)

---

## Dashboard Filter Configurations

Each dashboard uses FilterBar with InlineMonthPicker + dashboard-specific MultiSelects.

### SimpleDashboard
```
[InlineMonthPicker] [All vehicles ▾] [All drivers ▾] [All types ▾] [Reset]
```
- **Removes**: date range (from/to inputs), datalist inputs, FilterChip alert type buttons
- **Adds**: InlineMonthPicker, MultiSelect for vehicle/driver/type
- **Data change**: filter by month (YYYY-MM) instead of date range

### SummaryDashboard
```
[InlineMonthPicker] [All fleets ▾] [Reset]
```
- **Removes**: month chip search pattern, fleet chip search pattern
- **Adds**: InlineMonthPicker, MultiSelect for fleet

### DrivingDashboard
```
[InlineMonthPicker] [All drivers ▾] [Reset]
```
- **Removes**: old stacked MonthPicker, driver `<select>` dropdown
- **Adds**: InlineMonthPicker, MultiSelect for driver

### DetailDashboard
```
[InlineMonthPicker] [All fleets ▾] [All types ▾] [All vehicles ▾] [All drivers ▾] [Reset]
```
- **Removes**: month chip search, fleet chip search, remark toggle chips, vehicle chip search, driver chip search
- **Adds**: InlineMonthPicker, MultiSelect for fleet/type/vehicle/driver

### VideoDashboard
- No changes — uses parent dashboard's filter context

---

## Chart Tooltip Integration

### TrendChart (`app/ui/TrendChart.tsx`)
- Replace SVG `<title>` elements with ChartTooltip
- Track mouse position on data points via `onMouseEnter`/`onMouseLeave` on circle elements
- Show header (date label) + all series values with colored dots
- Show total row for multi-series

### DonutChart (`app/ui/DonutChart.tsx`)
- Replace SVG `<title>` elements with ChartTooltip
- Track mouse on arc/circle segments
- Show label, value, and percentage
- Keep existing interactive center text display

### AlertHeatmap (`app/ui/AlertHeatmap.tsx`)
- Replace HTML `title` attributes with ChartTooltip
- Track mouse on grid cells
- Show day name, hour (formatted), and alert count
- Show intensity context (e.g. "High" / "Medium" / "Low")

---

## Design Tokens

Add to `app/ui/design-tokens.ts`:

```typescript
// Tooltip
export const tooltipBase = 'bg-zinc-900 text-white text-xs rounded-md shadow-lg px-2.5 py-1.5';

// Filter - MultiSelect
export const multiSelectTrigger = 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition';
export const multiSelectDefault = 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300';
export const multiSelectActive = 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:border-indigo-300';
export const multiSelectOpen = 'border-indigo-500 bg-white text-zinc-700';
export const multiSelectPanel = 'absolute top-full mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white shadow-lg z-50';
```

---

## Files Changed

**New files**:
- `app/ui/InlineMonthPicker.tsx`
- `app/ui/MultiSelect.tsx`
- `app/ui/Tooltip.tsx`
- `app/ui/ChartTooltip.tsx`

**Modified files**:
- `app/ui/design-tokens.ts` — add tooltip and MultiSelect tokens
- `app/ui/TrendChart.tsx` — replace `<title>` with ChartTooltip
- `app/ui/DonutChart.tsx` — replace `<title>` with ChartTooltip
- `app/ui/AlertHeatmap.tsx` — replace `title` attr with ChartTooltip
- `app/ui/KpiCard.tsx` — wrap with Tooltip
- `app/ui/SafetyScore.tsx` — wrap with Tooltip
- `app/ui/DriverLeaderboard.tsx` — add Tooltip to rows
- `app/dashboards/SimpleDashboard.tsx` — replace filters with InlineMonthPicker + MultiSelects
- `app/dashboards/SummaryDashboard.tsx` — replace filters with InlineMonthPicker + MultiSelect
- `app/dashboards/DrivingDashboard.tsx` — replace filters with InlineMonthPicker + MultiSelect
- `app/dashboards/DetailDashboard.tsx` — replace filters with InlineMonthPicker + MultiSelects

**Deleted files**:
- `app/ui/MonthPicker.tsx` — replaced by InlineMonthPicker
- `app/dashboards/FilterChip.tsx` — no longer needed (alert type chips replaced by MultiSelect)

---

## Out of Scope

- Recharts migration (staying with custom SVG charts)
- Day-level date filtering (replaced by month-level everywhere)
- New dashboard creation
- Data layer changes (filter logic adapts to month-based filtering)
