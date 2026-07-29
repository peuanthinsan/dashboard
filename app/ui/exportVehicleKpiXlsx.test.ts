import { beforeEach, describe, expect, it, vi } from 'vitest';

const xlsxMocks = vi.hoisted(() => ({
  toFile: vi.fn(),
  write: vi.fn(),
}));

vi.mock('write-excel-file/browser', () => ({
  default: xlsxMocks.write,
}));

import { exportVehicleKpiXlsx } from './exportVehicleKpiXlsx';

const counts = {
  speeding: 1,
  seatbelt: 2,
  harsh: 3,
  phone: 4,
  forward: 5,
};

describe('exportVehicleKpiXlsx', () => {
  beforeEach(() => {
    xlsxMocks.toFile.mockReset().mockResolvedValue(undefined);
    xlsxMocks.write.mockReset().mockReturnValue({ toFile: xlsxMocks.toFile });
  });

  it('uses the v4 multi-sheet browser API and downloads the expected workbook', async () => {
    await exportVehicleKpiXlsx({
      vehicleRows: [{ vehicle: 'Truck 1', fleet: 'North', counts }],
      fleetRows: [{ fleet: 'North', counts }],
      monthKeys: ['2026-07', '2026-06'],
    });

    expect(xlsxMocks.write).toHaveBeenCalledOnce();
    const [sheets] = xlsxMocks.write.mock.calls[0];

    expect(sheets.map((sheet: { sheet: string }) => sheet.sheet)).toEqual([
      'By Vehicle',
      'By Fleet',
      'Legend',
    ]);
    expect(sheets[0].data[0][0]).toMatchObject({
      value: 'Vehicle',
      textColor: '#ffffff',
    });
    expect(sheets[2].data[0][0]).toMatchObject({
      columnSpan: 3,
    });
    expect(xlsxMocks.toFile).toHaveBeenCalledWith(
      'DHL_VehicleKPI_2026-06_2026-07.xlsx',
    );
  });
});
