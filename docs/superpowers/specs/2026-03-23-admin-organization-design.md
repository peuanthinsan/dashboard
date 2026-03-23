# Admin Organization Design

Comprehensive reorganization of the admin area: navigation, visual layout, workflow, and list management for companies, fleets, users, and dashboards.

## Goals

1. **Navigation & structure** — Clear groupings, hierarchy, and easy movement between entities
2. **Visual layout** — Consistent sections, clear hierarchy, predictable layout across all admin pages
3. **Workflow** — Guide admins through a logical sequence: Company → Fleets → Dashboards → User access
4. **List management** — Pagination and search for medium-scale lists (especially dashboards)

## Scale Assumptions

- **Dashboards**: Most numerous (highest priority for pagination/search)
- **Users**: Medium count
- **Companies, Fleets**: Smaller counts
- No virtualization needed; pagination + search sufficient

---

## 1. Navigation & Structure

### 1.1 Grouped Navigation

Replace the flat list of 5 links with a **workflow-ordered, grouped nav**:

```
SETUP (order of operations)
├── Companies      — Create company profiles first
├── Fleets         — Add fleets under companies
└── Dashboards     — Link dashboards to companies/fleets

ACCESS
└── Users          — Assign users to companies and fleets

TOOLS
├── Overview       — Admin home
└── Quick setup    — One-flow onboarding
```

**Implementation**:
- Update `AdminNav.tsx` to render two groups: "Setup" and "Access"
- Add a third group or inline link for "Quick setup" in Tools
- Use subtle group labels (uppercase, muted) above each group
- Order links within groups by workflow: Companies → Fleets → Dashboards → Users

### 1.2 Overview Page Restructure

The admin overview (`/admin`) currently shows 4 stat cards + 4 section links in a flat grid.

**New layout**:
- **Top**: 4 stat cards (unchanged) — Companies, Fleets, Users, Dashboards
- **Setup flow**: Visual "stepper" or numbered cards in order: 1. Companies → 2. Fleets → 3. Dashboards
- **Access**: Users card, clearly labeled as "Assign access after setup"
- **Quick setup**: Prominent CTA for new-customer onboarding

### 1.3 Breadcrumbs

Add breadcrumbs to sub-pages for context:
- `/admin/companies` → Admin > Companies
- `/admin/organizations` → Admin > Fleets
- `/admin/dashboards` → Admin > Dashboards
- `/admin/users` → Admin > Users

Use existing back link pattern; optionally add a breadcrumb trail in the page header.

---

## 2. Visual Layout

### 2.1 Page Structure Template

Every entity page (Companies, Fleets, Users, Dashboards) follows the same structure:

```
┌─────────────────────────────────────────────────────────┐
│ [Breadcrumb: Admin > Companies]                          │
│                                                          │
│ EYEBROW (uppercase, muted)                               │
│ Page Title                                               │
│ Short description                                        │
│                                                          │
│ [Jump nav: Overview | Companies | Fleets | …]            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ STAT CARDS (2–4 cards, consistent sizing)                │
│ [Total X] [Secondary metric] [Tips/Workflow]             │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SECTION: Bulk create (collapsible)                       │
│ One company name per line… [Bulk create] [Hide]          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SECTION: Manage [Create entity]                          │
│                                                          │
│ [Search_______________] [Filter▼] [Pagination < 1 2 3 >] │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Table with sticky header, consistent column widths   │ │
│ │ ☐ | Name | … | Actions                              │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Consistent Table Patterns

- **Sticky header**: Table header stays visible when scrolling (already in place)
- **Checkbox column**: First column for bulk selection (all pages that support bulk actions)
- **Actions column**: Right-aligned, consistent "Edit" button style
- **Max height**: `max-h-[32rem]` with overflow-auto for table body
- **Empty state**: Centered message when no rows

### 2.3 Section Ordering

On each page, sections appear in this order:
1. Stat cards
2. Bulk create (collapsible, collapsed by default if list has items)
3. Manage (table + filters + pagination)

### 2.4 Modal Consistency

- Create modal: Same structure across entities (title, description, form fields, submit)
- Edit modal: Same structure (inline edit, save, delete)
- Use `AdminModal` component everywhere; ensure consistent padding and button placement

---

## 3. Workflow Guidance

### 3.1 Setup Order Messaging

Add subtle hints on each page that reinforce the workflow:

- **Companies**: "Create companies first. Fleets and dashboards are assigned to companies."
- **Fleets**: "Add fleets under companies to group dashboards by team or region."
- **Dashboards**: "Link dashboards to a company and optional fleet. Assign users last."
- **Users**: "Assign users to companies and fleets to grant dashboard access."

### 3.2 Quick Setup Flow

Keep the existing Quick setup wizard. Add a link from the Overview: "New customer? Start here."

### 3.3 Cross-Links

When creating/editing:
- Dashboard form: "No company? Create one" link to `/admin/companies`
- User form: "No fleets? Add fleets" link to `/admin/organizations`

---

## 4. List Management

### 4.1 Dashboards (server-side pagination + search)

- **Pagination**: 25 per page (configurable via constant)
- **Search**: By name, company name, or fleet name (server-side)
- **Filter**: Optional dropdown to filter by company or fleet
- **API**: New server action or route that accepts `page`, `limit`, `search`, `companyId`, `organizationId`
- **DB**: Add `LIMIT/OFFSET` or cursor-based pagination to `getDashboards`; add search predicate

### 4.2 Users (server-side pagination + search)

- **Pagination**: 25 per page
- **Search**: By email (server-side)
- **Filter**: Optional filter by company or role (admin/standard)
- **API**: Extend or add paginated `getUsers` with search/filter params

### 4.3 Companies (client-side search, optional pagination)

- **Search**: Client-side filter by name (simplest; list is smaller)
- **Pagination**: Optional; if > 50 companies, add client-side "show 25/50/all" or simple prev/next

### 4.4 Fleets (client-side search, optional pagination)

- **Search**: Client-side filter by name or company name
- **Pagination**: Same as companies; add if list grows

### 4.5 Shared Search/Filter UI

Create reusable components:
- `AdminSearchInput` — Debounced text input, placeholder "Search…"
- `AdminPagination` — Prev/Next + page numbers (e.g. `< 1 2 3 … 10 >`)
- `AdminFilterSelect` — Optional dropdown for company/fleet filter

---

## 5. Implementation Phases

### Phase 1: Navigation & Overview ✅
- [x] Group AdminNav into Setup / Access / Tools
- [x] Restructure admin overview page with workflow-oriented layout
- [x] Add breadcrumbs or consistent back-link pattern

### Phase 2: Visual Consistency ✅
- [x] Audit all entity pages for consistent section order
- [x] Ensure table patterns match (sticky header, checkbox, actions)
- [x] Add workflow hints to each page

### Phase 3: List Management — Dashboards ✅
- [x] Add paginated `getDashboards` with search
- [x] Add search input and pagination to DashboardsClient
- [x] Add optional company/fleet filter

### Phase 4: List Management — Users ✅
- [x] Add paginated `getUsers` with search
- [x] Add search input and pagination to UsersClient

### Phase 5: List Management — Companies & Fleets ✅
- [x] Add client-side search to CompaniesClient
- [x] Add client-side search to OrganizationsClient
- [ ] Add pagination if lists exceed threshold (e.g. 50) — deferred

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `app/admin/AdminNav.tsx` | Grouped nav, workflow order |
| `app/admin/page.tsx` | Restructured overview, workflow stepper |
| `app/admin/AdminShell.tsx` | Optional breadcrumb slot |
| `app/admin/dashboards/page.tsx` | Paginated data fetch, search params |
| `app/admin/dashboards/DashboardsClient.tsx` | Search, pagination, filter UI |
| `app/admin/users/page.tsx` | Paginated data fetch |
| `app/admin/users/UsersClient.tsx` | Search, pagination UI |
| `app/admin/companies/CompaniesClient.tsx` | Client-side search |
| `app/admin/organizations/OrganizationsClient.tsx` | Client-side search |
| `app/db.ts` | `getDashboards`, `getUsers` with pagination/search |
| `app/admin/admin-ui.ts` | New `AdminSearchInput`, `AdminPagination` |
| `app/admin/i18n-copy.ts` | New copy for workflow hints, search placeholders |

---

## 7. Out of Scope

- Virtualization (not needed for small–medium scale)
- Searchable/combobox dropdowns for company/fleet in modals (keep native select for now)
- Export/import of lists
- Advanced filters (date range, multi-select) beyond company/fleet
