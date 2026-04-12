import { describe, expect, it } from 'vitest';
import { ALLOWED_ALERT_TYPES } from 'app/dashboards/dashboardDataUtils';
import { mergeStandardWithProbed } from 'app/dashboards/sheetFieldProbe';

describe('mergeStandardWithProbed', () => {
  it('includes standard types and adds new probed types', () => {
    const { alertTypes, remarks } = mergeStandardWithProbed({
      alertTypes: ['Forward Collision-A2', 'OverSpeed'],
      remarks: ['Distraction'],
    });
    expect(alertTypes).toContain('Forward Collision-A2');
    expect(alertTypes).toContain('OverSpeed');
    expect(alertTypes.length).toBeGreaterThanOrEqual(ALLOWED_ALERT_TYPES.length);
    expect(remarks).toContain('Distraction');
    expect(alertTypes).toEqual([...alertTypes].sort((a, b) => a.localeCompare(b)));
  });
});
