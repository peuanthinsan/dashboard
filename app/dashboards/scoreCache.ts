const STORAGE_KEY = 'dashboard-scores';

export type CachedScore = {
  score: number;
  alertCount: number;
  updatedAt: number;
};

type ScoreMap = Record<string, CachedScore>;

function readAll(): ScoreMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScoreMap) : {};
  } catch {
    return {};
  }
}

export function saveDashboardScore(dashboardId: string, score: number, alertCount: number): void {
  if (typeof window === 'undefined') return;
  try {
    const map = readAll();
    map[dashboardId] = { score, alertCount, updatedAt: Date.now() };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage failures.
  }
}

export function getDashboardScore(dashboardId: string): CachedScore | null {
  const map = readAll();
  return map[dashboardId] ?? null;
}

export function getAllDashboardScores(): ScoreMap {
  return readAll();
}
