# Workshop projects views

## Spaces

- A space is a property of a product's placement in a project, not of the product itself.
- Platform-level canonical `spaces` taxonomy (bathroom, kitchen, living room, ...) managed from the admin app, alongside categories.
- Project-level `project_spaces`: owned by the project, free `name`, optional FK to a canonical space. Owners name spaces however they want; the canonical link is for consistency/reporting only.
- New projects start with no spaces; no seeding from `project_type`.
- `project_items` gets a nullable `space_id` → `project_spaces`. Null means unassigned.
- The same variant may appear in several spaces of one project. `project_items` moves from PK `(project_id, variant_id)` to a surrogate `id` with `unique (project_id, variant_id, space_id) nulls not distinct`. Quantity is per (variant, space).
- Deleting a project space sets `space_id` to null on its items (`on delete set null`); items are never lost with the space.
- ~~`boq_items` snapshots the space as `space_name text` (same pattern as `name`/`sku`), no FK, so a BOQ revision stays readable after spaces are renamed or removed.~~
  `boq_items` snapshots the space as `space_name text` plus `space_id uuid` (no FK), so a BOQ revision stays readable after spaces are renamed or removed and the stale check can key on the id: renaming a space does not mark the revision stale, moving an item does.
- Product-level "suitable for" hint (`product_spaces` → canonical spaces) is deferred.

## Typed attributes and colours

- One shared enum `attribute_value_type`: `text | number | boolean | range | color`. Default `text`.
- `spec_attributes.type` accepts every value. `product_options.type` is limited to `text | number | color` since options drive discrete variants.
- Colour values are label + hex. `product_option_values` and `product_specs` gain a nullable `hex` column, required by validation when the parent type is `color`; existing free-text labels stay valid.
- Free hex picker for now, no platform palette. A curated palette later is an admin-managed lookup that pre-fills label + hex; no schema change.
- `product_specs` stores typed values in sparse columns next to `value` (the display label, always set): `value_number`, `value_min`, `value_max`, `value_bool`, `hex`. Zod validates per attribute type and clears the columns that do not apply.
- `spec_attributes.unit` applies to `number` and `range` only.
- Changing an attribute/option type is allowed only while it has no values.
- New shared `ColorPicker` component in `packages/ui` (swatch + hex input); consumed by `ProductOptionsFields` and `ProductSpecsTable` in admin, and by the web product filters for colour attributes.
- Web catalogue filters render per type: chips for `text`, min/max inputs for `number`/`range`, toggle for `boolean`, swatches for `color`.

## Unit of measure

- Units are a taxonomy entity, admin-managed like categories and spec attributes: `units (id, name, symbol, slug, sort_order)`. Seeded with: piece, m, m², m³, kg, tonne, litre, bag, roll, sheet, set.
- `product_variants.unit_id` → `units`, not null, `on delete restrict`. The unit qualifies the price, so it lives with the price, not on the product.
- Admin variants table gets a Unit column preselecting "Piece"; a unit is never inferred.
- `spec_attributes.unit` stays free text; measurement units (cm, K, N/mm²) are a separate domain from sale units.
- Prices display as `price / symbol`; the suffix is hidden for `piece`.
- Fractional quantities are allowed. `project_items.quantity` and `boq_items.quantity` move from integer to `numeric(12,2)`, min 0.01. Supersedes projects-module-spec decision 10 ("quantity is an integer ≥ 1").
- Quantity inputs accept decimals for every unit, including piece; validation does not vary by unit.
- `boq_items.unit` snapshots the symbol as text, same as name/sku.

## BOQ tab views

- The BOQ tab has two views of the selected revision: gallery and BOQ table. The user switches between them; both render exactly the same set of lines.
- View state lives in the URL query as `view=gallery|boq`, next to `tab=boqs&revision=…`. Nothing is persisted in the backend or localStorage. Unknown or absent values fall back to `gallery`.
- Gallery card: image from the `current` variant, snapshot name, `quantity × unit`, line total.
- Withdrawn lines (`current` null or not published) render as a placeholder card carrying the same withdrawn flag the table shows; they are never hidden in one view and shown in the other.
- Grouping is a separate concern, decided later; it will be its own query param and apply to both views identically.

## Frozen revisions

- `boq_items` freezes every field the BOQ tab can group, sort or display as a column: adds `supplier_name`, `category_name` (leaf), `category_root_name`, `space_name`, `unit` as text, and `options` jsonb `[{ name, type, value, hex }]` copied from the variant's option values at generation.
- Columns / Arrange-by on the BOQ tab read frozen fields only. Withdrawn lines group and sort exactly like live ones; nothing joins through `variant_id` for grouping.
- Colour grouping reads the frozen option whose `type` is `color`.
- The image is not part of the BOQ. It is a gallery-view affordance resolved live through `variant_id` → `current` (extended to carry `imageMediaId`); withdrawn lines get a placeholder. It is never frozen and never exported.
- csv/xlsx exports gain supplier, category, space, unit and options columns.
- Extends boq-module-spec decision 3 (lines freeze their data); the principle is unchanged, the frozen set grows.

## Export mirrors the view

- The BOQ tab's view state (`columns`, `group_by`, `sort`, alongside `view`) lives in the URL query. `exportUrl` forwards the same params: `/boqs/:id/export?format=xlsx&columns=…&group_by=…&sort=…`.
- One `boqViewQuerySchema` in `@forge-kivu/types` parses the route query on the web and the export query on the API. Defaults (all columns, no grouping, sort by `sort_order`) are defined once there.
- Column ids are the frozen `boq_items` fields: `name, sku, supplier, category, space, unit, options, unit_price, quantity, line_total`. `name` and `line_total` cannot be unselected; everything else can.
- xlsx: header block as today, then one section per group (group header row, its lines, subtotal row), then the grand total row. Ungrouped output is a single section without header or subtotal rows.
- csv: flat rows in the selected columns and sort; when grouped, the group value is prepended as the first column. No subtotal rows.
  The prepended value is the group label, so empty keys read `Unassigned` (space) or `No colour` (color), matching the xlsx header rows.
- Sorting is applied inside each group on the server; the web table uses the same comparator so the screen and the sheet order lines identically.
- The gallery view exports exactly like the table; `view` does not influence the file.

## Open

- ~~`group_by` values for the BOQ tab (candidates from the frozen fields: space, supplier, category, colour) and whether the products tab gets the same Columns / Arrange-by controls.~~
  `group_by` is `space | supplier | category | color` (plan-level call 10). Whether the products tab gets the same Columns / Arrange-by controls stays open.
- Product-level "suitable for" spaces hint.
- Curated colour palette.

## Implementation plan

Backend, shared schemas and api-client types only. Existing admin/web callers are adapted to new payload shapes so both apps keep compiling; no new screens or controls, except `UiColorPicker` (slice 6). Each slice is a vertical cut: migration → zod → service → route → api-client types → integration tests, runnable and checked before the next one starts. Migrations always come from `pnpm db:generate` in `apps/api`; data backfills use `pnpm db:generate --custom` (precedent: `drizzle/0007_seed-platform-settings.sql`).

Order is dependency-driven: units and quantities first (every later snapshot needs them), then typed attributes (the frozen `options` jsonb needs `type`/`hex`), then spaces, then the freeze, then the export, then the picker.

### Slice 1 — Units and fractional quantities

Build:
- `apps/api/src/modules/taxonomy/taxonomy.tables.ts`: `units (id, name, symbol, slug unique, sort_order, created_at)`.
- Migrations: (a) generated: `units` table + nullable `product_variants.unit_id` fk `restrict`; (b) custom: insert the seeded units (piece, m, m², m³, kg, tonne, litre, bag, roll, sheet, set) and backfill `unit_id` to `piece`; (c) generated: `unit_id` set not null, `project_items.quantity` and `boq_items.quantity` to `numeric(12,2)`, `boq_items.unit text not null default ''`.
- `packages/types/src/taxonomy.ts`: `UNIT_LIMITS`, `createUnitSchema { name, symbol, slug, sortOrder? }`, `updateUnitSchema`; `packages/types/src/projects.ts`: `projectFields.quantity` becomes `number().min(0.01).max(PROJECT_LIMITS.quantity).multipleOf(0.01)`.
- `packages/types/src/catalogue.ts`: `setVariantsSchema` variants gain `unitId: z.uuid().optional()`; `variantFormSchema` gains `unitId`.
- Taxonomy service/routes: `listUnits`, `createUnit`, `updateUnit`, `removeUnit` (409 `UNIT_IN_USE` when a variant references it); `GET /units` public, `POST/PATCH/DELETE /admin/units[/:id]`.
- Catalogue service: `setVariants` resolves `unitId ?? piece` (piece looked up by slug once per call, 400 `UNIT_NOT_FOUND` for unknown ids); `ProductVariantResponse`, `VariantRef`, `VariantListItem` carry `unit: { id, name, symbol }`.
- Projects: `ProjectItem.unit` from the ref; quantity flows through as number.
- BOQ: `freezeItems` copies `unit: ref.unit.symbol`; line totals become `Math.round(Math.round(unitPrice * 100) * quantity)` cents in TS and `round(round(unit_price * 100) * quantity)` in SQL; csv gains a `unit` column, xlsx a `Unit` column after Quantity.
- Seed: `products.yaml` variants accept `unit: <slug>` (default piece); `seed.ts` inserts units from a new `seed-data/units.yaml`.
- api-client: export `Unit`, `AdminUnit`.
- ~~Admin/web adaptation: `variantsFormSchema` mapping sends `unitId`; `calculateLineTotal` in `apps/web/app/utils` uses the new rounding; quantity inputs get `step="0.01"`.~~
  Admin/web adaptation: `variantsFormSchema` requires `unitId`, so `ProductVariantsTable` gains the Unit select (preselecting piece) and both product pages load `GET /units`; `calculateLineTotal` in `apps/web/app/utils` uses the new rounding; quantity inputs get `step="0.01"`.

Acceptance criteria:
- `GET /units` returns the eleven seeded units in `sort_order`; anonymous allowed.
- `POST /admin/units` with a duplicate slug returns 409; `DELETE` of a unit referenced by a variant returns 409 `UNIT_IN_USE`.
- `PUT /admin/products/:id/variants` without `unitId` stores piece; with a bogus uuid returns 400 `UNIT_NOT_FOUND`.
- `PUT /projects/:id/items/:variantId` with `{ "quantity": 12.5 }` persists `12.50`; `0.001` and `0` return 400.
- Generating a BOQ over 12.5 × 1 234.56 yields a line total of 15 432.00 in the response, csv and xlsx; existing integer-quantity tests still pass unchanged.
- `pnpm db:migrate` on a database seeded before this slice ends with every variant on piece.

### Slice 2 — Typed attributes and colour values

Build:
- `packages/types/src/taxonomy.ts`: `ATTRIBUTE_VALUE_TYPES { TEXT, NUMBER, BOOLEAN, RANGE, COLOR }`, `ATTRIBUTE_VALUE_TYPE_VALUES`, `OPTION_VALUE_TYPE_VALUES = [text, number, color]`, `hexSchema = /^#[0-9a-f]{6}$/i` normalised to lowercase; `createAttributeSchema`/`updateAttributeSchema` gain `type` (default `text`).
- Tables: pgEnum `attribute_value_type`; `spec_attributes.type` not null default `text`; `product_options.type` not null default `text`; `product_option_values.hex text`; `product_specs` gains `hex text`, `value_number numeric(14,4)`, `value_min numeric(14,4)`, `value_max numeric(14,4)`, `value_bool boolean`. One generated migration.
- `packages/types/src/catalogue.ts`: `setOptionsSchema` options gain `type`, values become `{ value, hex? }`; `setSpecsSchema` specs become `{ attributeId, value, hex?, valueNumber?, valueMin?, valueMax?, valueBool? }`. A `specValueForType(type)` refinement in `@forge-kivu/types` is the single validator: `color` requires `hex`; `number` requires `valueNumber`; `range` requires `valueMin ≤ valueMax`; `boolean` requires `valueBool`; `text` forbids all typed fields. Fields that do not apply are stripped, not rejected.
- Catalogue service: `setOptions` rejects `hex` on non-colour options and requires it on colour options (400 `OPTION_VALUE_INVALID`); `setSpecs` loads attribute types and applies `specValueForType` (400 `SPEC_VALUE_INVALID`). `ProductOptionResponse.type`, option values `.hex`, `ProductSpecResponse.type` + typed fields.
- Taxonomy service: `updateAttribute` with a `type` change while `product_specs` rows reference the attribute returns 409 `ATTRIBUTE_TYPE_LOCKED`. Options need no guard: `setOptions` rewrites every option and value in one call.
  The usage check is a raw `exists` over `product_specs` inside the taxonomy service; importing the catalogue service would close a cycle (catalogue already depends on taxonomy).
- Facets: `AttributeFacet.type`; `FacetValue.hex` (grouped on `(attributeId, value, hex)`); numeric attributes keep equality faceting for now.
- `variantLabels` unchanged (label stays text).
- Seed: `spec-attributes.yaml` entries gain `type`; `products.yaml` colour options become `type: color` with `values: [{ value: Forest Green, hex: '#2e5e3a' }, …]`; `seed.ts` schemas updated.
- api-client: `AttributeValueType`, updated `ProductOption`, `ProductSpec`, `SpecAttribute` inferred types.
- Admin adaptation: `ProductOptionsFields` and `ProductSpecsTable` payload mapping only (send `type: 'text'`, wrap values), `SpecAttributeDialog` sends `type: 'text'`.

Acceptance criteria:
- `POST /admin/spec-attributes` without `type` stores `text`; `type: 'range'` with `unit: 'mm'` round-trips through `GET /spec-attributes`.
- `PUT /admin/products/:id/options` with `{ name: 'Colour', type: 'color', values: [{ value: 'Red', hex: '#FF0000' }] }` stores `#ff0000`; omitting `hex` returns 400; `hex` on a `text` option returns 400.
- `PUT /admin/products/:id/specs` against a `number` attribute without `valueNumber` returns 400 `SPEC_VALUE_INVALID`; a `range` spec with `valueMin > valueMax` returns 400; a `text` spec with `valueNumber` is stored with `value_number` null.
- `PATCH /admin/spec-attributes/:id` changing `type` returns 409 `ATTRIBUTE_TYPE_LOCKED` once a product spec uses it, 200 before.
- `GET /catalogue/products/facets` shows `type` per attribute and `hex` per colour value.
- `pnpm db:seed` succeeds and the seeded colour options carry hexes.

### Slice 3 — Spaces

Build:
- Tables: `spaces (id, name, slug unique, sort_order, created_at)` in taxonomy; `project_spaces (id, project_id cascade, space_id → spaces restrict nullable, name, sort_order, created_at, unique (project_id, lower(name)))` in projects; `project_items` gets surrogate `id uuid pk default gen_random_uuid()`, `space_id → project_spaces set null`, and `unique (project_id, variant_id, space_id) nulls not distinct` via drizzle `unique().on(…).nullsNotDistinct()` (Postgres 18 in `docker-compose.yml`). One generated migration.
- `packages/types`: `createSpaceSchema`/`updateSpaceSchema` (taxonomy); `createProjectSpaceSchema { name, spaceId? }`, `updateProjectSpaceSchema`; `setItemSchema` becomes `{ quantity, spaceId?: uuid | null }`; `removeItemQuerySchema { spaceId?: uuid }`. `PROJECT_LIMITS.spaces = 50`.
- Taxonomy service/routes: `listSpaces`, `createSpace`, `updateSpace`, `removeSpace` (409 `SPACE_IN_USE` when a project space links it); `GET /spaces` public, `POST/PATCH/DELETE /admin/spaces[/:id]`.
- Projects service: `createSpace`, `updateSpace`, `removeSpace` (owner-checked; 409 `PROJECT_SPACE_DUPLICATE` on the name index; 404 for a `spaceId` that is not a canonical space); `setItem(id, ownerId, variantId, { quantity, spaceId })` upserts on `(project_id, variant_id, space_id)` and 404s when `spaceId` is not one of this project's spaces; `removeItem` takes the optional `spaceId`; `ProjectItem` gains `id` and `space: { id, name } | null`; `ProjectDetail.spaces: ProjectSpace[]`.
- Routes: `POST /projects/:id/spaces`, `PATCH /projects/:id/spaces/:spaceId`, `DELETE /projects/:id/spaces/:spaceId`; `PUT /projects/:id/items/:variantId` (body gains `spaceId`), `DELETE /projects/:id/items/:variantId?spaceId=`.
- ~~BOQ: `lineKey` includes `spaceId` so moving an item marks the latest revision stale; `freezeItems` copies `spaceName` (null when unassigned); `boq_items.space_name text` added here, not in slice 4, so the stale check and the snapshot ship together.~~
  BOQ: `lineKey` includes `spaceId` so moving an item marks the latest revision stale; `freezeItems` copies `spaceId` and `spaceName` (both null when unassigned); `boq_items.space_id uuid` (no FK) and `boq_items.space_name text` added here, not in slice 4, so the stale check and the snapshot ship together.
- api-client: `Space`, `ProjectSpace`, updated `ProjectDetail`.
- Web adaptation: `useProjects.setItem/removeItem` pass through `spaceId` (undefined today).

Acceptance criteria:
- `POST /projects/:id/spaces { name: 'Master bathroom', spaceId: <bathroom> }` returns 201; `{ name: 'master BATHROOM' }` on the same project returns 409; another owner's project returns 404.
- `PUT /projects/:id/items/:variantId { quantity: 2 }` and the same with `{ quantity: 3, spaceId }` produce two rows; repeating either updates in place; `GET /projects/:id` lists both with `space` null and `{ id, name }` respectively.
- `PUT` with a `spaceId` belonging to a different project returns 404.
- `DELETE /projects/:id/spaces/:spaceId` leaves the item with `space: null`; `DELETE /admin/spaces/:id` while a project space links it returns 409.
- `DELETE /projects/:id/items/:variantId` removes only the unassigned row; with `?spaceId=` only the assigned one.
- After generating a BOQ, moving the item into a space makes `latestBoq.stale` true; renaming the space does not.
- `boq_items.space_name` holds the name at generation and survives deleting the project space.

### Slice 4 — Frozen revisions

Build:
- `boq_items` gains `supplier_name text not null default ''`, `category_name text not null default ''`, `category_root_name text not null default ''`, `options jsonb not null default '[]'`. One generated migration; old revisions keep the defaults.
- `VariantRef` gains `categoryRoot: ProductRef` (from `rootByCategoryId`) and `options: { name, type, value, hex }[]` (a `variantOptions(variantIds)` sibling of `variantLabels`, ordered by option `sort_order`).
- `freezeItems` copies `supplierName`, `categoryName`, `categoryRootName`, `options`.
- `BoqItem.current` becomes `{ status, imageUrl } | null`, using the `imageUrl` `VariantRef` already resolves.
- `packages/types/src/boq.ts`: `boqOptionSchema` and `BoqOption` type for the jsonb shape.
- Exports: csv columns `name,sku,supplier,category,space,unit,options,unitPrice,quantity,lineTotal`; xlsx adds Supplier, Category, Space, Options columns. `options` serialises as `Colour: Forest Green; Width: 200 mm`.
- api-client: updated `BoqDetail`, `BoqItem`.

Acceptance criteria:
- A generated line carries the supplier name, leaf and root category names, and an `options` array with `type` and `hex` for the colour value.
- Renaming the supplier, moving the product to another category and changing the option value after generation leave the frozen line unchanged; deleting the variant nulls `variant_id` and `current` while every frozen field stays.
- `current.imageUrl` matches the variant image, falls back to the product cover, and is null for a withdrawn line.
- csv and xlsx include the new columns in the stated order; the existing header-block and total-row tests still pass.

### Slice 5 — Export mirrors the view

Build:
- ~~`packages/types/src/boq.ts`: `BOQ_COLUMNS` (`name, sku, supplier, category, space, unit, options, unitPrice, quantity, lineTotal`), `BOQ_LOCKED_COLUMNS = [name, lineTotal]`, `BOQ_GROUPS` (`space, supplier, category, color`), `BOQ_SORT_FIELDS` (`sortOrder, name, supplier, category, space, unitPrice, quantity, lineTotal`), `boqViewQuerySchema { columns?: csv list, groupBy?, sort?: "field:asc|desc" }` with defaults (all columns, no group, `sortOrder:asc`) and a transform that always re-adds the locked columns. `exportQuerySchema` becomes `boqViewQuerySchema.extend({ format })`.~~
  `packages/types/src/boq.ts`: `BOQ_COLUMNS` (`name, sku, supplier, category, space, unit, options, unitPrice, quantity, lineTotal`), `BOQ_LOCKED_COLUMNS = [name, lineTotal]`, `BOQ_GROUPS` (`space, supplier, category, color`), `BOQ_SORT_FIELDS` (`sortOrder, name, supplier, category, space, unitPrice, quantity, lineTotal`), `boqViewQuerySchema { view?: gallery|boq (unknown → gallery), columns?: csv list, groupBy?, sort?: "field:asc|desc" }` with defaults (all columns, no group, `sortOrder:asc`) and a transform that always re-adds the locked columns in canonical order. Because the schema carries a transform, `exportQuerySchema` is built from the shared `boqViewQueryShape` plus `format` rather than by `.extend`. `serialiseBoqView` is the inverse used by the web `exportUrl`.
- Pure functions next to the schema, over a minimal `BoqLineView` structural type so web and api share them: `groupKey(line, groupBy)` (`color` reads the option whose `type` is `color`, label `value`, unassigned/absent → `''` sorted last), `compareLines(sort)`, `arrangeLines(lines, view) → { key, label, lines, subtotal }[]`.
- BOQ service: `buildCsv(items, view)` emits only selected columns in view order with a leading `group` column when grouped; `buildXlsx` emits one section per group (bold group header row, lines, `Subtotal` row) and the grand total row; ungrouped output has no header/subtotal rows. Route validates `exportQuerySchema`.
- `useBoqs.exportUrl(id, format, view)` serialises the view from the route query; `ProjectBoqsTab` passes the current query (no controls yet).
- api-client: `BoqViewQuery`.

Acceptance criteria:
- `?format=csv&columns=sku,quantity` returns `name,sku,quantity,lineTotal` — locked columns re-added, order preserved.
- `?columns=bogus` returns 400.
- `?groupBy=space` csv prepends `group`; xlsx has one header row per space, `Unassigned` last, subtotals summing to the grand total.
- `?sort=unitPrice:desc` orders lines identically in csv, xlsx and `arrangeLines` run over the JSON detail (asserted in one test with the same fixture).
- `?groupBy=color` groups by the frozen colour option value and puts lines without a colour option last.
- Calling without view params produces byte-identical csv to the slice 4 output.

### Slice 6 — `UiColorPicker`

Build:
- `packages/ui/app/components/UiColorPicker.vue`: `modelValue: string | null` (hex), `disabled`; a swatch button opening a native `<input type="color">`, and a text input accepting `#rrggbb` validated with `hexSchema` from `@forge-kivu/types`; emits `update:modelValue` with the normalised lowercase hex or `null` when cleared. Tokens from `assets/css/tokens.css`; no consumer wired in this iteration.

Acceptance criteria:
- Typing `FF0000` or `#FF0000` emits `#ff0000`; an invalid string leaves the model untouched and shows the invalid state.
- Picking from the native input updates the text and swatch.
- `pnpm typecheck` passes in `packages/ui`, `apps/admin`, `apps/web`.

## Test approach

Integration tests through `app.request()` with `loginAs`/`loginAsAdmin` and `resetDatabase`, real Postgres, no mocks; run with `pnpm test` in `apps/api` (Bun runtime). Each slice extends the module test file it touches (`taxonomy.test.ts`, `catalogue.test.ts`, `projects.test.ts`, `boq.test.ts`); the view functions in `@forge-kivu/types` get unit tests in `packages/types`. `pnpm db:seed` is run at the end of slices 1–3 as a smoke test of the yaml changes.

## Plan-level calls (veto if wrong)

1. `unitId` is optional in `setVariantsSchema`; the API stores `piece` when omitted, the same default the form will preselect.
2. Unit backfill and unit seeding ship as a custom migration generated with `drizzle-kit generate --custom`, so old databases migrate without a reseed.
3. Line totals round to cents after multiplying: `round(round(unit_price × 100) × quantity)`.
4. Project space names are unique per project, case-insensitive.
5. Item routes keep `:variantId` and take `spaceId` in the body (PUT) or query (DELETE); no surrogate-id item routes yet. Moving an item is PUT-then-DELETE, done by the UI later.
6. `boq_items.space_name` lands in slice 3 with the stale check, not in slice 4.
7. `current` carries `imageUrl`, not `imageMediaId`; `VariantRef` already resolves the URL.
8. Attribute type changes are locked once any product spec uses the attribute (409); option types have no lock because `setOptions` rewrites all values.
9. Numeric spec columns are `numeric(14,4)`.
10. Initial `groupBy` set is `space | supplier | category | color`; it closes the first Open item and is a one-line enum change to extend.
11. `arrangeLines` and friends live in `@forge-kivu/types` next to the schema rather than in a new package.
