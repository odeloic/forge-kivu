# Workshop Catalogue API Spec

Backend changes in the `catalogue` module required by the workshop UI. Extends `catalogue-module-spec.md`; every decision there still holds unless superseded below.

## Decisions

1. **A variant-level public list endpoint is added.** The project picker adds items with `PUT /projects/:id/items/:variantId`, so it needs `variantId` per row. `GET /catalogue/products` returns `ProductListItem`, which carries `priceFrom` and no variant identity; the only variant-level read today is `GET /catalogue/products/:supplierSlug/:productSlug`, one product per request.
2. **The variant list is its own route, not a flag on the product list.** `GET /catalogue/products` feeds the shop grid and is paginated by product; returning variants would change what a page of 20 means. Separate route, separate page size.
3. **Published products only, same as the product list.** A variant of a draft or `not_available` product is rejected by `setItem` (`projects-module-spec.md` decision 8), so listing one would offer an action that always fails.
4. **Text search is `ilike` on product name and variant sku, not full-text.** The picker needs to find a known product by name or code; there is no ranking or stemming requirement. Deferred: a tsvector column and a GIN index if the catalogue outgrows a sequential scan.
5. **`q` is added to the existing product list query too.** The same search box appears in the shop; two search implementations would drift.
6. **`VariantRef` gains `category`, `supplier` and `imageUrl`.** The projects module passes them straight through to the products tab (`workshop-projects-api-spec.md` decision 4). Loading them there would mean projects querying catalogue tables, which `projects-module-spec.md` decision 1 forbids.
7. **A variant's image falls back to its product's first media.** `product_variants.imageMediaId` is nullable and rarely set; a row with no thumbnail at all reads as a missing product.

## Types

```
VariantListItem = {
  variantId: string
  sku:       string | null
  price:     number | null
  label:     string | null                 e.g. "Charcoal / 2.5 m"
  product:   { id, name, slug, status }
  supplier:  { id, name, slug }
  category:  { id, name, slug }
  imageUrl:  string | null
}

VariantPage = { items: VariantListItem[], page, pageSize, total }

VariantRef = {
  id, sku, price, label,
  product:  { id, name, status },
  supplier: { id, name, slug },            new
  category: { id, name, slug },            new
  imageUrl: string | null,                 new
}
```

## Service surface

```
listPublishedVariants(query)   → variantPage        new
getVariantRefs(variantIds)     → map<id, variantRef>  changed: three added fields
getVariantRef(variantId)       → variantRef | null    changed: same
listPublished(query)           → productPage          changed: query accepts q
```

## Routes

```
GET /catalogue/variants?q=&category=&supplier=&page=   new
GET /catalogue/products?q=...                          changed: q added
```

`q`: trimmed, 1–100 characters, optional. Matches `products.name` or `product_variants.sku`, case-insensitive, substring.

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Enriched variant refs

Build: supplier, category and image joins in `getVariantRefs`, the fallback from `product_variants.imageMediaId` to the product's first media row, and the `VariantRef` type change.

Acceptance criteria:
- `GET /projects/:id` on a project with items returns `category`, `supplier` and `imageUrl` per item (verified from the projects side).
- A variant with `imageMediaId` set returns that image; unset returns the product's first media by `displayOrder`; a product with no media returns `null`.
- `getVariantRefs` is still one round trip for the whole id list — ten ids do not produce ten queries.
- A variant of a `not_available` product still resolves, with `product.status` unchanged.

### Step 2 — Text search on the product list

Build: `q` in `publicListQuerySchema`, the `ilike` condition in `publicConditions`.

Acceptance criteria:
- `GET /catalogue/products?q=cement` returns products whose name contains "cement" in any case.
- `q` combines with `category` and `supplier` — results satisfy all three.
- `q=` (empty) and a 101-character `q` return 400 from zod.
- `q` with `%` or `_` matches those characters literally, not as wildcards.
- Facets at `GET /catalogue/products/facets` are computed over the same filtered set.

### Step 3 — Variant list endpoint

Build: `listPublishedVariants`, `variantListQuerySchema`, the `GET /catalogue/variants` route.

Acceptance criteria:
- `GET /catalogue/variants?q=cement` returns one row per variant with `variantId`, `sku`, `price`, `label`, `supplier`, `category` and `imageUrl`.
- A product with three variants contributes three rows; a product with no options contributes one.
- Variants of draft and `not_available` products are absent.
- A variant with a null `price` is present, with `price: null` — the picker shows it and the client blocks BOQ generation.
- `page=2` returns the next page and the same `total`; `page=0` returns 400.
- The route is anonymous — no session cookie required.

## Test approach

Integration tests through `app.request()` against the real Postgres test database, no mocks. Existing catalogue helpers seed a published product with options, variants, a category, a supplier and media; one draft and one `not_available` product cover the exclusion cases.
