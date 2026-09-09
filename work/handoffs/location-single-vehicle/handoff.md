# Location dashboard: one vehicle and bounded loading

Active root: Codex. Model: GPT-6; effort: UNKNOWN. Reviewer: Claude; model and effort: use configured default, record UNKNOWN if unavailable.
Base: 6bf0c5bce69390ebb76548622366fe88bd216b4a.

Objective: Location Data v1 always shows one selected vehicle, fetches an aggregated vehicle catalogue then only that plate's rows (2,000 per page; older history on demand up to 25,000). Other dashboards retain MultiSelect behavior. Preserve sheet/fleet scoping, saved selection, cancellation, bounded cache and accurate loaded-history labeling.

Lane: read-only review. Read only these changed source paths and their immediate dependencies:
- app/dashboards/locationVehicleData.ts
- app/dashboards/locationVehicleFetch.ts and its test
- app/dashboards/useLocationVehicleData.ts
- app/dashboards/LocationDataV1Dashboard.tsx
- app/ui/MultiSelect.tsx
- app/api/sheets/[sheetId]/[gid]/route.ts
- app/e2e-fixtures/location-data-v1/E2eLocationDataV1Client.tsx
- e2e/location-vehicle-filter.spec.ts and e2e/fixtures/location-data.ts

Focus: vehicle queries actually constrain fetched rows; no full-fleet fallback; first selection/persistence and switching races; fleet scope determined from catalogue not selected rows; old data never shown under new plate; UI functional for 500 vehicles; per-page payload and memory bounded. Report only concrete defects with file/line and suggested fix, plus any important unverified claims.

Do not edit source, run git mutations, deploy, touch .env files, databases, or production configuration. Other tasks are concurrently modifying RawSimpleDashboard/simpleSummaryData and work/handoffs/simple-monthly-summary; those are out of scope. Root owns all implementation writes. Return review and provider/model/effort provenance to stdout; root records receipt.
