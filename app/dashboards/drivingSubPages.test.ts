import { describe, expect, it } from 'vitest';
import { deriveSubPages } from './drivingSubPages';

describe('deriveSubPages', () => {
  it('produces Overview + ascending Drive Hours + ascending Rest Hours tabs', () => {
    const out = deriveSubPages({ driveHours: [10, 4], restHours: [10], cntDrvHours: [4] }, 'en');
    expect(out.map((p) => p.kind)).toEqual(['overview', 'drive_hrs', 'drive_hrs', 'rest_hrs', 'cnt_drv_hrs']);
    expect(out[1]).toMatchObject({ kind: 'drive_hrs', threshold: 4, slug: 'drive-hrs-4' });
    expect(out[2]).toMatchObject({ kind: 'drive_hrs', threshold: 10, slug: 'drive-hrs-10' });
    expect(out[3]).toMatchObject({ kind: 'rest_hrs', threshold: 10, slug: 'rest-hrs-10' });
    expect(out[4]).toMatchObject({ kind: 'cnt_drv_hrs', threshold: 4, slug: 'cnt-drv-hrs-4' });
  });

  it('uses entry label when provided', () => {
    const out = deriveSubPages({
      driveHours: [],
      cntDrvHours: [{ value: 4, label: 'Cnt Drv > 4 h' }],
      restHours: [],
    }, 'en');
    expect(out[1].label).toBe('Cnt Drv > 4 h');
  });

  it('falls back to language-specific label when no override', () => {
    const en = deriveSubPages({ driveHours: [10], restHours: [], cntDrvHours: [] }, 'en');
    const th = deriveSubPages({ driveHours: [10], restHours: [], cntDrvHours: [] }, 'th');
    expect(en[1].label).toBe('Drive Hr/day > 10 h');
    expect(th[1].label).toBe('ขับรถ/วัน > 10 h');
  });
});
