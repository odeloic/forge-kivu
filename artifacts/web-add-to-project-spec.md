# Web Add-to-Project Spec

Adds a product to a project, and to a space in that project, from the storefront in `apps/web`. It also repairs the workshop picker, which spaces broke. The behaviour follows the five lower artboards of the storefront canvas (Add to project, The flow, Panel states, Inside the project, Phone) and the sticky notes beside them. No backend change except a dev seed.

## Decisions

1. **The panel is one `AddToProjectDialog` component, mounted by the page that opens it and fed by props.** Both entry points (the `+` on a catalogue card, the button on the product page) render it with `v-model:open` and a target, the way `UiConfirmDialog` is used today. Rejected: a global panel in the layout with shared state. Two pages do not justify app-wide state, and props keep the panel testable.
2. **A card opens the panel with the product only; the panel fetches the detail and asks for the variant when there is more than one.** `ProductListItem` carries `priceFrom`, not variants. A product with one variant skips the step.
3. **The panel reads the working copy before it writes.** `GET /projects` fills the project select; `GET /projects/:id` fills the space select from `spaces` and finds the existing line from `items`, keyed on variant + space with `null` counted as a space. When the line exists, the note shows its quantity and the action reads "Update quantity". `PUT` sets the quantity; it never adds.
4. **"Whole project — no space" is a real option, sent as `spaceId: null`.** It is always the first entry in the space select, so a project with no spaces still has somewhere to add to.
5. **A new space is two requests, and the space is kept when the second fails.** `POST /projects/:id/spaces` then `PUT`. If the PUT fails, the created space is pushed into the local space list and selected, the error shows under the action, and a retry sends only the PUT. Rejected: deleting the space on failure. The owner named it, it is theirs, and the delete could fail too.
6. **The two space refusals use `errorMessage` with the design's wording.** `PROJECT_SPACE_DUPLICATE` becomes "That name is already a space in this project. Pick it from the list instead." and `PROJECT_SPACE_LIMIT` becomes "50 spaces is the limit for a project. Rename or remove one first." in `packages/nuxt-base/app/utils/errors.ts`. The panel carries no copy of its own; both messages show under the name field.
7. **Last-used project and space live in `localStorage`, written only after a successful add.** Key `forge-kivu.add-to-project`, value `{ projectId, spaceByProject: { [projectId]: spaceId | null } }`. Read on the client only. A stale id falls back to the first project in the list, then the project's first space, then no space. Rejected: a backend field. The server has no notion of "last used" and a default does not earn a migration. Deferred: an account-level preference if it must follow the user across devices.
8. **Signed-out visitors get the sign-in state in the panel and come back with the panel open.** "Sign in" goes to `/login?redirect=<product page>?add=<variantId>`. On load the product page reads `add`, selects that variant, opens the panel and strips the query. A card sends `add=` empty, which opens on the variant step. No "Create account" button: `apps/web` has no signup page, only `useSession().signup`. Deferred until a signup page exists.
9. ~~**"Open project" lands on `/workshop/projects/:id?tab=products`.** The flow artboard names the BOQ tab with `groupBy=space`, but the working copy is the products tab, and `groupBy` is a BOQ (bill of quantities) view parameter for frozen revisions. Deferred: a `space` group on the products tab.~~
   **"Open project" lands on `/workshop/projects/:id?tab=boq`.** The Products tab merged into the Bill of quantities tab (workshop-projects-views.md, One tab); with no `revision` that is the working copy, and `groupBy=space` now applies to it too.
10. **Below 900px the shared `UiDialog` docks to the bottom as a sheet.** One media query in `packages/ui`, so every dialog in both apps behaves the same on a phone. The quantity field shows − / + steppers below the same breakpoint, every target at least 44px.
11. **The workshop picker keys every line on variant + space.** `ProjectLine` gains `spaceId` and `spaceName`; "Added", the space column and the save diff use `lineKey = variantId:spaceId`. A line can be moved between spaces from the selected table; spaces already holding that variant are disabled in that line's select, so two lines never collide. Removes run before puts, so a move is delete-then-put.
12. **`ProjectProductsTab` passes the item's space when removing.** Today it calls `removeItem(project.id, item.variantId)`, which deletes the no-space row whichever row was clicked. Same family as the picker bug.
13. **Canonical spaces are seeded from `seed-data/spaces.yaml`, as a deferrable last step.** Suggestions under "New space name" are empty without it. Dev seed only, mirroring `seedUnits` (upsert on slug); no migration, since no schema depends on the rows.
14. **The line total uses `calculateLineTotal` from `@forge-kivu/types`.** Same cents arithmetic as the picker and the BOQ.
15. **Quantity starts at 1 and is never rewritten by the panel.** Prefilling the existing quantity on a clash would overwrite what the user typed when they switch space. Validation is the picker's rule: 0.01 to `PROJECT_LIMITS.quantity`, two decimals.
16. **A signed-in user with no projects sees "No projects yet" with a link to `/workshop/projects/new`.** The design does not draw it, but a fresh account hits it first.

## Files

```
apps/web/app
├── components
│   ├── AddToProjectDialog.vue         new   UiDialog shell; renders signed-out | variant | edit | done
│   ├── AddToProjectVariantList.vue    new   radio list, one row per variant: option values · price
│   ├── AddToProjectSpaceField.vue     new   space select, new-space name, suggestions, space errors
│   ├── ProjectQuantityField.vue       new   number input + unit symbol; − / + below 900px
│   ├── ProjectProductPicker.vue       changed  Add-to-space target, Space column, keyed selection
│   └── ProjectProductsTab.vue         changed  remove passes item.space?.id
├── composables
│   ├── useAddToProject.ts             new   panel state machine: loads, clash, submit sequence
│   ├── useLastUsedProject.ts          new   localStorage memory (decision 7)
│   ├── useSpaces.ts                   new   list() → GET /spaces
│   ├── useProductVariant.ts           changed  selectVariant(id)
│   └── useProjects.ts                 changed  createSpace, updateSpace, removeSpace
├── utils
│   ├── projects.ts                    changed  ProjectLine.spaceId/spaceName, lineKey, diffLines, findLine
│   └── variants.ts                    changed  variantLabel(variant, options)
└── pages
    ├── index.vue                                   changed  handles @add, mounts the dialog
    ├── products/[supplierSlug]/[productSlug].vue   changed  button opens the dialog; reads ?add=
    ├── workshop/projects/[id]/products.vue         changed  space-aware lines and diff
    └── workshop/projects/new.vue                   changed  same diff helper, spaces: []
apps/web/test/project-lines.spec.ts              new
apps/web/test/last-used-project.spec.ts          new
packages/ui/app/components/UiDialog.vue          changed  sheet below 900px
packages/nuxt-base/app/utils/errors.ts           changed  two message strings (decision 6)
apps/api/src/db/seed-data/spaces.yaml            new
apps/api/src/db/seed.ts                          changed  seedSpaces
```

## Panel data

`useAddToProject(target)` with `target = { product: ProductListItem | ProductDetail, variant?: ProductVariant }` and phase `signed-out | loading | no-projects | variant | edit | done`.

- `detail: ProductDetail` — from the target, or fetched for a card.
- `variant: ProductVariant` — from the target, the only variant, or the one picked. Unit symbol and price come from it.
- `projects: ProjectListItem[]` — option label `name · phase label`, phase omitted when null.
- `project: ProjectDetail | null` — the selected project; `project.spaces` drives the select, `project.items` the clash.
- `space: { kind: 'none' } | { kind: 'existing', id } | { kind: 'new', name, canonicalId: string | null }`.
- `suggestions: Space[]` — `GET /spaces`, fetched once when "New space…" is first chosen; filtered by name prefix, case-insensitive; picking one fills the name and sets `canonicalId`.
- `quantity: string` draft, valid per decision 15.
- `existing = findLine(project.items, variant.id, spaceId)` — `null` when `space.kind === 'new'`.
- `lineTotal` — `calculateLineTotal(variant.price, quantity)`, or "—" when price is on request.
- `spaceError` (under the name) and `error` (under the action), both `ErrorCode | null`.

## Request sequence per action

| Action | Requests | Then |
| --- | --- | --- |
| Open, signed out | none | `signed-out`; Sign in → `/login?redirect=…?add=…` |
| Open from the product page | `GET /projects`, then `GET /projects/:id` (last-used if listed, else first) | `edit`, or `no-projects` |
| Open from a card | `GET /catalogue/products/:supplierSlug/:productSlug` and `GET /projects` in parallel, then `GET /projects/:id` | `variant` when more than one variant, else `edit` |
| Pick a variant, Continue | none | `edit` |
| Change project | `GET /projects/:id` | space = last-used in that project, else first, else none |
| Choose "New space…" | `GET /spaces` once | name input and suggestions |
| Add / Update quantity, existing or no space | `PUT /projects/:id/items/:variantId { quantity, spaceId }` | `done`; remember project and space |
| Add, new space | `POST /projects/:id/spaces { name, spaceId? }` → 201, then the `PUT` with the created id | `done`; POST refused → `spaceError`, no PUT; PUT failed → space kept and selected, `error` |
| Add to another space | none | `edit`, same project, quantity kept |
| Open project | none | ~~`/workshop/projects/:id?tab=products`~~ `/workshop/projects/:id?tab=boq` |

## Workshop picker

- `ProjectLine = { variantId, spaceId, spaceName, name, sku, label, price, quantity }`; `lineKey(line)` is `` `${variantId}:${spaceId ?? ''}` ``.
- `ProjectProductPicker` takes `spaces: ProjectSpace[]`. An "Add to space" select above the catalogue table (— no space, then the project's spaces) is the target for new rows. "Add" is disabled and reads "Added" when the variant is already selected in that target space; the same variant in another space stays addable.
- Selected table columns: Variant · Space (select) · Qty · Line · ×. The column is 34rem wide.
- `diffLines(saved, current)` returns `{ removed, upserts }`: removed are saved keys missing from current; upserts are current lines whose key is new or whose quantity changed. `products.vue` and `new.vue` both run removes (`removeItem(id, variantId, spaceId ?? undefined)`) before puts (`setItem(id, variantId, quantity, spaceId)`).

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Fix the workshop picker for spaces

Build: `ProjectLine` with space, `lineKey` and `diffLines` in `utils/projects.ts`, the Space column and Add-to-space target in `ProjectProductPicker.vue`, the keyed save in `products.vue` and `new.vue`, the space-aware remove in `ProjectProductsTab.vue`.

Acceptance criteria:

- A project holds one variant in Kitchen (qty 2) and with no space (qty 5). Open `/workshop/projects/:id/products`, change nothing, Save: no item request is sent and both rows survive.
- Change the Kitchen line to 3, Save: exactly one `PUT …/items/:variantId` with `{ quantity: 3, spaceId: <kitchen> }`.
- Remove the Kitchen line, Save: one `DELETE …/items/:variantId?spaceId=<kitchen>`; the no-space row survives.
- Move the no-space line to Living room, Save: `DELETE …/items/:variantId` with no query, then `PUT` with `spaceId: <living room>`.
- On the no-space line of that variant, the Kitchen option is disabled in the space select.
- Products tab: × on the Kitchen line removes only that row.
- `pnpm vitest run --project web` passes `project-lines.spec.ts`, which covers the four diffs above.

### Step 2 — Space calls and the last-used memory

Build: `createSpace`, `updateSpace`, `removeSpace` on `useProjects`; `useSpaces().list()`; `useLastUsedProject`; the two message strings.

Acceptance criteria:

- `createSpace(id, { name: 'Kitchen' })` resolves to the 201 row; a second call with `'kitchen'` rejects with `ApiError('PROJECT_SPACE_DUPLICATE')` and `errorMessage` returns the new wording.
- `useLastUsedProject`: after `remember(p, s)`, `projectId` is `p` and `spaceFor(p)` is `s`; `spaceFor(other)` is `undefined`; with no storage `projectId` is `null` and nothing throws during server render.
- `last-used-project.spec.ts` passes with a stubbed `localStorage`.

### Step 3 — The panel from the product page, signed in

Build: `useAddToProject`, `AddToProjectDialog`, `AddToProjectSpaceField`, `ProjectQuantityField`, `variantLabel`, `findLine`, the product page button, the `no-projects` state.

Acceptance criteria:

- Click "Add to project": `GET /projects` then `GET /projects/:id`; the project select lists `name · phase`; the space select starts with "Whole project — no space", then the project's spaces, then "New space…".
- Quantity 36 at 16,800 shows "Line total 604,800 RWF"; `0` or `1.234` disables the action; the unit symbol beside the input is the variant's.
- The project already holds the variant in Roof & exterior at 24: choosing that space shows "Already in Roof & exterior — 24 sheet. Adding replaces that quantity; it does not add to it." and the action reads "Update quantity"; after it, the row's quantity is 36, not 60.
- A project with no spaces shows "This project has no spaces yet — name one, or add to the whole project." and defaults to Whole project.
- "New space…" with "Kitchen": `POST …/spaces { name: 'Kitchen' }` then `PUT … { spaceId: <created> }`. Picking the suggestion "Kitchen" sends its canonical id as `spaceId` in the POST.
- POST answers 409 or `PROJECT_SPACE_LIMIT`: the message shows under the name, no PUT is sent, the panel stays open.
- POST succeeds and the PUT fails (unpublish the product first, expect `PRODUCT_NOT_PUBLISHED`): the new space is selected in the select, the error shows under the action, and `GET /projects/:id` lists the space.
- Done reads `Kabeza House · Kitchen · 36 sheet · 604,800 RWF`; "Open project" lands on ~~`?tab=products`~~ `?tab=boq` with the line present; "Add to another space" returns to edit with the quantity kept.
- After a success `localStorage` holds the project and space, and the next open starts on them.
- A user with no projects sees "No projects yet" with a link to `/workshop/projects/new`.

### Step 4 — The card entry and the signed-out state

Build: `AddToProjectVariantList`, `@add` on `index.vue`, the `signed-out` phase, `selectVariant`, the `add` query on the product page.

Acceptance criteria:

- Signed in, `+` on a card of a four-variant product: the detail is fetched, the list shows rows like `2.5 m · Forest Green — 16,800`, Continue is disabled until one is picked. A one-variant product goes straight to edit.
- Signed out, `+` on a card: the signed-out panel with "Sign in"; the link is `/login?redirect=/products/<supplier>/<slug>?add=`; after login the product page opens the panel on the variant step and the URL carries no `add`.
- Signed out on the product page with variant X selected: the redirect carries `add=X`; after login the page has X selected and the panel open in edit.

### Step 5 — Phone sheet

Build: the bottom-sheet media query in `UiDialog.vue`; − / + on `ProjectQuantityField`.

Acceptance criteria:

- At 390px wide the panel spans the full width at the bottom, the action button is full width, − and + are visible and at least 44px tall; + takes 36 to 37, − stops at 0.01.
- Above 900px nothing changes; `CategoryDialog` in `apps/admin` also docks at 390px.

### Step 6 — Seed canonical spaces (can be deferred; nothing depends on it)

Build: `spaces.yaml` (kitchen, living room, dining room, bedroom, bathroom, toilet, corridor, staircase, garage, store, laundry, office, reception, balcony, terrace, roof, exterior, garden, boundary wall), `seedSpacesSchema` and `seedSpaces` in `seed.ts`.

Acceptance criteria:

- `pnpm db:seed` in `apps/api` logs `spaceCount`; `curl localhost:3001/spaces` returns the rows in yaml order; a second seed leaves the count unchanged.
- The suggestions under "New space name" show them, filtered as the name is typed.

## Not in this pass

- A signup page and the "Create account" button (decision 8).
- A `space` group on the products tab (decision 9).
- Renaming or removing project spaces from the panel or the picker; `updateSpace` and `removeSpace` are wired but unused.
- An admin page for canonical spaces.
- Adding several lines in one panel session.

## Test approach

Unit tests with vitest in `apps/web/test` (nuxt environment, like `variants.spec.ts`) for the pure pieces: `lineKey`, `diffLines`, `findLine`, `variantLabel`, and `useLastUsedProject` against a stubbed `localStorage`. The request sequences are checked by hand against the running API with the browser's network panel, since `apps/web` has no component harness; the server behaviour they rely on is already covered by `projects.test.ts` under Bun.

## Veto if wrong

Calls that were mine, not in the design or the brief:

- Props-driven panel per page rather than one global instance (1).
- Reworded the two shared space messages instead of panel-local copy (6).
- `localStorage` for the memory, no new dependency (7).
- The `add` query to reopen the panel after sign-in; no "Create account" button (8).
- "Open project" goes to the products tab (9).
- The sheet is a media query on the shared `UiDialog`, affecting admin dialogs too (10).
- Quantity starts at 1 and is not prefilled on a clash (15).
- A `no-projects` state (16).
- Seeding canonical spaces is in this pass, as the last, deferrable step (13).
