import { describe, expect, it, vi } from 'vitest';
vi.mock('./db', () => ({ db: {} }));
import { cameraHistorySourceKey } from './unit-camera-history';

describe('durable camera history namespace', () => {
  it('shares a roster across viewers of the same company/source/fleet scope', () => {
    expect(cameraHistorySourceKey(1, 'sheet', 'gid:4', [2, 3, 2])).toBe(cameraHistorySourceKey(1, 'sheet', 'gid:4', [3, 2]));
  });
  it('does not share history across companies, source tabs, or authorized fleet scopes', () => {
    const keys = [
      cameraHistorySourceKey(1, 'sheet', 'gid:4', [2]), cameraHistorySourceKey(2, 'sheet', 'gid:4', [2]),
      cameraHistorySourceKey(1, 'other', 'gid:4', [2]), cameraHistorySourceKey(1, 'sheet', 'gid:5', [2]),
      cameraHistorySourceKey(1, 'sheet', 'gid:4', [3]), cameraHistorySourceKey(1, 'sheet', 'gid:4', []),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });
});
