export const formatDateTimeGB = (date: Date) =>
  date.toLocaleString('en-GB', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export const formatDateKeyGB = (value: string) => {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return value;
  const parsed = new Date(`${year}-${month}-${day}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : formatDateTimeGB(parsed);
};
