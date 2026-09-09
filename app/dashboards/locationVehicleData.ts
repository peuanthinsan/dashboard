import type { GoogleSheetColumn, GoogleSheetRow } from './googleSheetParse';
import { normalizeLabel } from './dashboardDataUtils';

export const LOCATION_PAGE_SIZE = 2_000;
export const LOCATION_MAX_RECORDS = 25_000;
export const LOCATION_FLEET_FIELDS = ['Fleet', 'Fleet Name', 'Organization', 'Organization Name'];

export type LocationVehicleCatalog = {
  vehicles: Array<{ vehicleNo: string; fleets: string[] }>;
  hasFleetColumn: boolean;
  hasUnidentifiedVehicles: boolean;
};

export type LocationVehiclePage = {
  columns: GoogleSheetColumn[];
  rows: GoogleSheetRow[];
  vehicle: string;
  offset: number;
  hasMore: boolean;
  lastUpdated: number;
};

export function scopedLocationVehicles(catalog: LocationVehicleCatalog, scopes: string[]) {
  const scopeSet = new Set(scopes.map(normalizeLabel).filter(Boolean));
  if (scopeSet.size > 0 && !catalog.hasFleetColumn) {
    // Decide this from the whole-sheet catalogue, never from one vehicle's rows.
    if (catalog.vehicles.length !== 1 || catalog.hasUnidentifiedVehicles) {
      throw new Error('This fleet-scoped dashboard has multiple or unidentified vehicles, but the sheet has no Fleet or Organization column.');
    }
  }
  return catalog.vehicles
    .filter((vehicle) => !scopeSet.size || !catalog.hasFleetColumn || vehicle.fleets.some((fleet) => scopeSet.has(normalizeLabel(fleet))))
    .map((vehicle) => vehicle.vehicleNo)
    .sort((a, b) => a.localeCompare(b));
}
