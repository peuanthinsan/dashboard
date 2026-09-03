# Location Data v1 dashboard design

## Source and intent

- Source shape: minute-by-minute GPS telemetry with vehicle, track/update time, latitude, longitude, address, speed, ignition, driver, GPS status, polling mode, face ID, and fuelbar.
- Audience: fleet operators reviewing a vehicle's movement and the source trail behind it.
- Primary task: understand the route, movement profile, current filter scope, and exact source records without leaving the dashboard.
- Desktop concept: `2026-09-03-location-data-v1-desktop.png`
- Mobile concept: `2026-09-03-location-data-v1-mobile.png`

## Screen inventory

1. Existing `DashboardShell` with breadcrumb, title, source freshness, current-view audit state, refresh, export, print, and admin source actions.
2. Four filter-aware metrics: approximate GPS distance, estimated moving time, maximum speed, and record count.
3. Google Maps route overview plotted from source coordinates, with speed-colored segments, point selection, and coordinate links.
4. Speed and ignition timeline for exactly one identified vehicle from the filtered record set. A multi-vehicle view shows a vehicle selector instead of overlaying incomparable traces.
5. Search, date/time, vehicle, driver, ignition, GPS, and polling-mode filters.
6. Sortable, paginated source-history table with wrapped Thai addresses and map actions.

## Design system

- Preserve the existing Songdee red, true white/zinc surfaces, dark mode, Geist typography, tokenized radii, borders, and shadows.
- Container model: the shared dashboard header, a flat KPI row, two equal operational panels, one filter rail, and one table surface. Avoid additional nested cards.
- Semantic accents: red for route emphasis/high speed, green for motion, amber for ignition, blue for GPS, and zinc for neutral states.
- Desktop: four KPI columns and two equal chart columns. Mobile: two KPI columns, single-column charts, wrapped filters, and a horizontally scrollable table.
- All labels, controls, tables, overlays, and charts remain code-native. The map uses Google Maps JavaScript API tiles and ships no dashboard bitmap asset.

## Data assumptions

- `Track Time` follows the repository's Bangkok wall-clock parser.
- `Speed` is displayed as km/h, matching the existing GPS dashboard convention.
- Distance is an estimate from sequential same-vehicle WGS84 points. Gaps over 30 minutes and jumps implying more than 200 km/h (plus a small GPS tolerance) are excluded.
- Moving and ignition-on durations sum valid intervals from the earlier sample's state.
- Filters never bridge hidden samples: a removed point, vehicle boundary, outage, invalid coordinate, or implausible jump starts a new map/timeline segment.
- The route uses Google Maps JavaScript API via `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`; the key must remain browser-restricted and be configured in each deployed environment.
- V1 intentionally loads the most recent 25,000 source rows. The history copy states this limit, and export is labeled as the filtered dashboard view rather than a full-tab export.
- A recognized `Fleet`/`Organization` column is enforced when present. A fleet-scoped sheet without one is accepted only when it contains exactly one identified vehicle; ambiguous multi-vehicle sources fail closed.

## Allowed first-view copy

`Location Data v1`, `Location tracking dashboard`, `Approx. distance`, `Estimated moving time`, `Maximum speed`, `Location records`, `Route overview`, `Speed & ignition timeline`, `Location filters`, and `Location history` (plus the shared `DashboardShell` labels and configured dashboard notes).

## Final fidelity and QA ledger

| Comparison point | Concept target | Verified implementation | Result |
| --- | --- | --- | --- |
| Information hierarchy | Title/status, four KPIs, route + telemetry, filters, history | Same hierarchy, inside the existing richer `DashboardShell` audit header | Faithful; shared product chrome intentionally retained |
| KPI grid | Four across desktop, two across mobile | Four at desktop and two at 390 px | Faithful |
| Route surface | Coordinate route with speed colors and selected point | Live Google Maps with green/amber/red segments, sampled clickable markers, start/end/selected states, and outbound coordinate link | Improved per client follow-up; stylized concept basemap intentionally replaced |
| Telemetry | Speed line plus ignition periods | Responsive SVG timeline for one explicitly labeled vehicle, with discontinuity-safe segments and multi-day date ticks; multi-vehicle views require a vehicle selection | Faithful, with an explicit scope guard to prevent a misleading fleet overlay |
| Filters and history | Compact filtering plus an operator-readable audit trail | Persisted search/date/vehicle/driver/ignition/GPS/polling filters and a sortable, 10-row paginated, horizontally scrollable table | Faithful to product table conventions; mobile remains an audit table rather than concept cards |
| Theme and tokens | Light Songdee surfaces with red/green/amber/blue semantics | Existing light and dark themes both verified; typography, borders, radii, focus states, and semantic colors use project tokens | Faithful |
| Responsive behavior | No clipped controls at phone width | Verified at native 1440 × 1000 and 390 × 844 viewports; controls wrap and the dense table scrolls horizontally | Pass |
| First-view copy | Direct operational labels | `Distance travelled` / `Moving time` became `Approx. distance` / `Estimated moving time` to disclose calculation semantics; shared shell status text and `Open in Google Maps` were added | Intentional copy diff; no accidental first-view copy |

Verification used the local `/e2e-fixtures/location-data-v1` route through browser control with 596 synthetic telemetry rows. Full-page screenshots were captured at both viewports, and both accepted concept images plus the latest desktop/mobile implementations were visually inspected together. No material fidelity mismatch remains.
