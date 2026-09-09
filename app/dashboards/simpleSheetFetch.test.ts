import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadSimpleSheet } from './simpleSheetFetch';

const summaryHeaders = [
  { label: 'เดือน (YYYY-MM)', type: 'date' },
  { label: 'ประเภท (คอลัมน์ H)', type: 'string' },
  { label: 'จำนวนสรุป', type: 'number' },
];
const rawHeaders = [
  { label: 'Alert Date Time', type: 'datetime' },
  { label: 'Vehicle No', type: 'string' },
  { label: 'Remark', type: 'string' },
];
const unknownHeaders = [{ label: 'Something else', type: 'string' }];

function payload(cols: typeof summaryHeaders, rows: { v: unknown; f?: string }[][] = []) {
  return `google.visualization.Query.setResponse(${JSON.stringify({
    status: 'ok', table: { cols, rows: rows.map((c) => ({ c })) },
  })});`;
}

function mockFetch() {
  const fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function waitForAbort(_url: string | URL | Request, options?: RequestInit): Promise<Response> {
  const signal = options!.signal!;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('loadSimpleSheet', () => {
  it.each([['raw', rawHeaders], ['raw with summary helper columns', [...rawHeaders, ...summaryHeaders]], ['unknown', unknownHeaders]] as const)(
    'uses one small header request for %s sheets, preserving the existing raw loading path', async (_name, headers) => {
      const fetchMock = mockFetch().mockResolvedValueOnce(new Response(payload([...headers])));
      await expect(loadSimpleSheet('sheet /?&', 'tab &1', new AbortController().signal))
        .resolves.toEqual({ kind: 'raw' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0]!;
      const parsedUrl = new URL(String(url));
      expect(parsedUrl.pathname).toBe('/spreadsheets/d/sheet%20%2F%3F%26/gviz/tq');
      expect(parsedUrl.searchParams.get('gid')).toBe('tab &1');
      expect(parsedUrl.searchParams.get('tqx')).toBe('out:json');
      expect(parsedUrl.searchParams.get('tq')).toBe('select * limit 1');
      expect(parsedUrl.searchParams.getAll('headers')).toEqual(['1']);
      expect(Array.from(parsedUrl.searchParams.keys()).sort()).toEqual(['gid', 'headers', 'tq', 'tqx']);
      expect(options?.cache).toBe('no-store');
      expect(options?.signal).toBeInstanceOf(AbortSignal);
    },
  );

  it.each([
    ['HTTP failure', () => new Response('unavailable', { status: 503 })],
    ['GViz error', () => new Response('google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"access_denied"}]});')],
    ['malformed response', () => new Response('<html>Sign in</html>')],
    ['malformed JSON', () => new Response('google.visualization.Query.setResponse({broken});')],
    ['empty columns', () => new Response(payload([]))],
  ] as const)('falls back to raw loading after a probe %s', async (_name, response) => {
    const fetchMock = mockFetch().mockResolvedValueOnce(response());
    await expect(loadSimpleSheet('sheet', '0', new AbortController().signal))
      .resolves.toEqual({ kind: 'raw' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to raw loading after a probe network failure', async () => {
    const fetchMock = mockFetch().mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(loadSimpleSheet('sheet', '0', new AbortController().signal))
      .resolves.toEqual({ kind: 'raw' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('bounds the header probe to five seconds and falls back to raw on timeout', async () => {
    const timeout = new AbortController();
    const timeoutMock = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    const fetchMock = mockFetch().mockImplementationOnce(waitForAbort);
    const result = loadSimpleSheet('sheet', '0', new AbortController().signal);
    timeout.abort(new DOMException('Probe timed out', 'TimeoutError'));
    await expect(result).resolves.toEqual({ kind: 'raw' });
    expect(timeoutMock).toHaveBeenCalledExactlyOnceWith(5_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fetches all summary columns and rows without a cap, date filter, or ordering query', async () => {
    const timeoutSignals: AbortSignal[] = [];
    const timeoutMock = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => {
      const signal = new AbortController().signal;
      timeoutSignals.push(signal);
      return signal;
    });
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(new Response(payload(summaryHeaders, [
        [{ v: 'Date(2026,5,1)', f: '2026-06' }, { v: 'F&D' }, { v: 1 }],
      ])))
      .mockResolvedValueOnce(new Response(payload(summaryHeaders, [
        [{ v: 'Date(2026,5,1)', f: '2026-06' }, { v: 'F&D' }, { v: 1 }],
        [{ v: 'Date(2026,6,1)', f: '2026-07' }, { v: 'Distraction' }, { v: 1584, f: '1,584' }],
        [{ v: 'Date(2031,0,1)', f: '2031-01' }, { v: 'A new alert type' }, { v: 0 }],
      ])));
    const result = await loadSimpleSheet('sheet', '0', new AbortController().signal);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(timeoutMock.mock.calls).toEqual([[5_000], [30_000]]);
    expect(timeoutSignals).toHaveLength(2);
    const fullUrl = new URL(String(fetchMock.mock.calls[1]![0]));
    expect(Array.from(fullUrl.searchParams.keys()).sort()).toEqual(['gid', 'headers', 'tqx']);
    expect(fullUrl.searchParams.getAll('headers')).toEqual(['1']);
    expect(fullUrl.searchParams.has('tq')).toBe(false);
    expect(result.kind).toBe('summary');
    if (result.kind !== 'summary') throw new Error('Expected summary data');
    expect(result.columns.map(({ label }) => label)).toEqual(summaryHeaders.map(({ label }) => label));
    expect(result.rows).toEqual([
      { 'เดือน (YYYY-MM)': '2026-06', 'ประเภท (คอลัมน์ H)': 'F&D', 'จำนวนสรุป': 1 },
      { 'เดือน (YYYY-MM)': '2026-07', 'ประเภท (คอลัมน์ H)': 'Distraction', 'จำนวนสรุป': '1,584' },
      { 'เดือน (YYYY-MM)': '2031-01', 'ประเภท (คอลัมน์ H)': 'A new alert type', 'จำนวนสรุป': 0 },
    ]);
    expect(result.lastUpdated).toBeInstanceOf(Date);
    expect(Number.isFinite(result.lastUpdated.getTime())).toBe(true);
  });

  it.each([
    ['HTTP failure', () => new Response('unavailable', { status: 503 })],
    ['GViz error', () => new Response('google.visualization.Query.setResponse({"status":"error"});')],
    ['malformed response', () => new Response('<html>Sign in</html>')],
  ] as const)('surfaces a full-summary %s after detection instead of switching to raw', async (_name, response) => {
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(new Response(payload(summaryHeaders)))
      .mockResolvedValueOnce(response());
    await expect(loadSimpleSheet('sheet', '0', new AbortController().signal)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not treat caller cancellation during the probe as a raw fallback', async () => {
    const controller = new AbortController();
    const fetchMock = mockFetch().mockImplementationOnce(waitForAbort);
    const result = loadSimpleSheet('sheet', '0', controller.signal);
    const canceled = new DOMException('Canceled', 'AbortError');
    controller.abort(canceled);
    await expect(result).rejects.toBe(canceled);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows a useful retry message when the full summary request times out', async () => {
    mockFetch()
      .mockResolvedValueOnce(new Response(payload(summaryHeaders)))
      .mockRejectedValueOnce(new DOMException('signal timed out', 'TimeoutError'));
    await expect(loadSimpleSheet('sheet', '0', new AbortController().signal))
      .rejects.toThrow('Loading the monthly summary timed out. Please retry.');
  });

  it.each([['raw', rawHeaders], ['summary', summaryHeaders]] as const)(
    'stops when cancellation happens as a successful %s probe body finishes', async (_name, headers) => {
      const controller = new AbortController();
      const canceled = new DOMException('Canceled after probe', 'AbortError');
      const fetchMock = mockFetch().mockResolvedValueOnce({
        ok: true,
        text: async () => {
          controller.abort(canceled);
          return payload([...headers]);
        },
      } as Response);
      await expect(loadSimpleSheet('sheet', '0', controller.signal)).rejects.toBe(canceled);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps caller cancellation during the full summary fetch as a rejection', async () => {
    const controller = new AbortController();
    let fullStarted!: () => void;
    const ready = new Promise<void>((resolve) => { fullStarted = resolve; });
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(new Response(payload(summaryHeaders)))
      .mockImplementationOnce((url, options) => {
        fullStarted();
        return waitForAbort(url, options);
      });
    const result = loadSimpleSheet('sheet', '0', controller.signal);
    await ready;
    const canceled = new DOMException('Canceled full fetch', 'AbortError');
    controller.abort(canceled);
    await expect(result).rejects.toBe(canceled);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
