/**
 * Final `lines.join('\n')` for very large exports can block the main thread.
 * A blob Worker runs the join off-thread (structured-clone cost applies; use only above threshold).
 */
export const CSV_JOIN_WORKER_LINE_THRESHOLD = 3000;

export function joinCsvLinesInWorker(lines: string[]): Promise<string> {
  const workerSource = `self.onmessage=function(e){self.postMessage({csv:e.data.lines.join("\\n")});};`;
  const blob = new Blob([workerSource], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const w = new Worker(url);
    w.onmessage = (ev: MessageEvent<{ csv?: string }>) => {
      URL.revokeObjectURL(url);
      w.terminate();
      const csv = ev.data?.csv;
      if (typeof csv === 'string') resolve(csv);
      else reject(new Error('CSV join worker returned no string'));
    };
    w.onerror = (e) => {
      URL.revokeObjectURL(url);
      w.terminate();
      reject(e.error ?? e);
    };
    w.postMessage({ lines });
  });
}
