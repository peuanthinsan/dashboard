// Design tokens — SongdeeGPS theme: red / grey / black / white

// Surfaces
export const surfaceBackground = 'bg-zinc-50 dark:bg-zinc-950';
export const surface = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800';
export const surfaceRaised = 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm';
export const surfaceInset = 'bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/50';

// Typography
export const heading1 = 'text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50';
export const heading2 = 'text-lg font-semibold text-zinc-900 dark:text-zinc-50';
export const heading3 = 'text-sm font-semibold text-zinc-900 dark:text-zinc-50';
export const textSecondary = 'text-sm text-zinc-500 dark:text-zinc-400';
export const textMuted = 'text-xs text-zinc-400 dark:text-zinc-500';

// Cards
export const cardBase = 'rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900';
export const cardHover = `${cardBase} transition-all hover:border-red-300 hover:shadow-md dark:hover:border-red-900`;
export const cardSection = `${cardBase} shadow-sm`;

// Badges
export const badge = 'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium';
export const badgeDefault = `${badge} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`;
export const badgeSuccess = `${badge} bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`;
export const badgeWarning = `${badge} bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300`;
export const badgeDanger = `${badge} bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`;
export const badgeInfo = `${badge} bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300`;

// Buttons
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900';
export const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
export const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700';
export const btnSmall = 'px-3 py-1.5 text-xs';

// Inputs
export const inputBase = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-red-400 dark:focus:ring-red-400';
export const selectBase = `${inputBase} cursor-pointer`;
export const labelBase = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';

// Tables
export const tableHead = 'border-b border-zinc-200 dark:border-zinc-800';
export const tableHeadCell = 'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
export const tableHeadSticky = `${tableHead} sticky top-0 z-10 bg-white dark:bg-zinc-900`;
export const tableRow = 'border-b border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800/50 dark:hover:bg-zinc-800/30';
export const tableCell = 'px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300';

// Layout
export const pageContainer = 'min-h-screen bg-zinc-50 dark:bg-zinc-950';
export const pageContent = 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8';
export const pageHeader = 'mb-8';

// Filter chips
export const filterChipActive = 'inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-medium text-white transition';
export const filterChipMuted = 'inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

// Charts — SongdeeGPS palette: red-forward, grey, black, gold accents
export const CHART_COLORS = [
  '#DC2626', // red-600 — primary brand
  '#374151', // gray-700 — dark grey
  '#F59E0B', // amber — gold accent
  '#111827', // gray-900 — near black
  '#EF4444', // red-500 — lighter red
  '#6B7280', // gray-500 — mid grey
  '#B91C1C', // red-700 — deep red
  '#D97706', // amber-600 — deep gold
  '#9CA3AF', // gray-400 — light grey
  '#991B1B', // red-800 — darkest red
];

// Gradient stop pairs for each CHART_COLORS entry (light → vivid)
export const CHART_GRADIENTS: [string, string][] = [
  ['#FEE2E2', '#DC2626'], // red
  ['#F3F4F6', '#374151'], // grey
  ['#FEF3C7', '#F59E0B'], // gold
  ['#F3F4F6', '#111827'], // black
  ['#FEE2E2', '#EF4444'], // light red
  ['#F3F4F6', '#6B7280'], // mid grey
  ['#FEE2E2', '#B91C1C'], // deep red
  ['#FEF3C7', '#D97706'], // deep gold
  ['#F3F4F6', '#9CA3AF'], // light grey
  ['#FEE2E2', '#991B1B'], // darkest red
];
export const SAFETY_THRESHOLDS = { excellent: 90, good: 70, moderate: 50, poor: 0 };

/* ── Tooltip ─────────────────────────────────────────── */
export const tooltipBase = 'bg-zinc-900 text-white text-xs rounded-md shadow-lg px-2.5 py-1.5';

/* ── MultiSelect ─────────────────────────────────────── */
export const multiSelectTrigger = 'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs cursor-pointer transition';
export const multiSelectDefault = 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600';
export const multiSelectActive = 'border-red-200 bg-red-50 text-red-600 hover:border-red-300 dark:border-red-800 dark:bg-red-950 dark:text-red-400';
export const multiSelectOpen = 'border-red-500 bg-white text-zinc-700 dark:border-red-400 dark:bg-zinc-900 dark:text-zinc-200';
export const multiSelectPanel = 'absolute top-full mt-1 min-w-[200px] rounded-lg border border-zinc-200 bg-white shadow-lg z-50 dark:border-zinc-700 dark:bg-zinc-900';
