const padNumber = (value: number) => String(value).padStart(2, '0');

export const formatDate = (date: Date) =>
  `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}/${date.getFullYear()}`;

export const formatDateValue = (value: unknown) => {
  if (!value) return '—';
  const parsed = new Date(value as string);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return formatDate(parsed);
};
