# BOQ Module Spec

BOQ (bill of quantities: the itemized list of products and prices for a construction project, handed to clients and contractors). The name is provisional; a rename is parked and touches only labels, not shape.

## Decisions

1. **A BOQ is an immutable snapshot of a project's items at generation time.** It is created in one shot and never updated. Prices and products in the catalogue change over time; a document handed to a client must not change under their feet.
2. **"Multiple BOQs" and "revisions" are the same thing.** One `boqs` table with a `revision` integer, unique per project, assigned sequentially. Change the project, generate again, get the next revision.
3. **Lines freeze their data.** `boq_items` copies product name, sku, unit price, and quantity at generation. Reading a BOQ never touches the catalogue.
4. **Lines are catalogue-only — no manual edits, no custom lines.** Users who need extra rows (labor, transport, discounts) add them in the exported file. This keeps the snapshot pure: no ownership of products that do not exist in our schema.
5. **No stored totals and no per-BOQ currency.** Frozen line prices make the total deterministic, so it is computed on read. Currency comes from the settings service at export time.
6. **No status column.** A BOQ is final from birth; the draft state is the live project items. `createdAt` doubles as the generation timestamp.
7. **Generation fails when the project has no items, any variant has no price, or any product is no longer `published`.** The error lists the offending items. A client-facing document with blank prices or retired products is not a document. The UI should keep users from reaching this state; the API check is the guard.
8. **`variantId` is set at generation, but survives catalogue deletes as null.** fk `set null`: the frozen line keeps its data, only the link is lost. `restrict` would let old snapshots block catalogue management forever.
9. **Export is an endpoint, not state.** Formats in v1: `xlsx` and `csv`. csv is the flat item rows; xlsx adds a header block (project name, client, revision, date, currency) and a total row.
10. **A BOQ dies with its project.** `projectId` fk cascades at the database level. No standalone delete route: revisions are a record of documents that may already be in someone's hands, and an unwanted revision costs nothing — the next generation supersedes it.

## Module layout

```
apps/api/src/modules/boq/
├── boq.tables.ts    boqs, boq_items
├── boq.schemas.ts   zod: generate, export query
├── boq.service.ts   generation, reads, export builders
└── boq.routes.ts    thin Hono sub-app
```

## Tables

```
boqs
├── id          uuid pk
├── projectId   fk → projects.id (cascade)
├── revision    integer
├── createdAt
└── unique (projectId, revision)

boq_items
├── id          uuid pk
├── boqId       fk → boqs.id (cascade)
├── variantId   fk → product_variants.id (set null, nullable)
├── name        text                      product name + variant label
├── sku         text (nullable)
├── unitPrice   numeric(12,2)
├── quantity    integer
└── sortOrder   integer
```

## Service surface

```
generate(projectId, ownerId)        → boq + items    next revision, in one transaction
listForProject(projectId, ownerId)  → boq[]          revisions, newest first
getOwned(id, ownerId)               → boq + items + computed total | null
buildExport(id, ownerId, format)    → file buffer + filename    'xlsx' | 'csv'
```

Data flow at generation: `boq.service → projects.service.listItems` (which resolves variant price, sku, and product name). Ownership checks ride on the project's owner; a miss returns not-found.

## Routes

All routes require an authenticated user.

```
POST   /projects/:projectId/boqs      generate next revision
GET    /projects/:projectId/boqs      list revisions
GET    /boqs/:id                      boq + items + total
GET    /boqs/:id/export?format=xlsx   file download; format 'xlsx' | 'csv'
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next. Depends on the projects module (steps 1–2) and the settings module (step 1) being in place.

### Step 1 — Generate and read

Build: `boqs` and `boq_items` tables (migration via `pnpm db:generate`), `generate`, `listForProject`, `getOwned`, and the first three routes.

Acceptance criteria:
- `POST /projects/:projectId/boqs` on a project with items returns 201 with revision 1; posting again returns revision 2.
- The frozen `unitPrice` in the response stays the same after the catalogue variant's price changes; the project's live items reflect the new price.
- Generating on a project with no items returns 422; with an unpriced variant returns 422 naming the variant.
- Generating while an item's product is `not_available` returns 422 naming the item.
- Another user's project returns 404 on generate, list, and read; anonymous returns 401.
- Two concurrent generate calls on one project produce two distinct revisions, no unique-constraint error surfacing to the caller.

### Step 2 — Export

Build: `buildExport` for csv and xlsx, the export route, currency read from the settings service.

Acceptance criteria:
- `GET /boqs/:id/export?format=csv` downloads a csv whose rows match `boq_items` exactly.
- `format=xlsx` downloads a sheet with the header block, item rows, and a total row equal to the sum of `unitPrice × quantity`; the currency matches `platform_settings`.
- `format=pdf` returns 400 from zod.
- Deleting the project then requesting the export returns 404.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper, real Postgres test database, no mocks. Fixtures build a project with priced variants through the projects and catalogue helpers; the xlsx assertion parses the buffer back instead of snapshotting bytes.
