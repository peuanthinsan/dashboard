// Design tokens — SongdeeGPS premium theme: red / charcoal / glass

// ── Surfaces ────────────────────────────────────────────
export const surfaceBackground = 'bg-zinc-50 dark:bg-zinc-950';
export const surface = 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200/60 dark:border-zinc-800/60';
export const surfaceRaised = 'bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 shadow-card';
export const surfaceInset = 'bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800/40';

// ── Typography ──────────────────────────────────────────
export const heading1 = 'text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50';
export const heading2 = 'text-lg font-semibold tracking-tight text-zinc-800 dark:text-zinc-100';
export const heading3 = 'text-sm font-semibold text-zinc-800 dark:text-zinc-200';
export const textSecondary = 'text-sm text-zinc-500 dark:text-zinc-400';
export const textMuted = 'text-xs text-zinc-400 dark:text-zinc-500';

// ── Cards ───────────────────────────────────────────────
export const cardBase =
  'rounded-xl border border-zinc-200/60 bg-white/80 p-5 backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-900/80';
export const cardHover = `${cardBase} transition-all duration-200 hover:border-red-300/60 hover:shadow-card-hover hover:translate-y-[-1px] dark:hover:border-red-800/60`;
export const cardSection = `${cardBase} shadow-card`;

// ── Badges ──────────────────────────────────────────────
export const badge =
  'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset';
export const badgeDefault = `${badge} bg-zinc-50 text-zinc-600 ring-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:ring-zinc-700`;
export const badgeSuccess = `${badge} bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-800/40`;
export const badgeWarning = `${badge} bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-800/40`;
export const badgeDanger = `${badge} bg-red-50 text-red-700 ring-red-200/60 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-800/40`;
export const badgeInfo = `${badge} bg-blue-50 text-blue-700 ring-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-800/40`;

// ── Buttons ─────────────────────────────────────────────
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-red-500 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:from-red-600 hover:to-red-700 hover:shadow-md active:translate-y-[0.5px] focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 dark:focus:ring-offset-zinc-900';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200/80 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-all duration-200 hover:bg-zinc-50 hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:hover:border-zinc-600 dark:focus:ring-offset-zinc-900';
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition-all duration-200 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-red-500 to-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:from-red-600 hover:to-red-700';
export const btnSmall = 'px-3 py-1.5 text-xs';

// ── Inputs ──────────────────────────────────────────────
export const inputBase =
  'w-full rounded-lg border border-zinc-300/80 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm placeholder:text-zinc-400 transition-all duration-200 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-red-500 dark:focus:ring-red-500/20';
export const selectBase = `${inputBase} cursor-pointer`;
export const labelBase = 'block text-sm font-medium text-zinc-700 dark:text-zinc-300';

// ── Tables ──────────────────────────────────────────────
export const tableHead =
  'border-b border-zinc-200/80 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-900/50';
export const tableHeadCell =
  'px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400';
export const tableHeadSticky = `${tableHead} sticky top-0 z-10 backdrop-blur-sm`;
export const tableRow =
  'border-b border-zinc-100/80 transition-colors duration-150 hover:bg-red-50/30 dark:border-zinc-800/50 dark:hover:bg-red-950/10';
export const tableCell = 'px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300';

// ── Layout ──────────────────────────────────────────────
export const pageContainer = 'min-h-screen bg-zinc-50 dark:bg-zinc-950';
export const pageContent = 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8';
export const pageHeader = 'mb-8';

// ── Filter chips ────────────────────────────────────────
export const filterChipActive =
  'inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-red-500 to-red-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition-all';
export const filterChipMuted =
  'inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 transition-all hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

// ── Charts — vibrant diverse palette ────────────────────
export const CHART_COLORS = [
  '#EF4444', // red-500 — primary
  '#3B82F6', // blue-500
  '#F59E0B', // amber-500
  '#10B981', // emerald-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#F97316', // orange-500
  '#6366F1', // indigo-500
  '#14B8A6', // teal-500
];

// Gradient stop pairs for each CHART_COLORS entry (light → vivid)
export const CHART_GRADIENTS: [string, string][] = [
  ['#FEE2E2', '#EF4444'], // red
  ['#DBEAFE', '#3B82F6'], // blue
  ['#FEF3C7', '#F59E0B'], // amber
  ['#D1FAE5', '#10B981'], // emerald
  ['#EDE9FE', '#8B5CF6'], // violet
  ['#FCE7F3', '#EC4899'], // pink
  ['#CFFAFE', '#06B6D4'], // cyan
  ['#FFEDD5', '#F97316'], // orange
  ['#E0E7FF', '#6366F1'], // indigo
  ['#CCFBF1', '#14B8A6'], // teal
];
export const SAFETY_THRESHOLDS = { excellent: 90, good: 70, moderate: 50, poor: 0 };

/* ── Tooltip ─────────────────────────────────── */
export const tooltipBase =
  'bg-zinc-900/95 text-white text-xs rounded-lg shadow-lg px-3 py-2 backdrop-blur-sm ring-1 ring-white/10';

/* ── MultiSelect ─────────────────────────────── */
export const multiSelectTrigger =
  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs cursor-pointer transition-all duration-200';
export const multiSelectDefault =
  'border-zinc-200/80 bg-white text-zinc-500 shadow-sm hover:border-zinc-300 hover:shadow dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-600';
export const multiSelectActive =
  'border-red-200 bg-red-50 text-red-600 shadow-sm hover:border-red-300 dark:border-red-800 dark:bg-red-950/60 dark:text-red-400';
export const multiSelectOpen =
  'border-red-400 bg-white text-zinc-700 shadow-md ring-2 ring-red-500/20 dark:border-red-500 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-red-500/20';
export const multiSelectPanel =
  'absolute top-full mt-1.5 min-w-[220px] rounded-xl border border-zinc-200/80 bg-white/95 shadow-xl backdrop-blur-sm z-50 dark:border-zinc-700 dark:bg-zinc-900/95';
