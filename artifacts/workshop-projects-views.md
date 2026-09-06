# Workshop projects views

## One tab

Ruled: Products and BOQs merge into one "Bill of quantities" tab on the project detail page. The separate Products tab and BOQs tab are gone.

- ~~The project detail page has four tabs: Overview, Products, BOQs, Settings. The Products tab is the working copy; the BOQs tab lists revisions and shows the selected one.~~
  Three tabs: Overview, Bill of quantities, Settings. A Revision strip at the top of the Bill of quantities tab chooses what it shows: the Working copy (live, editable) or a frozen revision (read-only). ~~It uses the same underline pattern as the Show filter: `Working copy · N lines | Revision 2 · 12 Aug | Revision 1 · 3 Aug`.~~
  The picker is a labelled select in the same vocabulary as the control row: a "Showing" caption over a `<select>` listing `Working copy · N lines` first, then the revisions newest-first (`Revision 2 · 12 Aug`), with `· Stale` on the latest one. Not tabs: an underline strip under the page's own tab strip is nested tabs, revisions are unbounded so a strip keeps widening, and the working copy is not a peer of a revision but the live thing the revisions are snapshots of.
- Working copy selected: the "Changed since revision N" flag and Generate revision sit on the right of the strip. A frozen revision selected: Export XLSX / Export CSV sit there instead, plus the one-line frozen banner (generated when, line count, total, stale flag).
- Everything below the strip is identical for both sources: the Gallery/BOQ view switch, Arrange by, Columns, Search, Show, and the Category / Supplier / Space filters.
- ~~Generate revision lives in the page header.~~
  Generate revision moves out of the page header into the strip; the header keeps only the name, phase and Delete. The tab's count is the working copy's line count.
- The revision picker is the existing `GET /projects/:id/boqs` list plus the existing `?revision=` query; no `revision` means the working copy. One backend addition remains for the stale flag, listed under Gaps.
- Considered and dropped: the second row of the Workshop Project Views canvas, a Products tab (working copy, both views) next to a BOQs tab (revision list, both views). Same line components, two hosts, Generate away from the strip, and comparing the working copy with a revision took a tab change plus a list click.

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

- ~~The BOQ tab has two views of the selected revision: gallery and BOQ table. The user switches between them; both render exactly the same set of lines.~~
  The Bill of quantities tab has two views of the selected source, gallery and BOQ table, over the same set of lines. The source is the working copy (`ProjectDetail.items`) or a frozen revision (`BoqDetail.items`), chosen in the Revision strip.
- ~~View state lives in the URL query as `view=gallery|boq`, next to `tab=boqs&revision=…`. Nothing is persisted in the backend or localStorage. Unknown or absent values fall back to `gallery`.~~
  View state lives in the URL query as `view`, `columns`, `groupBy` and `sort`, next to `tab` and `revision`. Nothing is persisted in the backend or localStorage. A key at its default is dropped from the URL. See "URL contract" under Project views.
- ~~Gallery card: image from the `current` variant, snapshot name, `quantity × unit`, line total.~~
  Gallery card: supplier and space as eyebrows, image (live through the variant), name, `sku · variant label`, `price / unit` (suffix hidden for piece), quantity with the unit symbol, line total. Four states: priced; unpriced ("No price yet", total "—"); withdrawn (placeholder image, "No longer available" flag); frozen (quantity as text, no stepper, no ×).
- Withdrawn lines (`current` null or not published) render as a placeholder card carrying the same withdrawn flag the table shows; they are never hidden in one view and shown in the other.
- ~~Grouping is a separate concern, decided later; it will be its own query param and apply to both views identically.~~
  ~~Grouping is `groupBy` (slice 5) and both views arrange lines with `arrangeLines`: the gallery renders one section per group with a heading (label, line count, subtotal); the table renders a group header row and a subtotal row per group, then the grand total row. The column that carries the group (space, supplier or category) leaves the rows, and the Columns menu lists it as "Grouped"; `color` folds no column.~~
  Grouping is `groupBy` (slice 5) and both views arrange lines with `arrangeLines`: the gallery renders one section per group with a heading (label, line count, subtotal); the table renders one group header row per group carrying the label, line count and subtotal on its right, as the Frozen artboard draws it, then the grand total row with the amount in the Line total column. No separate subtotal row. The column that carries the group (space, supplier or category) leaves the rows, and the Columns menu lists it as "Grouped"; `color` folds no column.

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
  ~~The prepended value is the group label, so empty keys read `Unassigned` (space) or `No colour` (color), matching the xlsx header rows.~~
  The prepended value is the group label, so an empty key reads `No space`, `No supplier`, `No category` or `No colour` after its dimension (`EMPTY_GROUP_LABELS` in `@forge-kivu/types`), matching the xlsx header rows.
- Sorting is applied inside each group on the server; the web table uses the same comparator so the screen and the sheet order lines identically.
- The gallery view exports exactly like the table; `view` does not influence the file.
- The web passes `visibleColumns(view)` to `exportUrl`, so a column folded into the group header on screen is absent from the file too. No server change: the route already takes any subset of `columns`.

## Project views

The workshop Gallery and BOQ views, per the Workshop Project Views canvas. Builds on the add-to-project work (the panel, space CRUD on `useProjects`, the picker's Space column), on `boqViewQuerySchema` / `serialiseBoqView` / `arrangeLines` in `@forge-kivu/types`, and on `GET /boqs/:id/export`. None of those is re-specified here.

### Component tree

```
apps/web/app
├── pages/workshop/projects/[id]
│   ├── index.vue                    changed  tabs overview · boq · settings, aliases for products/boqs, Generate leaves the header
│   └── products.vue                 changed  Cancel/Save return to ?tab=boq
├── components
│   ├── ProjectBoqTab.vue            new      host: parses revision + view, loads the selected revision, builds LineView[], owns the filters
│   ├── ProjectProductsTab.vue       deleted  its summary moves to ProjectLineSummary, its table to ProjectLineTable
│   ├── ProjectBoqsTab.vue           deleted  its revision list becomes ProjectRevisionStrip
│   ├── ProjectRevisionStrip.vue     new      "Showing" select over working copy + revisions, Generate, Export, the changed-since and frozen banners
│   ├── ProjectLineControls.vue      new      View switch · Arrange by · Columns · Search lines · Add products
│   ├── ProjectColumnsMenu.vue       new      popover, one checkbox per BOQ_COLUMNS, Reset
│   ├── ProjectLineFilters.vue       new      Show · Category · Supplier · Space, "Filtering by" chips, Clear all
│   ├── ProjectLineGallery.vue       new      sections of cards, one per group
│   ├── ProjectLineCard.vue          new      one card, four states
│   ├── ProjectLineTable.vue         new      grouped table, sortable headers, quantity field and × on the working copy
│   ├── ProjectLineSummary.vue       new      "Cost by <group>" chart + Materials total · Largest line · Attention, lifted out of ProjectProductsTab
│   └── ProjectQuantityField.vue     changed  steppers prop: 'narrow' (today) | 'always'
├── composables
│   ├── useBoqView.ts                new      reads view · columns · groupBy · sort from the route, writes them back without defaults
│   ├── useLineFilters.ts            new      show · category · supplier · space · search, option lists with counts
│   ├── useAddToProject.ts           changed  openProjectPath → ?tab=boq
│   └── useBoqs.ts                   unchanged
├── utils/lines.ts                   new      LineView, toLineView for both sources, the Show predicates
└── test/line-views.spec.ts          new
packages/types/src/boq/utility.ts    changed  groupedColumn(groupBy), visibleColumns(view)
packages/types/src/boq/utility.test.ts  changed
apps/api/src/modules/projects/projects.routes.ts  changed  GET /projects/:id adds latestBoq
apps/api/src/modules/projects/projects.test.ts    changed
packages/api-client                  rebuilt  ProjectDetail.latestBoq
```

### Line model

`LineView` is the one shape both views render, built once per source in the host:

```
LineView
├── key               `${variantId}:${spaceId ?? ''}` (working copy) · boq_items.id (frozen)
├── variantId         string | null
├── spaceId           string | null
├── name, caption     working: product.name and `sku · label` · frozen: the snapshot name and sku
├── supplierName, categoryName, categoryRootName, spaceName, unit, options
├── unitPrice         number, 0 when unpriced, so arrangeLines and sumLineTotals accept the line
├── price             number | null, what the card and the cell print
├── quantity, sortOrder
├── imageUrl          working: item.imageUrl · frozen: current?.imageUrl ?? null
└── withdrawn         working: product.status ≠ published · frozen: current null or status ≠ published
```

- `toLineView(item: ProjectItem, index)`: `sortOrder = index`, the API order.
- `toLineView(item: BoqItem)`: the snapshot fields as they are. It already satisfies `BoqLineView`.
- Show predicates over a line: Priced = `price !== null`; Unpriced = `price === null`; No longer available = `withdrawn`. A withdrawn priced line counts in Priced and in No longer available, as the canvas counts do.

### URL contract

| Key | Values | Absent | Bad value |
| --- | --- | --- | --- |
| `tab` | ~~`overview`, `products`, `boqs`, `settings`~~ `overview`, `boq`, `settings`; `products` and `boqs` alias to `boq` so bookmarks keep working | `overview` | `overview` |
| `revision` | a `boqs.id` of this project | ~~latest revision~~ working copy | as absent |
| `view` | `gallery`, `boq` | `gallery` | `gallery` (the schema's `catch`) |
| `columns` | comma list of `BOQ_COLUMNS`; `name` and `lineTotal` re-added | all ten | whole view falls back to defaults |
| `groupBy` | `space`, `supplier`, `category`, `color` | none | defaults |
| `sort` | `field:asc` or `field:desc` over `BOQ_SORT_FIELDS` | `sortOrder:asc` | defaults |

`useBoqView` parses `route.query` with `boqViewQuerySchema.safeParse`, falls back to `BOQ_DEFAULT_VIEW` on failure, and writes with `router.replace` through `serialiseBoqView`, keeping `tab` and `revision` and deleting any key equal to its default. Switching source keeps every view key.

### One set of controls

- View switch → `view`. Gallery | BOQ.
- Arrange by → `groupBy`. None | Category | Supplier | Space | Colour.
- Columns → `columns`. BOQ view only; the button reads `n of 10`.
- Sort → `sort`. Set by clicking a header in the BOQ table: first click ascending, second descending, third back to `sortOrder:asc`. Sortable headers are `BOQ_SORT_FIELDS` minus `sortOrder`. The gallery has no sort control and follows the URL.
- Search lines: client-side match on name, sku and label; not in the URL.
- Add products: working copy only; goes to `/workshop/projects/:id/products`.

### Columns

- The BOQ table shows, in order: `#`, Image, `visibleColumns(view)` in `BOQ_COLUMNS` order, Share, and × on the working copy. `#`, Image and Share are screen-only: never in `columns`, never in the file. `#` numbers rows continuously in arranged order; Share is the line total over the source total.
- `visibleColumns(view)` is `view.columns` minus `groupedColumn(view.groupBy)`, where `space | supplier | category` map to themselves and `color` to nothing.
- `name` and `lineTotal` are locked: checked and disabled. The grouped column is disabled and labelled "Grouped". Reset removes `columns` from the URL.
- The `options` column header is "Options": the colour option renders as swatch + value, every other option as `name: value`. The canvas's "Color" header is superseded because the frozen `options` array carries every option. The Unit price cell prints the amount alone; the `/ unit` suffix belongs to the card, where Unit has no column of its own.
- Column defaults do not depend on the source. The canvas artboards show the working copy without Unit and the revision with it; those are selections, not a rule.

### Arrange by and sort

- ~~Filters apply first, then `arrangeLines(lines, { groupBy, sort })`. Groups order by label with the empty key last, labelled by `groupLabel` (`Unassigned` for space, `No colour` for colour), the same words the file uses. The canvas's "No space" is superseded; the card's space eyebrow uses `Unassigned` too.~~
  Filters apply first, then `arrangeLines(lines, { groupBy, sort })`. Groups order by label with the empty key last, labelled by `groupLabel`, whose fallback is per dimension: `No space`, `No supplier`, `No category`, `No colour`. The card's space eyebrow, the Space column and the Space filter read the same `No space` through `spaceLabelOf`, so screen, xlsx and csv say one word and the boards' wording holds.
- Sort applies inside each group; ties fall back to `sortOrder`. An unpriced line sorts as 0 on `unitPrice` and `lineTotal`.
- Subtotals are `sumLineTotals(group.lines)`. The grand total row reads "Total · n lines" over the visible lines and adds "of m" when a filter or search is active. The Share column and the summary tiles use the source total, not the visible total.
- The BOQ view shows `ProjectLineSummary` above the table: the "Cost by <group>" chart follows Arrange by and hides when it is None; Materials total (with "% of budget" when the project has one), Largest line and Attention stay. The gallery has no summary.

### Show, Category, Supplier and Space

- Client-side, held in `useLineFilters`, never in the URL (see Gaps). Search is the fifth member.
- ~~Show: single choice All | Priced | Unpriced | No longer available, with counts over every line of the source. Show and the three facets are captioned `.field` + `Label` groups like the rest of the control row, not `fieldset`s: `base.css` gives a `fieldset` a border and padding, which paints four boxes the design does not have. The view switch carries the same caption.~~
  ~~Show: single choice All | Priced | Unpriced | No longer available, with counts over every line of the source. One row, as the artboards draw it: the eyebrow "Show" inline to the left of the four underlined options, a hairline divider, then the three selects with no caption of their own (their all-pass option is the caption). No `fieldset`: `base.css` gives a `fieldset` a border and padding the design does not have. The view switch carries a "View" caption like Arrange by and Search lines.~~
  ~~Show: single choice All | Priced | Unpriced | No longer available, with counts over every line of the source, as a `<select>` like the other three: `Show · All` first, then `Priced · 10`, `Unpriced · 1`, `No longer available · 1`, 130 px wide, first in the row. The filter row is four identical selects with no caption of their own (the all-pass option is the caption) and no `fieldset`. Show is a filter like the others; its counts do not earn a different control. The view switch carries a "View" caption like Arrange by and Search lines.~~
  Show: single choice All | Priced | Unpriced | No longer available, with counts over every line of the source, as a `<select>` like the other three, 130 px wide, first in the row. Each of the four is a captioned `.field`: a Label (Show, Category, Supplier, Space) above the select, the shape the control row already uses, in one flex-end row with an 8 px gap. The all-pass option is plain `All`; the rest read `Priced · 10`, `Kitchen · 3`, `No space · 3`. A caption inside the option text would vanish once something is chosen, since a native select renders its chosen option, and the row would read `Priced · 10 | Roofing · 4 | Kivu Ceramics · 3` with nothing saying which control governs which dimension. No `fieldset`. Show is a filter like the others; its counts do not earn a different control.
- ~~Category (leaf `categoryName`), Supplier (`supplierName`), Space (`spaceName`, `Unassigned` for null): single-select each, options listed from the values the source's lines carry, sorted by label, with counts over the source.~~
  Category (leaf `categoryName`), Supplier (`supplierName`), Space (`spaceName`, `No space` for null): a captioned `<select>` each, 150 / 168 / 130 px wide as drawn. The first option is the all-pass `All`; the rest come from the values the source's lines carry, sorted by label, with the count in the option text (`Tiles · 3`; a native option cannot right-align the count the way the open list is drawn). Not inline: category and supplier are unbounded and space is capped at 50, so an inline list wraps into a wall that pushes the lines off screen. ~~Show stays inline because its four options are a fixed set and the counts are the point.~~
- "Filtering by" chips, one per active filter (Show when not All), and Clear all, which also empties the search. The chips are what keep a filter visible once the choice sits inside a closed select; with Show in a select too, the `Show: Unpriced` chip is the only always-visible sign that a status filter is on. `ProjectLineFilters` reuses the `.chip` markup and style of `ProductFilterChips`; the catalogue component is left as it is.
- Filters survive a source change. A value the new source lacks stays active with count 0 and yields the empty state, so a working copy and a revision can be compared under the same filter.
- Column and arrange choices are not chips: they change the shape of the view, not the set of lines.

### Working copy versus frozen revision

| | Working copy | Frozen revision |
| --- | --- | --- |
| Source | `ProjectDetail.items` | `BoqDetail.items` from `GET /boqs/:id`, loaded when selected |
| Add products | shown | hidden |
| Quantity | `ProjectQuantityField` (`steppers='always'`: ghost − and + around a borderless number, unit after) on the card and in the Qty cell; `PUT /projects/:id/items/:variantId { quantity, spaceId }` on blur or Enter when valid and changed; then `changed` → reload | text: `Qty 38 m²` on the card, the number alone in the Qty cell (Unit is its own column) |
| × | `removeItem(project.id, variantId, spaceId)`; then `changed` | none |
| Image | `item.imageUrl` | `current?.imageUrl`; placeholder when null |
| Unit column | on by default | on by default |
| Withdrawn line | flag on the card and the row; note under the table (today's wording); Generate disabled | flag, placeholder, never hidden; note: "… was pulled from the catalogue after this revision was generated. The line keeps the price it was frozen with; it is flagged, never hidden, and exports with the rest." |
| Unpriced line | "No price yet", total "—"; Generate disabled | cannot occur |
| Strip | "Working copy · n lines"; "Changed since revision N" when `latestBoq.stale`; "Exports come from revisions"; Generate revision N+1 | the revision selected; Export XLSX · Export CSV as text links, not buttons; the banner is a bordered `.note` row: "Revision N" · "Generated <date time> · n lines · <total> <currency>" · divider · "Frozen at generation: names, prices, units, quantities, suppliers, categories, spaces, colours." · "Stale · changed since" on the latest revision when `latestBoq.stale` |
| Export | none | `exportUrl(id, format, { ...view, columns: visibleColumns(view) })` |

- Generate revision. ~~In the page header.~~ In the strip, right of the working copy. Enabled when the working copy has lines, none unpriced, none withdrawn; otherwise disabled with the reason as the note under the table. A `BOQ_NOT_GENERATABLE` answer still shows through `errorMessage`. On success: `refreshBoqs`, then navigate to `revision=<new id>` with the view keys kept, so the user lands on what was just frozen.
- Stale. `latestBoq.stale` from `GET /projects/:id` (new; see Gaps). It flags the latest revision only; older revisions carry no flag.

### Empty, loading and error states

- Working copy with no lines: "No products selected yet. Add some to price this project." and Add products. The controls stay.
- Nothing left after filters or search: "No line matches these filters." and Clear all.
- No revisions: ~~"No bill of quantities yet. Generate one once the products are set." on the BOQs tab.~~ The strip lists the working copy and a muted "No revisions yet".
- Revision selected and `GET /boqs/:id` pending: strip and controls stay, the body reads "Loading revision N…"; the previous source's lines are not shown.
- `GET /boqs/:id` fails: a `status-bad` note with `errorMessage`; the strip still switches source.
- A quantity `PUT` or a × fails: a `status-bad` note under the controls (`useAsyncAction`); the field shows the saved quantity again.
- Unknown `revision`: as absent. Bad view keys: per the URL contract.

### Gaps

- Canonical spaces are seeded. `apps/api/src/db/seed-data/spaces.yaml` and `seedSpaces` in `seed.ts` landed in 69b3aa9; the canvas note "canonical spaces are not seeded" is out of date. `GET /spaces` is empty only on a database that never ran `pnpm db:seed`.
- No move-between-spaces endpoint. Moving a line is two writes (`DELETE` the old row, then `PUT` the new one, as the picker does) and can half-fail, leaving the line in neither or both spaces. The views offer no move in this pass; the picker stays the place. Deferred: `PATCH /projects/:id/items/:itemId { spaceId }` over the surrogate `id`, one write.
- The client-side filters are not shareable in a link, and that stays. The URL carries exactly what the file honours; the export ignores Show, Category, Supplier, Space and Search, so a link carrying them would promise a file the server does not produce. Their counts and option lists also come from the loaded lines, so a shared filter can name a value the other copy no longer has.
- `GET /projects/:id` has no `latestBoq`; only `GET /projects` composes it, so the detail page cannot show "Changed since revision N" or "Stale" today. The detail route gains `latestBoq: BoqProjectSummary | null` from `boqSummaries([id])`, the way the list route does. "Backend needs nothing new" holds for the picker and the views; this one line is the exception. The alternative, loading the latest revision eagerly and comparing lines on the web, would duplicate `lineKey` and `sameLines` from `boq.service.ts` and drift from them.
- The canvas draws 13 columns; the contract has 10. `#`, Image and Share are screen-only and "Color" is `options`. Letting the three be toggled would put screen-only ids into `columns`, which the API would then have to ignore; they are fixed instead.

### Out of scope for this pass

- Moving a line between spaces, renaming or removing project spaces from the views.
- Sharing or persisting the client-side filters and search.
- A sort control in the gallery; multi-select filters; column reordering or widths.
- A stale flag on revisions older than the latest; a diff between two revisions.
- The chart in the gallery view; printing; a phone layout for the table beyond horizontal scroll.
- Product-level "suitable for" spaces; curated colour palette.

## Open

- ~~`group_by` values for the BOQ tab (candidates from the frozen fields: space, supplier, category, colour) and whether the products tab gets the same Columns / Arrange-by controls.~~
  ~~`group_by` is `space | supplier | category | color` (plan-level call 10). Whether the products tab gets the same Columns / Arrange-by controls stays open.~~
  `group_by` is `space | supplier | category | color` (plan-level call 10). The working copy gets the same Columns / Arrange-by controls, in the same tab (see One tab).
- Product-level "suitable for" spaces hint.
- Curated colour palette.

## Implementation plan

~~Backend, shared schemas and api-client types only. Existing admin/web callers are adapted to new payload shapes so both apps keep compiling; no new screens or controls, except `UiColorPicker` (slice 6).~~
Slices 1–6 are backend, shared schemas and api-client types only, with existing admin/web callers adapted so both apps keep compiling and no new screens except `UiColorPicker`. Slices 7–10 are the screens: the Project views section above, in `apps/web`, plus one route change in `apps/api`. Each slice is a vertical cut: migration → zod → service → route → api-client types → integration tests, runnable and checked before the next one starts. Migrations always come from `pnpm db:generate` in `apps/api`; data backfills use `pnpm db:generate --custom` (precedent: `drizzle/0007_seed-platform-settings.sql`).

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
- `?groupBy=space` csv prepends `group`; xlsx has one header row per space, ~~`Unassigned`~~ `No space` last, subtotals summing to the grand total.
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

### Slice 7 — Line model, view helpers, `latestBoq` on the detail

Build:
- `apps/web/app/utils/lines.ts`: `LineView`, `toLineView` for `ProjectItem` (with index) and `BoqItem`, the three Show predicates.
- `packages/types/src/boq/utility.ts`: `groupedColumn(groupBy)`, `visibleColumns(view)`.
- `apps/web/app/composables/useBoqView.ts`: `view` (parsed, defaulted) and `write(patch)` (merge, drop defaults, keep `tab` and `revision`, `router.replace`).
- `GET /projects/:id` composes `latestBoq` from `boqSummaries([id])`; api-client rebuilt.

Acceptance criteria:
- `toLineView` of a `ProjectItem` with `price: null` gives `unitPrice 0`, `price null`, `key variantId:`; with a space, `key variantId:spaceId`. Of a `BoqItem` with `current: null` gives `withdrawn true`, `imageUrl null`; with `current.status published` and an image, `withdrawn false` and that URL.
- A withdrawn priced line satisfies Priced and No longer available; an unpriced published line satisfies Unpriced only.
- `visibleColumns({ columns: BOQ_COLUMNS, groupBy: 'space' })` omits `space`; with `groupBy: 'color'` returns all ten; `name` and `lineTotal` survive any input.
- On `?tab=boq&revision=x`, `write({ groupBy: 'space' })` yields `?tab=boq&revision=x&groupBy=space`; `write({ columns: BOQ_COLUMNS })` removes `columns`; `write({ sort: BOQ_DEFAULT_SORT })` removes `sort`; `?columns=bogus` reads as `BOQ_DEFAULT_VIEW`.
- `GET /projects/:id` returns `latestBoq null` before any revision; `stale false` right after `POST …/boqs`; `stale true` after `PUT …/items/:variantId { quantity: 3 }`; renaming a space leaves it `false` (`projects.test.ts`, Bun).

### Slice 8 — The tab, the controls and the BOQ table over the working copy

Build:
- `ProjectBoqTab` and the tab rename with aliases in `index.vue`; the two `?tab=boq` link targets. `ProjectProductsTab` is deleted here; `ProjectBoqsTab` stays reachable through `?tab=boqs` until slice 10.
- `ProjectLineControls`, `ProjectColumnsMenu`, `ProjectLineTable`, `ProjectLineSummary`; `steppers` on `ProjectQuantityField`.
- Until slice 9, `view=gallery` renders the table.

Acceptance criteria:
- `?view=boq&groupBy=space` shows one header row per space with ~~`Unassigned`~~ `No space` last, its subtotal on the right of the header row, subtotals summing to the grand total; the Space column is absent and the Columns menu lists it as "Grouped", disabled.
- `?columns=sku,quantity` shows `#`, Image, Product · variant, SKU, Qty, Line total, Share; the button reads "4 of 10"; Product · variant and Line total cannot be unchecked; Reset removes `columns` from the URL.
- Clicking "Unit price" writes `sort=unitPrice:asc`, again `unitPrice:desc`, a third time removes `sort`; ascending, an unpriced line comes first.
- Changing a Qty cell to 3 and leaving it sends one `PUT …/items/:variantId { quantity: 3, spaceId: <that row's space> }`; typing `0` sends nothing and shows the invalid state; × on the Kitchen row sends `DELETE …?spaceId=<kitchen>` and the no-space row of the same variant survives.
- With one withdrawn line Generate is disabled and the note under the table names it; with an unpriced line the note reads "… without a price".
- Arrange by None hides the chart; the three tiles stay; "Materials total" equals the grand total row.
- `?tab=products` opens the Bill of quantities tab; the tab count equals `items.length`; "Save products" in the picker returns to `?tab=boq`; the page header shows no Generate button; `pnpm typecheck` passes in `apps/web`.

### Slice 9 — Gallery view and the client-side filters

Build: `ProjectLineGallery`, `ProjectLineCard`, `ProjectLineFilters`, `useLineFilters`.

Acceptance criteria:
- The default URL shows the gallery; `?groupBy=supplier` gives the same groups, order and subtotals as the table, as section headings `label · n lines · subtotal`.
- A priced card reads supplier, space, name, `sku · label`, `24,500 / m²`, a quantity field with `m²`, `Line 931,000`; a piece-priced card shows no `/ pc` suffix; an unpriced card reads "No price yet" and "—"; a withdrawn card shows the placeholder and "No longer available" and is listed under Show=All and, when priced, Show=Priced.
- Show counts in the option text: All = every line, Priced = lines with a price, Unpriced = lines without, No longer available = withdrawn lines; picking Unpriced hides every priced line in both views and adds a `Show: Unpriced` chip.
- Space=Kitchen and Supplier=Kivu Ceramics show two chips under "Filtering by"; Clear all empties both and the search; the URL does not change while filtering.
- Filtering to nothing shows "No line matches these filters." with Clear all; the total row reads the visible total and "n of m lines".
- A reload keeps `view`, `columns`, `groupBy`, `sort` and loses the filters and the search.

### Slice 10 — Frozen revisions in the same shell

Build:
- `ProjectRevisionStrip` with Generate in it; `ProjectBoqsTab` deleted and `?tab=boqs` aliased to `?tab=boq`.
- The revision load keyed on `revision`, the frozen banner, the stale flag, Export XLSX / CSV through `exportUrl` with `visibleColumns`, the withdrawn note.

Acceptance criteria:
- `?revision=<id>` sends one `GET /boqs/:id`; Add products, the quantity fields and × are gone; the banner reads "Revision 2 · Generated 12 Aug 2026, 09:14 · 11 lines · 5,724,000 RWF" and the frozen sentence; the same `groupBy` and `columns` apply as on the working copy.
- After a `PUT` on the working copy, the working copy row reads "Changed since revision 2", the latest revision's banner shows "Stale · changed since", and revision 1 shows neither.
- With `?groupBy=space&columns=sku,quantity`, Export XLSX requests `/boqs/:id/export?format=xlsx&columns=sku,quantity&groupBy=space`; the sheet's sections match the screen's groups and carry no Space column.
- A revision whose product was withdrawn since shows the placeholder, the flag and the note; Show=No longer available lists it; the csv still contains it.
- Generate revision 3 from the working copy lands on `?revision=<new id>` with `groupBy` intact and the strip lists three revisions; with no revision yet the strip reads "No revisions yet".
- An unknown `revision` shows the working copy; a failing `GET /boqs/:id` shows the error note and the strip still switches source.
- No reference to `ProjectProductsTab` or `ProjectBoqsTab` remains; `?tab=boqs&revision=<id>` opens that revision in the new tab; `pnpm typecheck` passes in `apps/web`.

## Test approach

Integration tests through `app.request()` with `loginAs`/`loginAsAdmin` and `resetDatabase`, real Postgres, no mocks; run with `pnpm test` in `apps/api` (Bun runtime). Each slice extends the module test file it touches (`taxonomy.test.ts`, `catalogue.test.ts`, `projects.test.ts`, `boq.test.ts`); the view functions in `@forge-kivu/types` get unit tests in `packages/types`. `pnpm db:seed` is run at the end of slices 1–3 as a smoke test of the yaml changes.

Slices 7–10: the pure pieces (`toLineView`, the Show predicates, `visibleColumns`, `groupedColumn`, the query writer in `useBoqView`) get vitest unit tests in `apps/web/test` and `packages/types`; `latestBoq` extends `projects.test.ts` under Bun. The screens are checked by hand against the running API with the browser's network panel, as `web-add-to-project-spec.md` does, since `apps/web` has no component harness.

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
12. ~~One tab or two is recommended as A but left to the user; nothing below assumes it.~~ Ruled by the user: one tab.
13. `#`, Image and Share are fixed on screen and outside `columns`, so the URL and the file keep the same ten ids.
14. The grouped column leaves the rows and the file through `visibleColumns` on the web, not through a server change.
15. The column id and header is `options`; the canvas's "Color" is superseded.
16. ~~Group labels come from `groupLabel` (`Unassigned`, `No colour`), on screen and in the file; the canvas's "No space" is superseded, and the card's space eyebrow uses the same word.~~ Group labels come from `groupLabel` with a per-dimension fallback (`No space`, `No supplier`, `No category`, `No colour`), on screen and in the file; the boards' "No space" wins and the export label changes with it.
17. Sort is set from the table headers only; the gallery follows the URL.
18. Column defaults do not depend on the source; the artboards' different selections are not a rule.
19. Filters survive a source change and never enter the URL.
20. Quantity commits on blur or Enter, not per keystroke; steppers show at every width on a card and in a cell.
21. `latestBoq` on `GET /projects/:id` is the one backend change.
22. Generate stays enabled when nothing changed since the last revision; stale is informational.
23. After Generate the tab lands on the new revision.
24. The chart hides when Arrange by is None; the tiles stay. The gallery has no summary.
25. `tab=products` and `tab=boqs` alias to `tab=boq` instead of falling back to overview.
26. The source picker is a labelled select, not an underline strip (raised from a canvas comment; the canvas still draws the strip and is being brought in line separately).
27. ~~Category, Supplier and Space are inline option lists like Show.~~ ~~They are selects; only Show is inline (raised from a canvas comment, matching the top-left board).~~ All four filters are selects; the inline Show was a distinction the design never drew.
28. The card's × sits in its header after the space eyebrow; the artboards draw no remove control on the card, and the canvas note "× to removeItem" is the only source.
29. The columns trigger is styled as a select ("8 of 10" with a chevron) under a "Columns" caption, as the Frozen artboard draws it; the menu greys the two locked rows instead of labelling them.
30. The four filter selects are captioned fields with a plain `All` first option (raised from a defect in the boards: the dimension lived in the option text and disappeared once chosen; the boards are updated). The Label is tied to the select with `for`/`id`, the same association Arrange by uses, rather than `aria-labelledby`.
