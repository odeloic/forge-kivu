# Projects Module Spec

## Decisions

1. **Projects owns the project space.** It owns `projects` and `project_items`. Other modules store a `projectId` and call this service — they never query the tables directly.
2. **A project belongs to one user.** `ownerId` fk → users.id. Every read and write in the service takes the caller's user id and matches it against `ownerId`. A miss returns not-found, never forbidden — existence is not leaked.
3. **Project fields are real columns, not a meta blob.** `name` and `projectType` are required; `clientName`, `location`, `description`, `startDate`, `endDate`, `workType`, `phase`, `budget` are nullable. The list is a living list: new needs become new columns via migration. No jsonb — a key-value blob loses typing and validation, the same reason the platform settings table is typed.
4. **Classification is three enums, not one mixed list.** `projectType` says what is being built and is required, with `other` as the catch-all. `workType` (nature of the work) and `phase` (construction stage — building in phases as money comes is the norm here) are optional: not every project has them. pgEnums extended by migration, not lookup tables — the list is a product decision, not admin data.
5. **Budget is one optional number in the platform currency.** It exists so the client can show where a BOQ total falls against it — over or under. The comparison is computed on read and never stored. BOQs do not freeze project fields (budget, phase, names): only catalogue data is frozen; document headers render live project data at export time.
6. **`project_items` is the live working list.** One row per variant per project (pk `projectId + variantId`) with a quantity. Items change freely at any time; nothing here is a document. Snapshots are the BOQ module's job.
7. **Items point at `product_variants`, not `products`.** Price and sku live on the variant in the catalogue.
8. **Adding an item requires a variant of a published product**, checked through the catalogue service. Draft and `not_available` products cannot enter a project — what is not publicly visible cannot be added.
9. **A variant cannot be deleted from the catalogue while it sits in a live project list.** The fk is `restrict`; the catalogue surfaces it as a conflict. No cascade deletes across module boundaries. The catalogue's `not_available` status (catalogue spec, decision 7) is the normal way to retire a product, which makes this conflict rare.
10. ~~**Quantity is an integer ≥ 1.** Variants are discrete sellable units; fractional amounts have no meaning here.~~
    **Quantity is `numeric(12,2)` ≥ 0.01.** Variants carry a unit of measure; 12.5 m² is a valid amount. See workshop-projects-views.md, Unit of measure.
11. **Deleting a project deletes its items and its BOQs.** Items cascade in-module; BOQ rows cascade at the database level (fk in the boq module). BOQs are snapshots of this project only — they have no life after it.

## Module layout

```
apps/api/src/modules/projects/
├── projects.tables.ts    projects, project_items
├── projects.schemas.ts   zod: create, update, setItem
├── projects.service.ts   all logic; the only interface other modules use
└── projects.routes.ts    thin Hono sub-app
```

## Tables

```
projects
├── id           uuid pk
├── ownerId      fk → users.id
├── name         text
├── projectType  enum: residential_house | apartment_building | commercial |
│                      industrial | institutional | other
├── workType     enum (nullable): new_construction | renovation | extension | repair
├── phase        enum (nullable): foundation | structure | roofing | finishing
├── clientName   text (nullable)
├── location     text (nullable)
├── description  text (nullable)
├── startDate    date (nullable)
├── endDate      date (nullable)
├── budget       numeric(12,2) (nullable)
├── createdAt
└── updatedAt

project_items
├── projectId    fk → projects.id (cascade)
├── variantId    fk → product_variants.id (restrict)
├── quantity     integer, ≥ 1
└── pk (projectId, variantId)
```

## Service surface

```
create(ownerId, data)                       → project
update(id, ownerId, patch)                  → project
list(ownerId)                               → project[]
getOwned(id, ownerId)                       → project + items | null
remove(id, ownerId)
setItem(id, ownerId, variantId, quantity)   → item        (upsert)
removeItem(id, ownerId, variantId)
listItems(id, ownerId)                      → item[] with variant + product data   (for boq)
```

## Routes

All routes require an authenticated user. No admin surface in v1.

```
POST   /projects
GET    /projects                          own projects only
GET    /projects/:id                      project + items
PATCH  /projects/:id
DELETE /projects/:id
PUT    /projects/:id/items/:variantId     body { quantity }, upsert
DELETE /projects/:id/items/:variantId
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Create, list, read, update, delete projects

Build: `projects` table (migration via `pnpm db:generate`), zod schemas, `create`, `list`, `getOwned`, `update`, `remove`, and the five project routes.

Acceptance criteria:
- A logged-in user creates a project via curl: 201, row in the database with their `ownerId`.
- Creating without `projectType`, or with a value outside any of the three enums, returns 400 from zod.
- A project with `budget` set returns it in reads; no computed comparison field exists in any response.
- `GET /projects` returns only the caller's projects; a second user sees an empty list.
- `GET /projects/:id` for another user's project returns 404; anonymous returns 401.
- `PATCH` with an empty `name` returns 400 from zod.
- `DELETE` removes the row.

### Step 2 — Manage items

Build: `project_items` table, `setItem`, `removeItem`, `listItems`, the two item routes, and the published-product check through the catalogue service.

Acceptance criteria:
- `PUT /projects/:id/items/:variantId` with `{ "quantity": 3 }` creates the row; repeating with `{ "quantity": 5 }` updates the same row, no duplicate.
- A variant of a draft product returns 400; an unknown variant returns 404.
- `quantity: 0` returns 400 from zod.
- `GET /projects/:id` now includes items with variant sku, price, product name, and product status, so the client can flag items retired after being added.
- Deleting the project removes its item rows.
- Deleting the variant from the catalogue while the item exists fails with a conflict (verified from the catalogue side).

## Test approach

Integration tests through `app.request()` with the `loginAs` helper, real Postgres test database, no mocks. Catalogue test helpers provide a published product with variants; two users verify ownership isolation.
