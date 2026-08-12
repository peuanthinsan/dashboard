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
