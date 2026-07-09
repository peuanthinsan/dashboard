import { describe, it, expect } from 'vitest';
import { buildAlertColumnSelect } from './googleSheetFetch';
import type { GoogleSheetColumn } from './googleSheetParse';

function cols(...labels: string[]): GoogleSheetColumn[] {
  return labels.map((label) => ({ label, type: 'string', fieldKey: label }));
}

describe('buildAlertColumnSelect', () => {
  it('always keeps column A and matches alert labels case-insensitively', () => {
    const select = buildAlertColumnSelect(
      cols('id', 'Vehicle No', 'Driver Name', 'Alert Type', 'Alert Date Time', 'Speed', 'videoURL', 'Remarks', 'Fleet', 'noise'),
    );
    // A=id, B=Vehicle, C=Driver, D=Alert Type, E=Alert Date Time, F=Speed, G=videoURL(skipped), H=Remarks, I=Fleet
    expect(select).toBe('A,B,C,D,E,F,H,I');
    expect(select).not.toContain('G'); // videoURL omitted
  });

  it('falls back to * when only the id column is present', () => {
    expect(buildAlertColumnSelect(cols('id'))).toBe('*');
  });

  it('includes Track Time / Location aliases used by OverSpeed', () => {
    const select = buildAlertColumnSelect(
      cols('SlNo', 'Plate', 'Track Time', 'Location', 'Over Speed', 'User'),
    );
    expect(select).toBe('A,B,C,D,E,F');
  });
});
