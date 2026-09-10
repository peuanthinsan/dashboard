import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from './db';
import { unitCameraObservations } from './db-schema';
import type { UnitCameraHistory, UnitRow } from './dashboards/unitStatusData';

export function cameraHistorySourceKey(companyId: number, sheetId: string, selector: string, organizationIds: number[] = []): string {
  return createHash('sha256').update(JSON.stringify([companyId, sheetId, selector, Array.from(new Set(organizationIds)).sort((a, b) => a - b)])).digest('hex');
}

/** One row per camera makes concurrent observations a union, never a replacement. */
export async function rememberUnitCameras(sourceKey: string, units: UnitRow[], database: Pick<typeof db, 'insert' | 'select'> = db): Promise<UnitCameraHistory> {
  const observations = new Map(units.flatMap((unit) => unit.cameraObservations.map((camera) => [
    `${unit.cameraHistoryKey}:${camera.key}`, {
      sourceKey, vehicleKey: unit.cameraHistoryKey, cameraKey: camera.key, label: camera.label,
      firstSeen: new Date(camera.lastSeen), lastSeen: new Date(camera.lastSeen),
    },
  ] as const)));
  const values = Array.from(observations.values());
  // Bound SQL parameters for larger fleets without losing atomic per-camera union.
  for (let offset = 0; offset < values.length; offset += 500) {
    await database.insert(unitCameraObservations).values(values.slice(offset, offset + 500))
      .onConflictDoUpdate({
        target: [unitCameraObservations.sourceKey, unitCameraObservations.vehicleKey, unitCameraObservations.cameraKey],
        set: {
          firstSeen: sql`least(${unitCameraObservations.firstSeen}, excluded."firstSeen")`,
          lastSeen: sql`greatest(${unitCameraObservations.lastSeen}, excluded."lastSeen")`,
          label: sql`case when excluded."lastSeen" >= ${unitCameraObservations.lastSeen} and excluded."label" <> '' then excluded."label" else ${unitCameraObservations.label} end`,
        },
        // Re-reading the same GViz snapshot should not rewrite every camera row.
        setWhere: sql`excluded."lastSeen" > ${unitCameraObservations.lastSeen} or excluded."firstSeen" < ${unitCameraObservations.firstSeen}
          or (excluded."lastSeen" = ${unitCameraObservations.lastSeen} and ${unitCameraObservations.label} = '' and excluded."label" <> '')`,
      });
  }
  const vehicleKeys = Array.from(new Set(units.map((unit) => unit.cameraHistoryKey)));
  const history: UnitCameraHistory = Object.fromEntries(vehicleKeys.map((key) => [key, []]));
  for (let offset = 0; offset < vehicleKeys.length; offset += 500) {
    const rows = await database.select().from(unitCameraObservations).where(and(
      eq(unitCameraObservations.sourceKey, sourceKey), inArray(unitCameraObservations.vehicleKey, vehicleKeys.slice(offset, offset + 500)),
    ));
    for (const row of rows) history[row.vehicleKey].push({ key: row.cameraKey, label: row.label, lastSeen: row.lastSeen.toISOString() });
  }
  return history;
}
