export function parseGoogleSheetUrl(sheetUrl: string) {
  const trimmed = sheetUrl.trim();
  if (!trimmed) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const match = url.pathname.match(/spreadsheets\/d\/([^/]+)/i);
  if (!match) {
    return null;
  }
  const sheetId = match[1];
  const gid = url.searchParams.get('gid') ?? '0';

  return { sheetId, gid };
}
