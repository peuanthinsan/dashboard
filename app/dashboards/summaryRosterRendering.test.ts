import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SummaryDashboard from './SummaryDashboard';

const state = vi.hoisted(() => ({ completeRange: false, alertError: null as string | null, rosterError: null as string | null }));
vi.mock('./useGoogleSheet', () => ({ default: () => ({ rows: [], columns: [], loading: false, refreshing: false, error: state.alertError,
  progress: null, lastUpdated: null, refresh: vi.fn(), availableMonths: [] }) }));
vi.mock('./useDriverRoster', () => ({ default: () => ({ entries: [{ vehicle: '1001', driver: 'Zero Driver', fleet: 'SERVICE' }],
  namePolicy: 'vehicle', loading: false, error: state.rosterError, refresh: vi.fn(), lastUpdated: null }) }));
vi.mock('./dateTimeRange', async (importOriginal) => ({ ...await importOriginal<typeof import('./dateTimeRange')>(),
  isCompleteDateTimeRange: () => state.completeRange }));

const render = () => renderToStaticMarkup(React.createElement(SummaryDashboard, {
  dashboardId: 'fixture', dashboardName: 'Fixture', sheetId: 'fixture', sheetGid: '0', organizationName: 'SERVICE', hasDriverRoster: true,
}));

describe('roster summary rendering', () => {
  beforeEach(() => {
    state.completeRange = false;
    state.alertError = null;
    state.rosterError = null;
  });
  it.each(['alertError', 'rosterError'] as const)('shows source failures and Retry before a date exists (%s)', (source) => {
    state[source] = 'Source unavailable';
    const html = render();
    expect(html).toContain('Source unavailable');
    expect(html).toContain('Retry');
    expect(html).not.toContain('Select a complete date range');
    expect(html).not.toContain('No alerts recorded');
  });
  it('keeps the roster driver and OverSpeed zero without displaying a perfect score', () => {
    state.completeRange = true;
    const html = render();
    expect(html).toContain('Zero Driver');
    expect(html).toContain('OverSpeed');
    expect(html).toContain('No alerts recorded');
    expect(html).toContain('Not enough data');
    expect(html).not.toContain('Safety score: 100');
  });
});
