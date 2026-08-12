/**
 * Returns whether saved column prefs (visibility/order) still match the current export schema.
 * If the sheet or dashboard columns change, we drop saved prefs to avoid stale toggles.
 */
export function shouldUseSavedColumnPrefs(
  saved: { key: string }[] | null | undefined,
  schema: { key: string }[],
): boolean {
  if (!saved?.length || !schema.length) return false;
  const schemaKeys = new Set(schema.map((c) => c.key));
  const savedKeys = new Set(saved.map((c) => c.key));
  if (schemaKeys.size !== savedKeys.size) return false;
  return Array.from(schemaKeys).every((k) => savedKeys.has(k));
}

/**
 * Keeps the raw-sheet export easy to scan by putting the driver's name before
 * the identifier column, without changing the order of any other columns.
 */
export function placeDriverNameBeforeId<T extends { label: string }>(schema: T[]): T[] {
  const driverIndex = schema.findIndex((column) => column.label.trim().toLowerCase() === 'driver name');
  const idIndex = schema.findIndex((column) => column.label.trim().toLowerCase() === 'id');

  if (driverIndex < 0 || idIndex < 0 || driverIndex < idIndex) return schema;

  const driver = schema[driverIndex]!;
  return [...schema.slice(0, idIndex), driver, ...schema.slice(idIndex, driverIndex), ...schema.slice(driverIndex + 1)];
}

/** Returns a reordered copy, leaving the list unchanged at either boundary. */
export function moveColumn<T>(columns: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (index < 0 || index >= columns.length || nextIndex < 0 || nextIndex >= columns.length) {
    return columns;
  }

  const next = [...columns];
  [next[index], next[nextIndex]] = [next[nextIndex]!, next[index]!];
  return next;
}

/** Moves one column to the position occupied by another column. */
export function moveColumnTo<T>(columns: T[], sourceIndex: number, targetIndex: number): T[] {
  if (
    sourceIndex < 0 ||
    sourceIndex >= columns.length ||
    targetIndex < 0 ||
    targetIndex >= columns.length ||
    sourceIndex === targetIndex
  ) {
    return columns;
  }

  const next = [...columns];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved!);
  return next;
}
