import { NextResponse } from 'next/server';
import { parseGoogleSheetUrl } from 'app/utils/googleSheet';

type SheetColumn = {
  label: string;
  type: string;
  field: string;
};

type SheetRow = Record<string, unknown>;

type SheetFormattedRow = Record<string, string | null>;

const fieldSlug = (label: string, index: number) => {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return slug || `column_${index + 1}`;
};

const parseDateValue = (value: string) => {
  const match = value.match(
    /^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month),
    Number(day),
    Number(hour ?? 0),
    Number(minute ?? 0),
    Number(second ?? 0),
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseCellValue = (value: unknown) => {
  if (typeof value === 'string') {
    const parsedDate = parseDateValue(value);
    if (parsedDate) {
      return parsedDate;
    }
  }
  return value ?? null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sheetUrl = searchParams.get('sheetUrl');
  let sheetId = searchParams.get('sheetId');
  let gid = searchParams.get('gid') ?? '0';

  if (!sheetId && sheetUrl) {
    const parsed = parseGoogleSheetUrl(sheetUrl);
    if (parsed) {
      sheetId = parsed.sheetId;
      gid = parsed.gid;
    }
  }

  if (!sheetId) {
    return NextResponse.json(
      { error: 'Missing sheetId or sheetUrl.' },
      { status: 400 },
    );
  }

  const sheetResponse = await fetch(
    `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?gid=${gid}&tqx=out:json`,
    { cache: 'no-store' },
  );

  if (!sheetResponse.ok) {
    return NextResponse.json(
      { error: 'Unable to fetch Google Sheet data.' },
      { status: sheetResponse.status },
    );
  }

  const text = await sheetResponse.text();
  const match = text.match(/google\.visualization\.Query\.setResponse\((.*)\);?$/s);
  if (!match) {
    return NextResponse.json(
      { error: 'Unexpected Google Sheet response.' },
      { status: 500 },
    );
  }

  const data = JSON.parse(match[1]);
  const columns: SheetColumn[] = (data.table?.cols ?? []).map(
    (column: { label?: string; type?: string }, index: number) => {
      const label = column.label || `Column ${index + 1}`;
      return {
        label,
        type: column.type ?? 'string',
        field: fieldSlug(label, index),
      };
    },
  );

  const rows = data.table?.rows ?? [];
  const records: SheetRow[] = rows.map((row: { c?: Array<{ v?: unknown; f?: string }> }) => {
    return columns.reduce<SheetRow>((acc, column, index) => {
      const cell = row.c?.[index];
      acc[column.field] = parseCellValue(cell?.v ?? null);
      return acc;
    }, {});
  });

  const formattedRows: SheetFormattedRow[] = rows.map(
    (row: { c?: Array<{ v?: unknown; f?: string }> }) => {
      return columns.reduce<SheetFormattedRow>((acc, column, index) => {
        const cell = row.c?.[index];
        acc[column.field] = cell?.f ?? null;
        return acc;
      }, {});
    },
  );

  return NextResponse.json({ columns, records, formattedRows });
}
