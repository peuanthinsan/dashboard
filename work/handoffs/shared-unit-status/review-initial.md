## Review: Shared UnitStatus (frozen patch)

**Scope reviewed:** the 10 files in `source-manifest.txt`, plus `unitDeviceStatus.ts` and `googleSheetParse.ts` as evidence. Read-only; no edits made.

---

### 1. [HIGH] `readUnitHealth` substring matching misclassifies negated status words
`app/dashboards/unitStatusData.ts:28-36`

The online/offline keyword lists are matched with plain `String.includes` (substring, no word boundaries). Several short healthy tokens (`ok`, `work`, `active`, `ready`) are substrings of common **negative** status words, and the offline list has no matching negation entries, so the offline branch never fires first:

- `"Inactive"` → contains `active` → returns **`online`** (should be offline/unknown — a device explicitly marked inactive is being shown as healthy).
- `"No Network"` → contains `work` (inside "net**work**") → returns **`online`**; the offline branch never matches "no network" (only `'no signal'` is listed, and the exact-match list only catches the whole string `'no'`).
- `"Not Ready"` → contains `ready` → returns **`online`**.
- `"Broken"` → contains `ok` (br**ok**en) → returns **`online`**.

The inverse also happens: `"No Damage"` (a healthy reading) contains the offline word `damage` → returns **`offline`**, which would flip a fine unit into the damage matrix / "Needs attention" KPI as a false failure.

This directly contradicts the stated "failure wins" design and the unknown-vs-failed intent. The existing adversarial tests (`'online but no signal'`, `'ready / error'`, `'normal with damage'`, `'✔ ✖'`) exercise *mixed-signal* strings but never a bare negation, which is why this shipped.

**Validation:** `readUnitHealth('Inactive')`, `readUnitHealth('No Network')`, `readUnitHealth('Not Ready')`, `readUnitHealth('Broken')` all currently return `'online'`; `readUnitHealth('No Damage')` returns `'offline'`. None match intent. Fix direction: match whole normalized tokens/word-boundaries (e.g. split on non-alphanumerics, or `\bok\b`-style regex) instead of raw substring containment, and re-run against BIGTH's actual vocabulary before shipping.

### 2. [MEDIUM] `type` field silently falls back to a health-status column
`app/dashboards/unitStatusData.ts:231`

```
type: readText(row, ['Type', 'Device Type', 'devicetype', 'Status Type']) || readText(row, ['Device Status']),
```

When a source sheet has no `Type`/`Device Type`/`Status Type` header, `unit.type` reads the **`Device Status`** health value instead. This value feeds the "Type" multiselect filter and the Report detail label, so a customer sheet lacking a type column would show filterable "types" like `online`/`offline`/`-` mislabeled as vehicle type — not called out anywhere in the documented intentional semantics.

**Validation:** `buildUnitRows([sourceRow({ 'Device Status': 'online' })], …)` → `unit.type === 'online'`.

### 3. [LOW-MEDIUM] `CameraSetup` flags a correctly-provisioned zero-camera unit as needing attention
`app/dashboards/UnitStatusDashboard.tsx:118-122`

```
const complete = row.expectedCameras > 0 && row.activeCameras >= row.expectedCameras;
```

A unit whose CH-configured `expectedCameras` is a genuine `0` (unit tests confirm `0` is preserved, not coerced to unknown) always renders the amber "needs attention" badge as `0/0`, even though zero-of-zero is a fully complete configuration. Should be `row.activeCameras >= row.expectedCameras` (or explicit `0/0 → success`).

**Validation:** render `CameraSetup` with `{ expectedCameras: 0, activeCameras: 0 }` → renders `badgeWarning`, not `badgeSuccess`.

### 4. [INFORMATIONAL — confirm with stakeholders, not a code defect] Legacy ALCHEM/VINYTHAI dashboards get a different health model
`docs/METRICS.md:104-131`, `app/dashboard/[id]/page.tsx:129-137`

Every legacy alias (BIGTH, ALCHEM, VINYTHAI, Vehicle) now routes to the one shared `UnitStatusDashboard`, replacing ALCHEM/VINYTHAI's prior dot-grid model — including the 30-minute forced-offline propagation to individual device dots (§0.5) — with the BIGTH checklist model, which has no such propagation (only a separate freshness badge). This matches the frozen scope ("one UnitStatus for all companies") and is explicitly documented as intentional/historical, but it is a live visual and semantic change for existing customer dashboards with no per-customer opt-out in this patch. Worth an explicit go/no-go before shipping, independent of code correctness.

### 5. [LOW, nit] Redundant GViz payload parse every refresh
`app/dashboards/useUnitStatusSheet.ts:36-39`

The error-envelope check re-implements the same `setResponse(...)` regex match + `JSON.parse` that `parseGoogleSheetGvizText` performs again immediately after on the same `payload`. Not a correctness issue, just duplicate parsing on every 60s auto-refresh × 2 sheets (primary + CH). Optional cleanup.

---

### Confirmed correct (spot-checked against stated intentional semantics)
- Company/fleet isolation ordering (`buildUnitRows`): fleet-scope drop happens before any unit is constructed; blank/mismatched Fleet always excludes under a configured scope; exact comma-token company membership; CH ambiguity across fleets left unresolved (no guessing) — all match their dedicated tests.
- Camera wiring: only literal named channels (`CH1 AI`, `Front`, `Front BSD`, `Rear Right`, `Rear Left`, `Left BSD`, `Right BSD`, `Cabin`) are inferred from recording/loss lists; numeric/`AI`/`Driver`/`Reverse 1` channels stay `unknown` — matches "camera wiring unverified."
- `activeCameras` counts exactly `ch1Ai, front, rearRight, rearLeft, cabin` per the handoff.
- Explicit status columns take precedence over recording/loss telemetry (`hasAliasedColumn` gate) — matches "explicit status columns take precedence."
- Intercom unconditionally forced `online` after the per-row loop, independent of company/GPS/age — matches requirement and its test.
- 30-minute freshness (`isUnitApiUpdateStale`) is a separate `updateStatus`, never overrides `statuses.*` — no BIGTH age override, confirmed.
- `resolveTemplateForSave` correctly preserves a legacy BIGTH dashboard's named `Unitstatus` source on ordinary edits (name/notes/company changes) and only resets to the canonical GID when the sheet link itself changes; this is the only write path that touches `template`, so no other bulk-admin action can silently drop legacy source mode.
- CH-sheet failure is isolated to the installation/camera-setup UI and does not gate the primary table (`invalidSource`/`loading`/`error` checks only use the primary sheet's `error`).

No git, network, database, or agent-delegation actions were taken during this review.