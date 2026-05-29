/** Reference long address — location columns must fit this in ≤3 lines at text-xs. */
export const DRIVING_LOCATION_REFERENCE_ADDRESS =
  'Thanon Phetkasem,Tambon Ko Lak,Amphoe Mueang Prachuap Khiri Khan,Chang Wat Prachuap Khiri Khan,Thailand,77000';

/** ~47 chars/line at text-xs; fits the reference address in three lines. */
export const DRIVING_LOCATION_COLUMN_MAX_WIDTH_CLASS = 'max-w-[20rem]';

export const DRIVING_LOCATION_TEXT_CLASS =
  'block w-full line-clamp-3 break-words text-xs leading-snug text-zinc-700 dark:text-zinc-300';

/** Greedy comma-aware wrap used to validate column width (Geist text-xs ≈ 47 chars at 20rem). */
export function packAddressSegmentsIntoLines(address: string, maxCharsPerLine: number): string[] {
  const parts = address.split(',').map((segment, index, all) =>
    index < all.length - 1 ? `${segment},` : segment,
  );
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    const candidate = line + part;
    if (candidate.length <= maxCharsPerLine || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = part;
    }
  }
  if (line) lines.push(line);
  return lines;
}
