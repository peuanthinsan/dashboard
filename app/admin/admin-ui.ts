import {
  btnPrimary,
  btnSecondary,
  btnDanger,
  cardBase,
  cardSection,
  inputBase,
  selectBase,
  labelBase,
  textSecondary,
  textMuted,
  badgeDefault,
} from 'app/ui/design-tokens';

export const ADMIN_PRIMARY_BUTTON = `${btnPrimary} w-full sm:w-auto`;

export const ADMIN_SAVE_BUTTON = `${btnSecondary} w-full sm:w-auto`;

export const ADMIN_DELETE_BUTTON = `${btnDanger} w-full sm:w-auto`;

export const ADMIN_SECTION = `${cardSection} grid gap-6 p-6`;

export const ADMIN_CARD = cardBase;

export const ADMIN_CARD_GRADIENT =
  'rounded-xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-4 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950';

export const ADMIN_PILL = badgeDefault;

export const ADMIN_FORM_PANEL =
  'rounded-xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950';

export const ADMIN_ROW_FORM =
  'flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 sm:flex-row sm:flex-wrap sm:items-end';

export const ADMIN_INPUT = inputBase;

export const ADMIN_SELECT = selectBase;

export const ADMIN_TEXTAREA = inputBase;

export const ADMIN_LABEL = labelBase;

export const ADMIN_TEXT_MUTED = textSecondary;

export const ADMIN_TEXT_SUBTLE = textMuted;

export const ADMIN_HINT_TEXT = 'text-[11px] text-zinc-500 dark:text-zinc-500';
