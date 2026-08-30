# Workshop BOQ API Spec

Backend changes in the `boq` module required by the workshop UI. Extends `boq-module-spec.md`; every decision there still holds unless superseded below.

## Decisions

1. **`listForProject` returns a summary, not the bare table row.** The revisions list shows a line count and a total on every row. Today it returns `{ id, projectId, revision, createdAt }`, so the client would have to fetch every revision in full to render the list. Supersedes the `Boq[]` return in `boq-module-spec.md`.
2. **`total` is recomputed from the stored lines, not cached on `boqs`.** `totalOf` already exists and the lines are immutable, so a stored column could only ever disagree with them.
3. **`boqSummaries(projectIds)` returns the latest revision per project.** The workshop overview and the projects list show BOQ state per project; one query for the whole page beats one request per project. `projects.routes` composes it (`workshop-projects-api-spec.md` decision 3).
4. **Staleness is computed, not stored.** A revision is stale when the project's current items no longer match the lines it froze — compared on `(variantId, quantity, unitPrice)` as a set. Storing a flag would need every item write to touch the boq module, which reverses the module dependency.
5. **A line reports its product's current status.** The revision itself never changes (`boq-module-spec.md`), but the UI marks lines whose product has since been withdrawn or deleted. `current` is resolved at read time and is `null` when `variantId` is null.
6. **Generation stays all-or-nothing.** `freezeItems` already throws `BOQ_NOT_GENERATABLE` when any item's product is not `PUBLISHED` or its price is null. The UI blocks the action from the project detail it already has; no pre-flight endpoint is added.
7. **No new export formats.** `xlsx` and `csv` cover the design.

## Types

```
BoqSummary = {
  id, projectId, revision, createdAt,
  lineCount: number,                       new
  total:     number,                       new
}

BoqProjectSummary = BoqSummary & {         new
  stale: boolean
}

BoqItem = {
  id, boqId, variantId, name, sku, unitPrice, quantity, sortOrder,
  current: { status: ProductStatus } | null,   new
}
```

`current` is `null` when `variantId` is null — the variant was deleted from the catalogue and the line stands on its frozen values alone.

## Service surface

```
listForProject(projectId, ownerId)   → boqSummary[]              changed
boqSummaries(projectIds)             → map<projectId, boqProjectSummary>   new
getOwned(id, ownerId)                → boqDetail | null          changed: items carry current
```

`boqSummaries` takes ids the caller has already checked ownership on — `projects.routes` passes the ids from `list(ownerId)`.

## Routes

```
GET /projects/:projectId/boqs    changed: lineCount + total per row
GET /boqs/:id                    changed: items carry current
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Line count and total on the revisions list

Build: a grouped aggregate over `boq_items` in `listForProject`, and the `BoqSummary` type.

Acceptance criteria:
- `GET /projects/:projectId/boqs` returns `lineCount` and `total` on every row, newest revision first.
- `total` on a row equals the `total` from `GET /boqs/:id` for the same revision, to the cent.
- Three revisions produce one aggregate query, not three.
- An unowned project returns 404; anonymous returns 401.
- A project with no revisions returns `[]`.

### Step 2 — Cross-project summaries

Build: `boqSummaries(projectIds)`, selecting the highest revision per project with its aggregate and comparing its lines against current `project_items`.

Acceptance criteria:
- `boqSummaries` over five project ids is one query for the latest revisions and one for the current items — not two per project.
- A project whose items are untouched since its latest revision returns `stale: false`.
- Changing one item's quantity flips it to `stale: true`; changing it back flips it to `false`.
- Adding an item and removing another so the count matches still returns `stale: true`.
- A variant repriced in the catalogue since the revision returns `stale: true`.
- A project with no revisions is absent from the map.
- Passing `[]` returns an empty map without hitting the database.

### Step 3 — Current product status per line

Build: resolution of `current` in `getOwned` through `getVariantRefs`.

Acceptance criteria:
- `GET /boqs/:id` returns `current.status` on every line whose variant still exists.
- Setting the product to `not_available` after the revision was generated changes `current.status` on the existing revision; `name`, `sku`, `unitPrice` and `quantity` are unchanged.
- A line whose variant was deleted returns `variantId: null` and `current: null`, and still renders its frozen name, sku and price.
- Resolution is one `getVariantRefs` call for the whole revision.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper against the real Postgres test database, no mocks. A helper generates a project with items and a revision, then mutates items or product status between generation and read to cover staleness and withdrawal. Two users cover ownership isolation.
