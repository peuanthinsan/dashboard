export type ParsedSheet = {
  sheetId: string;
  gid: string;
};

const GOOGLE_SHEET_ID_REGEX = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;

export function parseGoogleSheetUrl(url: string): ParsedSheet | null {
  if (!url) return null;
  const match = url.match(GOOGLE_SHEET_ID_REGEX);
  if (!match) return null;
  const sheetId = match[1];
  let gid = '0';
  try {
    const parsedUrl = new URL(url);
    const gidParam = parsedUrl.searchParams.get('gid');
    if (gidParam) {
      gid = gidParam;
    }
  } catch (error) {
    // Ignore invalid URL parsing, fallback to gid=0.
  }
  return { sheetId, gid };
}

export function buildSheetUrl(sheetId: string, gid: string) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/edit#gid=${gid}`;
}
