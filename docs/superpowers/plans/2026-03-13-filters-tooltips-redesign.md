# Filters & Tooltips Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace clunky dashboard filters with unified InlineMonthPicker + MultiSelect dropdowns, and add rich tooltips to every chart and data element.

**Architecture:** Four new UI primitives (InlineMonthPicker, MultiSelect, Tooltip, ChartTooltip) built on the existing design token system. Each chart component gets ChartTooltip integration replacing SVG `<title>` elements. All 4 dashboards migrate to the unified filter bar pattern. Portal-based rendering for all tooltips.

**Tech Stack:** React 18, Next.js 14, TypeScript, Tailwind CSS, custom SVG charts

**Spec:** `docs/superpowers/specs/2026-03-13-filters-tooltips-redesign.md`

**No test infrastructure exists** — verification is via `npx tsc --noEmit` and browser inspection.

---

## File Structure

**New files:**
| File | Responsibility |
|------|---------------|
| `app/ui/Tooltip.tsx` | Simple text tooltip wrapper (portal-based) |
| `app/ui/ChartTooltip.tsx` | Rich chart data tooltip (colored rows, totals) |
| `app/ui/InlineMonthPicker.tsx` | Horizontal month picker (single + multi select) |
| `app/ui/MultiSelect.tsx` | Searchable multi-select dropdown with checkboxes |

**Modified files:**
| File | Change |
|------|--------|
| `app/ui/design-tokens.ts` | Add tooltip + MultiSelect tokens |
| `app/ui/TrendChart.tsx` | Replace `<title>` with ChartTooltip |
| `app/ui/DonutChart.tsx` | Replace `<title>` with ChartTooltip |
| `app/ui/AlertHeatmap.tsx` | Replace `title` attr with ChartTooltip |
| `app/ui/KpiCard.tsx` | Add optional Tooltip wrapper |
| `app/ui/SafetyScore.tsx` | Add optional Tooltip wrapper |
| `app/ui/DriverLeaderboard.tsx` | Add Tooltip to driver rows |
| `app/dashboards/SimpleDashboard.tsx` | New filter bar + month-based filtering |
| `app/dashboards/SummaryDashboard.tsx` | New filter bar with InlineMonthPicker (multi) |
| `app/dashboards/DrivingDashboard.tsx` | New filter bar replacing stacked MonthPicker |
| `app/dashboards/DetailDashboard.tsx` | New filter bar + keep "Show excluded" toggle |

**Deleted files:**
| File | Reason |
|------|--------|
| `app/ui/MonthPicker.tsx` | Replaced by InlineMonthPicker |
| `app/dashboards/FilterChip.tsx` | Replaced by MultiSelect for alert types |

---

## Chunk 1: Foundation Components

### Task 1: Add design tokens

**Files:**
- Modify: `app/ui/design-tokens.ts`

- [ ] **Step 1: Add tooltip and MultiSelect tokens to design-tokens.ts**

Append these exports after the existing `SAFETY_THRESHOLDS` export:

```typescript
/* ── Tooltip ─────────────────────────────────────────── */
export const tooltipBase = 'bg-zinc-900 text-white text-xs rounded-md shadow-lg px-2.5 py-1.5';

/* ── MultiSelect ─────────────────────────────────────── */
export const multiSelectTrigger = 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition';
export const multiSelectDefault = 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600';
export const multiSelectActive = 'border-indigo-200 bg-indigo-50 text-indigo-600 hover:border-indigo-300 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-400';
export const multiSelectOpen = 'border-indigo-500 bg-white text-zinc-700 dark:border-indigo-400 dark:bg-zinc-900 dark:text-zinc-200';
export const multiSelectPanel = 'absolute top-full mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white shadow-lg z-50 dark:border-zinc-700 dark:bg-zinc-900';
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/ui/design-tokens.ts
git commit -m "feat: add tooltip and MultiSelect design tokens"
```

---

### Task 2: Create Tooltip component

**Files:**
- Create: `app/ui/Tooltip.tsx`

- [ ] **Step 1: Create Tooltip.tsx**

```typescript
'use client';

import { useRef, useState, useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { tooltipBase } from './design-tokens';

type TooltipProps = {
  content: string;
  children: ReactNode;
  position?: 'top' | 'bottom';
};

export default function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = position === 'top' ? rect.top - 8 : rect.bottom + 8;
      // Flip if near viewport edge
      const flipped = position === 'top' ? y < 40 : y > window.innerHeight - 40;
      const finalY = flipped
        ? (position === 'top' ? rect.bottom + 8 : rect.top - 8)
        : y;
      setCoords({ x, y: finalY });
      setVisible(true);
    }, 100);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  if (!content) return <>{children}</>;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-block"
      >
        {children}
      </span>
      {visible && createPortal(
        <div
          role="tooltip"
          className={`${tooltipBase} pointer-events-none fixed z-[9999] -translate-x-1/2 whitespace-nowrap`}
          style={{ left: coords.x, top: coords.y, transform: `translate(-50%, ${coords.y < 40 ? '4px' : '-100%'})` }}
        >
          {content}
          <span
            className="absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent"
            style={coords.y < 40
              ? { top: '-10px', borderBottomColor: '#18181b' }
              : { bottom: '-10px', borderTopColor: '#18181b' }
            }
          />
        </div>,
        document.body,
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/ui/Tooltip.tsx
git commit -m "feat: add Tooltip component with portal positioning"
```

---

### Task 3: Create ChartTooltip component

**Files:**
- Create: `app/ui/ChartTooltip.tsx`

- [ ] **Step 1: Create ChartTooltip.tsx**

```typescript
'use client';

import { createPortal } from 'react-dom';
import { tooltipBase } from './design-tokens';

export type ChartTooltipRow = {
  color: string;
  label: string;
  value: number;
};

type ChartTooltipProps = {
  visible: boolean;
  x: number;
  y: number;
  header?: string;
  rows: ChartTooltipRow[];
  showTotal?: boolean;
};

export default function ChartTooltip({ visible, x, y, header, rows, showTotal }: ChartTooltipProps) {
  if (!visible || rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const flipUp = y > 100;
  const top = flipUp ? y - 12 : y + 12;

  return createPortal(
    <div
      role="tooltip"
      className={`${tooltipBase} pointer-events-none fixed z-[9999] min-w-[140px] -translate-x-1/2 px-3 py-2.5`}
      style={{ left: x, top, transform: `translate(-50%, ${flipUp ? '-100%' : '0'})` }}
    >
      {header && (
        <div className="mb-1.5 text-[10px] font-semibold text-zinc-400">{header}</div>
      )}
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-1.5 py-0.5">
          <span
            className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
            style={{ backgroundColor: row.color }}
          />
          <span className="flex-1">{row.label}</span>
          <span className="font-semibold tabular-nums">{row.value.toLocaleString()}</span>
        </div>
      ))}
      {showTotal && rows.length > 1 && (
        <div className="mt-1 flex justify-between border-t border-zinc-700 pt-1">
          <span className="text-zinc-400">Total</span>
          <span className="font-bold tabular-nums">{total.toLocaleString()}</span>
        </div>
      )}
      <span
        className="absolute left-1/2 -translate-x-1/2 border-[5px] border-transparent"
        style={flipUp
          ? { bottom: '-10px', borderTopColor: '#18181b' }
          : { top: '-10px', borderBottomColor: '#18181b' }
        }
      />
    </div>,
    document.body,
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/ui/ChartTooltip.tsx
git commit -m "feat: add ChartTooltip component with rich data rows"
```

---

### Task 4: Create InlineMonthPicker component

**Files:**
- Create: `app/ui/InlineMonthPicker.tsx`

- [ ] **Step 1: Create InlineMonthPicker.tsx**

```typescript
'use client';

import { useMemo, useState } from 'react';

const MONTH_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type InlineMonthPickerProps = {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  lang?: string;
  className?: string;
};

export default function InlineMonthPicker({
  value,
  onChange,
  multi = false,
  lang = 'en',
  className = '',
}: InlineMonthPickerProps) {
  const months = lang === 'th' ? MONTH_TH : MONTH_EN;
  const values = useMemo(() => {
    if (!value) return [] as string[];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const initialYear = useMemo(() => {
    const first = values[0];
    if (first) {
      const y = parseInt(first.split('-')[0], 10);
      if (!isNaN(y)) return y;
    }
    return new Date().getFullYear();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [year, setYear] = useState(initialYear);

  const isSelected = (monthIndex: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    return values.includes(key);
  };

  const handleClick = (monthIndex: number) => {
    const key = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
    if (multi) {
      const next = values.includes(key)
        ? values.filter((v) => v !== key)
        : [...values, key].sort();
      onChange(next);
    } else {
      onChange(values.includes(key) ? '' : key);
    }
  };

  const handleClear = () => onChange(multi ? [] : '');

  const hasSelection = values.length > 0;

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900 ${className}`}
    >
      {/* Year nav */}
      <button
        type="button"
        onClick={() => setYear((y) => y - 1)}
        aria-label="Previous year"
        className="flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        ‹
      </button>
      <span className="min-w-[2.5rem] text-center text-xs font-semibold text-zinc-700 dark:text-zinc-200">
        {year}
      </span>
      <button
        type="button"
        onClick={() => setYear((y) => y + 1)}
        aria-label="Next year"
        className="flex h-5 w-5 items-center justify-center rounded bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      >
        ›
      </button>

      <span className="text-zinc-200 dark:text-zinc-700">|</span>

      {/* Month buttons */}
      {months.map((abbr, i) => (
        <button
          key={i}
          type="button"
          onClick={() => handleClick(i)}
          className={[
            'rounded px-1.5 py-0.5 text-xs font-medium transition',
            isSelected(i)
              ? 'bg-indigo-600 text-white'
              : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          ].join(' ')}
        >
          {abbr}
        </button>
      ))}

      {/* Clear */}
      {hasSelection && (
        <>
          <span className="text-zinc-200 dark:text-zinc-700">|</span>
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear month selection"
            className="text-xs text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/ui/InlineMonthPicker.tsx
git commit -m "feat: add InlineMonthPicker with single and multi-select"
```

---

### Task 5: Create MultiSelect component

**Files:**
- Create: `app/ui/MultiSelect.tsx`

- [ ] **Step 1: Create MultiSelect.tsx**

```typescript
'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import {
  multiSelectTrigger,
  multiSelectDefault,
  multiSelectActive,
  multiSelectOpen,
  multiSelectPanel,
} from './design-tokens';

type MultiSelectProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  lang?: string;
  className?: string;
};

export default function MultiSelect({
  label,
  options,
  selected,
  onChange,
  lang = 'en',
  className = '',
}: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const t = lang === 'th'
    ? { all: `ทั้งหมด`, search: 'ค้นหา...', clear: 'ล้างทั้งหมด', selectAll: 'เลือกทั้งหมด' }
    : { all: `All ${label}`, search: 'Search...', clear: 'Clear all', selectAll: 'Select all' };

  const filtered = useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );

  const allSelected = selected.length === 0 || selected.length === options.length;
  const hasSelection = selected.length > 0 && selected.length < options.length;

  const toggleItem = (item: string) => {
    onChange(
      selected.includes(item)
        ? selected.filter((s) => s !== item)
        : [...selected, item],
    );
  };

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Focus search on open
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const triggerText = allSelected
    ? t.all
    : `${selected.length} ${label}`;

  const stateClass = open ? multiSelectOpen : hasSelection ? multiSelectActive : multiSelectDefault;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${multiSelectTrigger} ${stateClass}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{triggerText}</span>
        <span className="text-[9px]">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className={multiSelectPanel} role="listbox" aria-multiselectable="true">
          {/* Search */}
          <div className="border-b border-zinc-100 p-1.5 dark:border-zinc-800">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.search}
              className="w-full rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs outline-none focus:border-indigo-400 dark:border-zinc-700"
            />
          </div>

          {/* Options */}
          <div className="max-h-[180px] overflow-y-auto py-1">
            {filtered.map((option) => {
              const checked = selected.includes(option);
              return (
                <label
                  key={option}
                  className={`flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs transition ${
                    checked ? 'bg-indigo-50 dark:bg-indigo-950/50' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                  role="option"
                  aria-selected={checked}
                >
                  <span
                    className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-sm border-2 text-[8px] font-bold ${
                      checked
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800'
                    }`}
                  >
                    {checked && '✓'}
                  </span>
                  <span className="text-zinc-700 dark:text-zinc-200">{option}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2.5 py-3 text-center text-xs text-zinc-400">
                {lang === 'th' ? 'ไม่พบผลลัพธ์' : 'No results'}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between border-t border-zinc-100 px-2.5 py-1.5 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-zinc-400 transition hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              {t.clear}
            </button>
            <button
              type="button"
              onClick={() => onChange([...options])}
              className="text-[10px] font-semibold text-indigo-600 transition hover:text-indigo-700 dark:text-indigo-400"
            >
              {t.selectAll}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/ui/MultiSelect.tsx
git commit -m "feat: add MultiSelect dropdown with search and checkboxes"
```

---

## Chunk 2: Chart Tooltip Integration

### Task 6: Add ChartTooltip to TrendChart

**Files:**
- Modify: `app/ui/TrendChart.tsx`

**Context:** TrendChart.tsx is 632 lines with 3 render modes (line, bar, dual-axis). Each mode has data points with `<title>` elements. We need to:
1. Add tooltip state (`hoveredPoint` with x, y, header, rows)
2. Replace all `<title>` elements with mouse handlers
3. Render one `<ChartTooltip>` at the end

- [ ] **Step 1: Add tooltip state and import**

At the top of the file, add `import ChartTooltip` and the `CHART_COLORS` import if not already present. Add tooltip state inside the main component:

```typescript
import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip';
```

Add state inside the `TrendChart` component function:

```typescript
const [tooltip, setTooltip] = useState<{
  visible: boolean; x: number; y: number; header: string; rows: ChartTooltipRow[];
}>({ visible: false, x: 0, y: 0, header: '', rows: [] });
```

- [ ] **Step 2: Replace `<title>` in LineMode single-series**

Find the circle elements in the single-series line rendering that have `<title>` children. Remove the `<title>` element and add mouse handlers:

```typescript
onMouseMove={(e) => setTooltip({
  visible: true,
  x: e.clientX,
  y: e.clientY,
  header: datum.label,
  rows: [{ color: colors[0], label: datum.label, value: datum.value }],
})}
onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
```

Remove the corresponding `<title>{label}: {value}</title>` element.

- [ ] **Step 3: Replace `<title>` in LineMode multi-series**

Find circle elements in multi-series line rendering. Replace `<title>` with mouse handlers that show all series values at that data point:

```typescript
onMouseMove={(e) => {
  const d = data[dataIndex] as MultiTrendDatum;
  setTooltip({
    visible: true,
    x: e.clientX,
    y: e.clientY,
    header: d.label,
    rows: keys.map((key, ki) => ({
      color: colors[ki % colors.length],
      label: key,
      value: d.values[key] ?? 0,
    })),
  });
}}
onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
```

Remove the corresponding `<title>` elements.

- [ ] **Step 4: Replace `<title>` in BarMode and DualAxisMode**

Apply the same pattern to bar rect elements and dual-axis data points. Each bar/point gets `onMouseMove`/`onMouseLeave` handlers showing the relevant data.

- [ ] **Step 5: Render ChartTooltip at the end of the component**

Just before the closing `</div>` of the TrendChart return, add:

```tsx
<ChartTooltip
  visible={tooltip.visible}
  x={tooltip.x}
  y={tooltip.y}
  header={tooltip.header}
  rows={tooltip.rows}
  showTotal={tooltip.rows.length > 1}
/>
```

- [ ] **Step 6: Verify TypeScript compiles and test in browser**

Run: `npx tsc --noEmit`
Open SimpleDashboard or SummaryDashboard in browser, hover over chart data points.
Expected: Rich tooltip appears with colored dots and values.

- [ ] **Step 7: Commit**

```bash
git add app/ui/TrendChart.tsx
git commit -m "feat: replace TrendChart title tooltips with ChartTooltip"
```

---

### Task 7: Add ChartTooltip to DonutChart

**Files:**
- Modify: `app/ui/DonutChart.tsx`

**Context:** DonutChart has circle segments with `<title>` elements showing `{label}: {value} ({pct}%)`. Also has interactive center text and legend hover. Keep center text — add ChartTooltip on top.

- [ ] **Step 1: Add tooltip state and import**

```typescript
import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip';
```

Add state (alongside existing `hoveredIndex`):

```typescript
const [tooltip, setTooltip] = useState<{
  visible: boolean; x: number; y: number; rows: ChartTooltipRow[];
}>({ visible: false, x: 0, y: 0, rows: [] });
```

- [ ] **Step 2: Replace `<title>` on circle segments**

On each `<circle>` element, remove the `<title>` child and update the existing `onMouseEnter` to also set tooltip position. Add `onMouseMove` and update `onMouseLeave`:

```typescript
onMouseEnter={() => setHoveredIndex(i)}
onMouseMove={(e) => {
  const pct = total > 0 ? ((slice.value / total) * 100).toFixed(1) : '0';
  setTooltip({
    visible: true,
    x: e.clientX,
    y: e.clientY,
    rows: [{ color: colors[i % colors.length], label: `${slice.label} (${pct}%)`, value: slice.value }],
  });
}}
onMouseLeave={() => { setHoveredIndex(null); setTooltip((t) => ({ ...t, visible: false })); }}
```

- [ ] **Step 3: Render ChartTooltip**

Add before the closing tag:

```tsx
<ChartTooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} rows={tooltip.rows} />
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`
Browser: Hover donut slices on SummaryDashboard.

```bash
git add app/ui/DonutChart.tsx
git commit -m "feat: replace DonutChart title tooltips with ChartTooltip"
```

---

### Task 8: Add ChartTooltip to AlertHeatmap

**Files:**
- Modify: `app/ui/AlertHeatmap.tsx`

**Context:** AlertHeatmap has grid cells with HTML `title` attributes like `"Mon 08:00 — 3 alert(s)"`. Replace with ChartTooltip on hover.

- [ ] **Step 1: Add tooltip state and import**

```typescript
import { useState } from 'react';
import ChartTooltip, { type ChartTooltipRow } from './ChartTooltip';
```

Add state:

```typescript
const [tooltip, setTooltip] = useState<{
  visible: boolean; x: number; y: number; header: string; rows: ChartTooltipRow[];
}>({ visible: false, x: 0, y: 0, header: '', rows: [] });
```

- [ ] **Step 2: Replace `title` attributes on grid cells**

Remove the `title` attribute from each cell `<div>`. Add mouse handlers:

```typescript
onMouseMove={(e) => {
  const intensity = count === 0 ? '' : ratio > 0.75 ? 'High' : ratio > 0.5 ? 'Medium-High' : ratio > 0.25 ? 'Medium' : 'Low';
  setTooltip({
    visible: true,
    x: e.clientX,
    y: e.clientY,
    header: `${dayLabel} ${String(hour).padStart(2, '0')}:00`,
    rows: count > 0 ? [{ color: cellColor, label: intensity, value: count }] : [],
  });
}}
onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
```

Where `cellColor` is the same color used for the cell background, and `dayLabel` is the full day name.

Note: When `count === 0`, show an empty tooltip or skip (rows will be empty so ChartTooltip won't render).

- [ ] **Step 3: Render ChartTooltip**

After the grid container, before the legend:

```tsx
<ChartTooltip visible={tooltip.visible} x={tooltip.x} y={tooltip.y} header={tooltip.header} rows={tooltip.rows} />
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`
Browser: Hover heatmap cells on SummaryDashboard.

```bash
git add app/ui/AlertHeatmap.tsx
git commit -m "feat: replace AlertHeatmap title tooltips with ChartTooltip"
```

---

### Task 9: Add Tooltip to KpiCard, SafetyScore, DriverLeaderboard

**Files:**
- Modify: `app/ui/KpiCard.tsx`
- Modify: `app/ui/SafetyScore.tsx`
- Modify: `app/ui/DriverLeaderboard.tsx`

- [ ] **Step 1: Add optional `tooltip` prop to KpiCard**

Add import and prop:

```typescript
import Tooltip from './Tooltip';

// Add to KpiCardProps:
tooltip?: string;
```

Wrap the outer `<div>` with `<Tooltip content={tooltip ?? ''}>`:

```tsx
return (
  <Tooltip content={tooltip ?? ''}>
    <div role="region" ...>
      {/* existing content */}
    </div>
  </Tooltip>
);
```

- [ ] **Step 2: Add optional `tooltip` prop to SafetyScore**

Same pattern — add `tooltip?: string` prop and wrap outer element:

```tsx
import Tooltip from './Tooltip';

// In component:
return (
  <Tooltip content={tooltip ?? ''}>
    <div className={cardSection} ...>
      {/* existing SVG and text */}
    </div>
  </Tooltip>
);
```

- [ ] **Step 3: Add tooltip to DriverLeaderboard rows**

Import Tooltip. Wrap each driver row's name/score area:

```tsx
import Tooltip from './Tooltip';

// Inside the driver map, wrap the driver info:
<Tooltip content={`Alerts: ${d.alertCount}${d.trend !== undefined ? ` | Trend: ${d.trend > 0 ? '+' : ''}${d.trend}` : ''}`}>
  <div className="flex items-center gap-2 ...">
    {/* existing rank, name, score */}
  </div>
</Tooltip>
```

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`

```bash
git add app/ui/KpiCard.tsx app/ui/SafetyScore.tsx app/ui/DriverLeaderboard.tsx
git commit -m "feat: add Tooltip support to KpiCard, SafetyScore, DriverLeaderboard"
```

---

## Chunk 3: Dashboard Filter Migrations

### Task 10: Migrate DrivingDashboard filters

**Files:**
- Modify: `app/dashboards/DrivingDashboard.tsx`

**Why first:** Simplest migration — only 2 filters (month + driver), already uses MonthPicker.

- [ ] **Step 1: Replace imports**

Remove `MonthPicker` import. Add:

```typescript
import InlineMonthPicker from '../ui/InlineMonthPicker';
import MultiSelect from '../ui/MultiSelect';
```

- [ ] **Step 2: Replace driver filter state**

Change `driverFilter: string` (single) to `driverFilters: string[]` (multi-select). Update all references:
- Filter logic: change `driverFilter === '' || row.driver === driverFilter` to `driverFilters.length === 0 || driverFilters.includes(row.driver)`
- Storage persistence: update key and shape

- [ ] **Step 3: Replace FilterBar contents**

Replace the FilterBar children with:

```tsx
<FilterBar>
  <InlineMonthPicker
    value={selectedMonth}
    onChange={(v) => setSelectedMonth(v as string)}
    lang={lang}
  />
  <MultiSelect
    label={lang === 'th' ? 'คนขับ' : 'drivers'}
    options={allDrivers}
    selected={driverFilters}
    onChange={setDriverFilters}
    lang={lang}
  />
  {(selectedMonth || driverFilters.length > 0) && (
    <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">
      {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
    </button>
  )}
</FilterBar>
```

Where `allDrivers` is computed from the data: `const allDrivers = useMemo(() => [...new Set(rows.map(r => r.driver))].sort(), [rows]);`

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`
Browser: Open DrivingDashboard, verify inline month picker and driver dropdown work.

```bash
git add app/dashboards/DrivingDashboard.tsx
git commit -m "feat: migrate DrivingDashboard to InlineMonthPicker + MultiSelect"
```

---

### Task 11: Migrate SummaryDashboard filters

**Files:**
- Modify: `app/dashboards/SummaryDashboard.tsx`

- [ ] **Step 1: Replace imports**

Remove any FilterChip import. Add:

```typescript
import InlineMonthPicker from '../ui/InlineMonthPicker';
import MultiSelect from '../ui/MultiSelect';
```

- [ ] **Step 2: Keep monthFilters as string[] — wire to InlineMonthPicker multi**

The existing `monthFilters: string[]` state is compatible. Replace the month chip search UI with:

```tsx
<InlineMonthPicker
  value={monthFilters}
  onChange={(v) => setMonthFilters(v as string[])}
  multi
  lang={lang}
/>
```

- [ ] **Step 3: Replace fleet filter with MultiSelect**

Replace the fleet chip search pattern with:

```tsx
<MultiSelect
  label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
  options={allFleets}
  selected={fleetFilters}
  onChange={setFleetFilters}
  lang={lang}
/>
```

Where `allFleets` is derived from the data.

- [ ] **Step 4: Remove old filter UI code**

Delete the month search input, fleet search input, chip rendering, Add buttons, and datalist elements.

- [ ] **Step 5: Add tooltip props to KpiCards and SafetyScore**

Pass `tooltip` prop to existing KpiCard/SafetyScore instances with contextual descriptions.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`
Browser: Open SummaryDashboard, test multi-month selection, fleet dropdown, tooltips.

```bash
git add app/dashboards/SummaryDashboard.tsx
git commit -m "feat: migrate SummaryDashboard to InlineMonthPicker + MultiSelect"
```

---

### Task 12: Migrate SimpleDashboard filters

**Files:**
- Modify: `app/dashboards/SimpleDashboard.tsx`

**Key change:** `dateRange: { from, to }` becomes `month: string`.

- [ ] **Step 1: Replace imports**

Remove FilterChip import. Add InlineMonthPicker and MultiSelect imports.

- [ ] **Step 2: Change filter state type**

```typescript
// Old:
type SimpleFilterState = {
  dateRange: { from: string; to: string };
  vehicleFilters: string[];
  driverFilters: string[];
  trendRemarkFilter: RemarkFilter;
};

// New:
type SimpleFilterState = {
  month: string;           // YYYY-MM or ''
  vehicleFilters: string[];
  driverFilters: string[];
  remarkFilters: string[]; // replaces trendRemarkFilter enum
};
```

Bump the storage key (e.g. append `-v2`) so old persisted state doesn't cause errors.

- [ ] **Step 3: Update filter logic**

Replace date range filtering:
```typescript
// Old: dateFilteredAlerts filters by from/to dates
// New: filter by month
const monthFilteredAlerts = useMemo(() => {
  if (!filters.month) return baseAlerts;
  return baseAlerts.filter((a) => a.monthKey === filters.month);
}, [baseAlerts, filters.month]);
```

Replace remark filter with array-based:
```typescript
// Old: trendRemarkFilter === 'all' || matches single enum
// New: remarkFilters.length === 0 || remarkFilters includes remark
```

- [ ] **Step 4: Replace FilterBar contents**

```tsx
<FilterBar>
  <InlineMonthPicker
    value={filters.month}
    onChange={(v) => setFilters(f => ({ ...f, month: v as string }))}
    lang={lang}
  />
  <MultiSelect
    label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'}
    options={vehicleOptions}
    selected={filters.vehicleFilters}
    onChange={(v) => setFilters(f => ({ ...f, vehicleFilters: v }))}
    lang={lang}
  />
  <MultiSelect
    label={lang === 'th' ? 'คนขับ' : 'drivers'}
    options={driverOptions}
    selected={filters.driverFilters}
    onChange={(v) => setFilters(f => ({ ...f, driverFilters: v }))}
    lang={lang}
  />
  <MultiSelect
    label={lang === 'th' ? 'ประเภท' : 'types'}
    options={remarkOptions}
    selected={filters.remarkFilters}
    onChange={(v) => setFilters(f => ({ ...f, remarkFilters: v }))}
    lang={lang}
  />
  {hasActiveFilters && (
    <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">
      {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
    </button>
  )}
</FilterBar>
```

- [ ] **Step 5: Add tooltip props to KpiCards**

Pass contextual tooltip strings to each KpiCard.

- [ ] **Step 6: Update prior-period trend calculation**

Change from date-range prior period to previous month:

```typescript
const prevMonth = useMemo(() => {
  if (!filters.month) return '';
  const [y, m] = filters.month.split('-').map(Number);
  const d = new Date(y, m - 2, 1); // previous month
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}, [filters.month]);
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc --noEmit`
Browser: Open SimpleDashboard, test month picker, all dropdowns, trend chart.

```bash
git add app/dashboards/SimpleDashboard.tsx
git commit -m "feat: migrate SimpleDashboard to InlineMonthPicker + MultiSelect"
```

---

### Task 13: Migrate DetailDashboard filters

**Files:**
- Modify: `app/dashboards/DetailDashboard.tsx`

**Context:** Most complex dashboard (1023 lines, 5 filter types + showExcluded toggle).

- [ ] **Step 1: Replace imports**

Remove FilterChip import. Add InlineMonthPicker and MultiSelect imports.

- [ ] **Step 2: Replace filter UI in FilterBar**

Replace the 5 chip-search filter groups with:

```tsx
<FilterBar>
  <InlineMonthPicker
    value={filters.monthFilters}
    onChange={(v) => setFilters(f => ({ ...f, monthFilters: v as string[] }))}
    multi
    lang={lang}
  />
  {!organizationName && (
    <MultiSelect
      label={lang === 'th' ? 'กลุ่มรถ' : 'fleets'}
      options={allFleets}
      selected={filters.fleetFilters}
      onChange={(v) => setFilters(f => ({ ...f, fleetFilters: v }))}
      lang={lang}
    />
  )}
  <MultiSelect
    label={lang === 'th' ? 'ประเภท' : 'types'}
    options={allRemarks}
    selected={filters.remarkFilters}
    onChange={(v) => setFilters(f => ({ ...f, remarkFilters: v }))}
    lang={lang}
  />
  <MultiSelect
    label={lang === 'th' ? 'ยานพาหนะ' : 'vehicles'}
    options={allVehicles}
    selected={filters.vehicleFilters}
    onChange={(v) => setFilters(f => ({ ...f, vehicleFilters: v }))}
    lang={lang}
  />
  <MultiSelect
    label={lang === 'th' ? 'คนขับ' : 'drivers'}
    options={allDrivers}
    selected={filters.driverFilters}
    onChange={(v) => setFilters(f => ({ ...f, driverFilters: v }))}
    lang={lang}
  />
  {/* Keep show excluded toggle */}
  <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
    <input
      type="checkbox"
      checked={filters.showExcluded}
      onChange={(e) => setFilters(f => ({ ...f, showExcluded: e.target.checked }))}
      className="rounded border-zinc-300"
    />
    {lang === 'th' ? 'แสดงที่ยกเว้น' : 'Show excluded'}
  </label>
  {hasActiveFilters && (
    <button type="button" onClick={resetFilters} className="ml-auto text-xs text-zinc-400 hover:text-zinc-600">
      {lang === 'th' ? 'รีเซ็ต' : 'Reset'}
    </button>
  )}
</FilterBar>
```

- [ ] **Step 3: Remove old filter UI code**

Delete month search input/datalist, fleet search input/datalist, remark toggle chips, vehicle search input/datalist, driver search input/datalist, and all associated Add button handlers.

- [ ] **Step 4: Update option lists**

Ensure `allFleets`, `allRemarks`, `allVehicles`, `allDrivers` are computed from the data:

```typescript
const allFleets = useMemo(() => [...new Set(alertRows.map(r => r.fleet).filter(Boolean))].sort(), [alertRows]);
const allRemarks = useMemo(() => [...new Set(alertRows.map(r => r.remarks).filter(Boolean))].sort(), [alertRows]);
const allVehicles = useMemo(() => [...new Set(alertRows.map(r => r.vehicle).filter(Boolean))].sort(), [alertRows]);
const allDrivers = useMemo(() => [...new Set(alertRows.map(r => r.driver).filter(Boolean))].sort(), [alertRows]);
```

- [ ] **Step 5: Add tooltip props to KpiCards**

Pass contextual tooltip strings.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc --noEmit`
Browser: Open DetailDashboard, test all 5 dropdowns, show excluded toggle, reset.

```bash
git add app/dashboards/DetailDashboard.tsx
git commit -m "feat: migrate DetailDashboard to InlineMonthPicker + MultiSelect"
```

---

## Chunk 4: Cleanup

### Task 14: Delete old components and verify

**Files:**
- Delete: `app/ui/MonthPicker.tsx`
- Delete: `app/dashboards/FilterChip.tsx`

- [ ] **Step 1: Check no remaining imports of old components**

Search for any remaining `import` of `MonthPicker` or `FilterChip` across the codebase. There should be none after the dashboard migrations.

Run: `grep -r "MonthPicker\|FilterChip" app/ --include="*.tsx" --include="*.ts" -l`
Expected: No files (or only the old files themselves)

- [ ] **Step 2: Delete old files**

```bash
rm app/ui/MonthPicker.tsx
rm app/dashboards/FilterChip.tsx
```

- [ ] **Step 3: Full TypeScript verification**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete MonthPicker and FilterChip (replaced by InlineMonthPicker + MultiSelect)"
```

---

### Task 15: Final browser verification

- [ ] **Step 1: Run dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify each dashboard**

Open each dashboard in the browser and check:

| Dashboard | Check |
|-----------|-------|
| SimpleDashboard | InlineMonthPicker (single), vehicle/driver/type MultiSelects, chart tooltips on trend, KPI tooltips |
| SummaryDashboard | InlineMonthPicker (multi), fleet MultiSelect, heatmap tooltips, donut tooltips, trend tooltips, KPI tooltips, safety score tooltip, leaderboard tooltips |
| DrivingDashboard | InlineMonthPicker (single), driver MultiSelect, chart tooltips |
| DetailDashboard | InlineMonthPicker (multi), fleet/type/vehicle/driver MultiSelects, show excluded checkbox, chart tooltips, heatmap tooltips |

- [ ] **Step 3: Check dark mode**

Toggle dark mode and verify all new components render correctly with dark variants.

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: polish filter and tooltip integration across dashboards"
```
