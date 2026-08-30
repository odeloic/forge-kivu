# Workshop Projects API Spec

Backend changes in the `projects` module required by the workshop UI. Extends `projects-module-spec.md`; every decision there still holds unless superseded below.

## Decisions

1. **`list` returns a summary row, not the bare table row.** The workshop overview and the projects list both show an item count per project; loading every project's items to count them is one query per row. Supersedes `projects-module-spec.md` service surface `list(ownerId) → project[]`.
2. **`list` takes a query object.** The projects list filters by `projectType` and `phase` and sorts by `updatedAt` or `createdAt`. Filtering client-side breaks once a user has more projects than one page.
3. **BOQ data on the list is composed in the route, not the service.** `boq.service` already imports `projects.service`; importing back would be a cycle. `projects.routes` calls `list()` and `boqSummaries()` (see `workshop-boq-api-spec.md`) and merges by `projectId`.
4. **`ProjectItem` carries `category`, `supplier` and `imageUrl`.** The products tab groups by category and supplier and shows a thumbnail per row. The values come from `VariantRef` (see `workshop-catalogue-api-spec.md`); this module passes them through and computes nothing.
5. **Phase completion is a table, not four date columns.** `project_phases` holds one row per completed phase. The phase enum grows by migration (`projects-module-spec.md` decision 4); a column per phase would mean a migration and a response change each time.
6. **`phase` on `projects` stays the current phase.** It is what the list and the status flag read. The new table is history, not a replacement.
7. **No new write endpoints for items.** The wizard saves one `PUT /projects/:id/items/:variantId` per variant. A batch endpoint is not required to build the UI. Deferred: a `PUT /projects/:id/items` replacement endpoint if the picker grows past a few dozen rows per save.
8. **The overview's "across N categories" figure is not backed.** Categories are only known per item, and the list does not load items. The client shows project and item counts only, or the figure is dropped.

## Tables

```
project_phases                          new
├── projectId    fk → projects.id (cascade)
├── phase        enum: foundation | structure | roofing | finishing
├── completedOn  date
└── pk (projectId, phase)
```

## Types

```
ProjectSummary = Project & {
  itemCount: number
}

ProjectItem = {
  variantId, quantity, sku, price, label,
  product:  { id, name, status },
  category: { id, name, slug },          new
  supplier: { id, name, slug },          new
  imageUrl: string | null,               new
}

ProjectDetail = Project & {
  items:  ProjectItem[],
  phases: { phase, completedOn }[],      new
}
```

## Service surface

```
list(ownerId, query)                        → projectSummary[]      changed
getOwned(id, ownerId)                       → projectDetail | null  changed
setPhaseCompletion(id, ownerId, phase, completedOn)                 new
clearPhaseCompletion(id, ownerId, phase)                            new
```

`query`: `{ projectType?, phase?, sort? }`, `sort` one of `updatedAt` (default) or `createdAt`, both descending.

## Routes

```
GET    /projects?projectType=&phase=&sort=       changed: query + itemCount + latest BOQ
GET    /projects/:id                             changed: items carry category, supplier, imageUrl; adds phases
PUT    /projects/:id/phases/:phase               new, body { completedOn }
DELETE /projects/:id/phases/:phase               new
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Item count and filters on the list

Build: `listQuerySchema` in `projects.schemas.ts`, `list(ownerId, query)` with a grouped count join on `project_items`, and the query wiring in `projects.routes.ts`.

Acceptance criteria:
- `GET /projects` returns each project with `itemCount`; a project with no items returns `0`, not a missing key.
- `GET /projects?projectType=commercial` returns only commercial projects; an unknown value returns 400 from zod.
- `GET /projects?phase=roofing` excludes projects with a null `phase`.
- `GET /projects?sort=createdAt` changes the order; `sort=name` returns 400.
- Counting is one query for the whole list — adding a tenth project does not add a tenth query.
- Another user's projects are still absent.

### Step 2 — Enriched project items

Build: `loadItems` reading `category`, `supplier` and `imageUrl` off the extended `VariantRef`, and the `ProjectItem` type change. Depends on step 1 of `workshop-catalogue-api-spec.md`.

Acceptance criteria:
- `GET /projects/:id` returns each item with `category.name`, `supplier.name` and `imageUrl`.
- A product with no media returns `imageUrl: null`, not a missing key or an empty string.
- An item whose product was set to `not_available` still returns, with `product.status` unchanged and category and supplier present.
- Item loading is still one `getVariantRefs` call for the whole list.

### Step 3 — Phase completion (can be deferred; nothing else depends on it)

Build: `project_phases` table (migration via `pnpm db:generate`), `setPhaseCompletion`, `clearPhaseCompletion`, the two routes, and `phases` on `ProjectDetail`.

Acceptance criteria:
- `PUT /projects/:id/phases/foundation` with `{ "completedOn": "2026-04-18" }` returns 200 and one row; repeating with a different date updates the same row.
- A phase outside the enum returns 400; an unowned project returns 404.
- `GET /projects/:id` returns `phases` ordered by the enum's declared order, not by `completedOn`.
- `DELETE /projects/:id/phases/foundation` removes the row; deleting again returns 404.
- Deleting the project removes its phase rows.

### Step 4 — Latest BOQ on the list

Build: composition in `projects.routes.ts` of `list()` with `boqSummaries()`. Depends on step 2 of `workshop-boq-api-spec.md`.

Acceptance criteria:
- `GET /projects` returns `latestBoq` per project: `{ revision, createdAt, lineCount, total, stale }`, or `null` for a project with no BOQ.
- Adding an item to a project flips its `latestBoq.stale` to `true` without generating a revision.
- `projects.service` still has no import from `../boq`.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper against the real Postgres test database, no mocks. Catalogue test helpers supply a published product with variants, a category and one media row. Two users cover ownership isolation on every new route.
