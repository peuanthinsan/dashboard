'use client';

import writeXlsxFile, { type Cell, type Columns, type SheetData } from 'write-excel-file';
import {
  GRADE_COLORS,
  VEHICLE_KPI_CATEGORIES,
  gradeForCount,
  type VehicleKpiFleetRow,
  type VehicleKpiRow,
} from 'app/dashboards/vehicleKpiUtils';

type ExportVehicleKpiXlsxArgs = {
  vehicleRows: VehicleKpiRow[];
  fleetRows: VehicleKpiFleetRow[];
  monthKeys: string[];
};

const headerCell = (value: string): Cell => ({
  value,
  type: String,
  fontWeight: 'bold',
  backgroundColor: '#1f2937',
  color: '#ffffff',
  align: 'center',
  wrap: true,
});

const textCell = (value: string): Cell => ({ value, type: String });

const gradeCell = (count: number): Cell => {
  const grade = gradeForCount(count);
  return {
    value: count,
    type: Number,
    backgroundColor: GRADE_COLORS[grade],
    color: '#ffffff',
    align: 'center',
  };
};

const byVehicleColumns: Columns = [
  { width: 18 },
  { width: 20 },
  ...VEHICLE_KPI_CATEGORIES.map(() => ({ width: 20 })),
];

const byFleetColumns: Columns = [
  { width: 22 },
  ...VEHICLE_KPI_CATEGORIES.map(() => ({ width: 20 })),
];

const legendColumns: Columns = [{ width: 24 }, { width: 58 }, { width: 18 }];

const categoryConditions: Record<(typeof VEHICLE_KPI_CATEGORIES)[number]['key'], string> = {
  speeding: 'Alert Type = "OverSpeed"',
  seatbelt: 'Alert Type = "No Seatbelt", "No Seat belt", "Seatbelt", or "Seat Belt"',
  harsh: 'Alert Type = "Harsh Brake" or "Harsh Acceleration"',
  phone: 'Remarks = "Mobile Phone"',
  forward: 'Alert Type = "Forward Collision-A2"',
};

const buildLegendData = (): SheetData => {
  const gradeBands = [
    { grade: 'A' as const, condition: '0 incidents' },
    { grade: 'B' as const, condition: '1–5 incidents' },
    { grade: 'C' as const, condition: '6–10 incidents' },
    { grade: 'D' as const, condition: '11–20 incidents' },
    { grade: 'F' as const, condition: '21+ incidents' },
  ];

  return [
    [{ value: 'VehicleKPI parameters', type: String, fontWeight: 'bold', span: 3 }],
    [headerCell('Parameter'), headerCell('Condition'), headerCell('Source')],
    ...VEHICLE_KPI_CATEGORIES.map((category) => [
      textCell(category.label),
      textCell(categoryConditions[category.key]),
      textCell(category.remarks ? 'Remarks' : 'Alert Type'),
    ]),
    [],
    [{ value: 'Grade bands', type: String, fontWeight: 'bold', span: 3 }],
    [headerCell('Grade'), headerCell('Incident count'), headerCell('Color')],
    ...gradeBands.map(({ grade, condition }) => [
      {
        value: grade,
        type: String,
        fontWeight: 'bold' as const,
        backgroundColor: GRADE_COLORS[grade],
        color: '#ffffff',
        align: 'center' as const,
      },
      textCell(condition),
      {
        value: GRADE_COLORS[grade],
        type: String,
        backgroundColor: GRADE_COLORS[grade],
        color: '#ffffff',
        align: 'center' as const,
      },
    ]),
  ];
};

/** Downloads a formatted three-sheet workbook so the on-screen grades remain auditable offline. */
export async function exportVehicleKpiXlsx({
  vehicleRows,
  fleetRows,
  monthKeys,
}: ExportVehicleKpiXlsxArgs): Promise<void> {
  const byVehicleData: SheetData = [
    [headerCell('Vehicle'), headerCell('Fleet'), ...VEHICLE_KPI_CATEGORIES.map((category) => headerCell(category.label))],
    ...vehicleRows.map((row) => [
      textCell(row.vehicle),
      textCell(row.fleet || '—'),
      ...VEHICLE_KPI_CATEGORIES.map((category) => gradeCell(row.counts[category.key])),
    ]),
  ];

  const byFleetData: SheetData = [
    [headerCell('Fleet'), ...VEHICLE_KPI_CATEGORIES.map((category) => headerCell(category.label))],
    ...fleetRows.map((row) => [
      textCell(row.fleet),
      ...VEHICLE_KPI_CATEGORIES.map((category) => gradeCell(row.counts[category.key])),
    ]),
  ];

  const legendData = buildLegendData();
  const fileName = `DHL_VehicleKPI_${monthKeys.slice().sort().join('_') || 'all'}.xlsx`;

  await writeXlsxFile([byVehicleData, byFleetData, legendData], {
    sheets: ['By Vehicle', 'By Fleet', 'Legend'],
    columns: [byVehicleColumns, byFleetColumns, legendColumns],
    fileName,
  });
}
