export type SheetReference = {
  id: string;
  gid: string;
};

export const parseSheetUrl = (url: string): SheetReference | null => {
  if (!url) return null;
  const idMatch = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
  return {
    id: idMatch[1],
    gid: gidMatch ? gidMatch[1] : '0',
  };
};
