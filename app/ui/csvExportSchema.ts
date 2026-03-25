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
