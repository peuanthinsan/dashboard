// Design tokens — shared className constants for the entire V2 design system

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
export const cardHover = `${cardBase} transition-all hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700`;
export const cardSection = `${cardBase} shadow-sm`;

// Badges
export const badge = 'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium';
export const badgeDefault = `${badge} bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300`;
export const badgeSuccess = `${badge} bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300`;
export const badgeWarning = `${badge} bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300`;
export const badgeDanger = `${badge} bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300`;
export const badgeInfo = `${badge} bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300`;

// Buttons
export const btnPrimary = 'inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900';
export const btnSecondary = 'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900';
export const btnGhost = 'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100';
export const btnDanger = 'inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700';
export const btnSmall = 'px-3 py-1.5 text-xs';

// Inputs
export const inputBase = 'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-400';
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
export const filterChipActive = 'inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white transition';
export const filterChipMuted = 'inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700';

// Charts
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
export const SAFETY_THRESHOLDS = { excellent: 90, good: 70, moderate: 50, poor: 0 };
