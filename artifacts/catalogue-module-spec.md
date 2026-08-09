# Catalogue Module Spec

## Decisions

1. **Catalogue owns everything about items:** products, options, option values, variants, spec values, and media links. It references suppliers, taxonomy, and media by id and talks to them only through their services.
2. **Every product belongs to one supplier and one category.** Both foreign keys are required — no orphan items. Multi-category was rejected for now; loosening later means one link table, no data loss.
3. **Variants are built from structured options.** A product defines option types ("Color", "Size") and their values; each variant is one combination. Chosen over a flat variant list because public filtering needs structure. A combination is unique per product.
4. **Every product has at least one variant.** A product without options gets one default variant (no option values) at creation. This keeps price in exactly one place: the variant. The default variant is replaced when real variants are defined.
5. **Price lives on the variant and is optional.** One numeric column. Currency is a single app-level setting, not a database column. No stock tracking — availability is handled outside the system.
6. **Specs are structured values on the product**, keyed by the shared attributes from taxonomy. Values are stored as text and filtered by equality. Deferred: numeric range filters (the `unit` on the attribute is what makes them possible later).
7. **Draft/published status gates public exposure.** Public endpoints serve only published products of visible suppliers. Draft is the default.
8. **Writes to options, variants, specs, and media are replace-style (`PUT`).** The admin screen submits the whole set; the service diffs and applies. Granular per-row routes were rejected: they multiply endpoints and invite half-applied states.
9. **`product_media` lives here, not in media** — per the media spec, linking tables belong to the module that owns the products. Only `ready` media can be attached, checked through `media.getReady`.
10. **Deleting a product cascades within the module** (options, values, variants, specs, media links). Media rows and files are untouched — the media module owns those.
11. **Product slugs are unique per supplier.** The public URL is `/catalogue/products/:supplierSlug/:productSlug`, so two suppliers may both have "white-cement".

## Module layout

```
apps/api/src/modules/catalogue/
├── catalogue.tables.ts    products, product_options, product_option_values,
│                          product_variants, variant_option_values,
│                          product_specs, product_media
├── catalogue.schemas.ts   zod: product create/update, options, variants, specs, media
├── catalogue.service.ts   all logic; the only interface other modules use
└── catalogue.routes.ts    thin Hono sub-app
```

## Tables

```
products
├── id           uuid pk
├── supplierId   fk → suppliers.id (restrict)
├── categoryId   fk → categories.id (restrict)
├── name         text
├── slug         text            unique (supplierId, slug)
├── description  text (nullable)
├── status       'draft' | 'published'
├── createdAt
└── updatedAt

product_options                     product_option_values
├── id         uuid pk              ├── id         uuid pk
├── productId  fk (cascade)         ├── optionId   fk (cascade)
├── name       text                 ├── value      text
└── sortOrder  int                  └── sortOrder  int

product_variants                    variant_option_values
├── id            uuid pk           ├── variantId      fk (cascade)
├── productId     fk (cascade)      └── optionValueId  fk (cascade)
├── sku           text (nullable)       pk (variantId, optionValueId)
├── price         numeric (nullable)
├── imageMediaId  fk → media.id (nullable)
└── sortOrder     int

product_specs                       product_media
├── productId    fk (cascade)       ├── productId  fk (cascade)
├── attributeId  fk → spec_attributes.id (restrict)
├── value        text               ├── mediaId    fk → media.id
└── pk (productId, attributeId)     └── sortOrder  int
                                        pk (productId, mediaId)
```

## Service surface

```
createProduct({ supplierId, categoryId, name, slug, description? })  → product (with default variant)
updateProduct(id, patch)                                             → product
removeProduct(id)
publish(id) / unpublish(id)                                          → product
setOptions(productId, options)                 replace option types and values
setVariants(productId, variants)               replace variants; each names its option value ids
setSpecs(productId, specs)                     replace [{ attributeId, value }]
setMedia(productId, mediaIds)                  replace, order = array order
getForAdmin(id) / listForAdmin({ supplierId?, status? })
listPublished({ category?, supplier?, spec?, page? })                → paged public shape
getPublished(supplierSlug, productSlug)                              → product | null
```

## Routes

```
GET /catalogue/products                              public list
    ?category=<slug>&supplier=<slug>&spec.<attribute-slug>=<value>&page=
GET /catalogue/products/:supplierSlug/:productSlug   public detail

POST   /admin/products                 PUT /admin/products/:id/options
GET    /admin/products                 PUT /admin/products/:id/variants
GET    /admin/products/:id             PUT /admin/products/:id/specs
PATCH  /admin/products/:id             PUT /admin/products/:id/media
DELETE /admin/products/:id
POST   /admin/products/:id/publish
POST   /admin/products/:id/unpublish
```

Admin routes follow `artifacts/api-route-conventions.md`: they live under the
`/admin` namespace, guarded once at the mount. The module exports two Hono
sub-apps — `catalogueRoutes` (public, mounted at `/catalogue`) and
`adminCatalogueRoutes`, which carries no auth middleware of its own.

The split is what makes decision 7 enforceable: `/admin/products` serves drafts,
`/catalogue/products` never does, so no handler has to branch on the session.

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Create a product with its default variant

Build: `products` and `product_variants` tables (migration via `pnpm db:generate`), `createProduct`, `updateProduct`, `POST /admin/products`, both admin `GET` routes.

Acceptance criteria:
- Admin creates a product: 201, one `draft` product row and one variant row with no option values.
- Unknown `supplierId` or `categoryId` returns 400. A basic user gets 403.
- The same slug under two different suppliers succeeds; under the same supplier returns 409.
- Deleting that supplier now returns 409 (verifies the restrict foreign key from the suppliers spec).

### Step 2 — Options and variants

Build: `product_options`, `product_option_values`, `variant_option_values` tables (migration via `pnpm db:generate`), `setOptions`, `setVariants`, both `PUT /admin/products/:id/*` routes.

Acceptance criteria:
- Define Color (Red, Blue) and Size (60x60, 30x30); submit four variants with prices; the default variant is gone and the four combinations are queryable.
- A variant referencing an option value id from another product returns 400.
- Two variants with the same combination return 400; nothing is applied.
- A variant covering only Color when Size exists returns 400 — every option must be chosen.
- Submitting an empty variant list returns 400 — a product never has zero variants.

### Step 3 — Specs and media

Build: `product_specs` and `product_media` tables (migration via `pnpm db:generate`), `setSpecs`, `setMedia`, both `PUT /admin/products/:id/*` routes.

Acceptance criteria:
- Set Material = Ceramic and Width = 60; the admin detail returns both with attribute names and units.
- An unknown `attributeId` returns 400. Deleting an in-use attribute in taxonomy now returns 409.
- Attaching media that is `pending` or missing returns 400; nothing is applied.
- Re-submitting media ids in a new order changes `sortOrder` to match.

### Step 4 — Publish and browse publicly

Build: `publish`, `unpublish`, both routes, `listPublished` with filters and paging, `getPublished`, both public routes.

Acceptance criteria:
- A draft product is absent from the public list and its detail URL returns 404, even with an admin session.
- After publish, an anonymous request finds it in the list and on `/catalogue/products/:supplierSlug/:productSlug` with variants, specs, and media URLs.
- Hiding the supplier removes all its published products from public responses.
- `?category=floor-tiles` returns products of that category and its descendants; `?spec.material=Ceramic` narrows to matching products; combined filters intersect.
- Page size is capped; page 2 returns the next slice and a total count.

### Step 5 — Delete a product (can be deferred; nothing depends on it)

Build: `removeProduct`, `DELETE /admin/products/:id`.

Acceptance criteria:
- Delete removes the product and its options, values, variants, specs, and media links in one transaction.
- The media rows still exist and their files still load — only the links are gone.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper, real Postgres test database, no mocks. A shared helper seeds one supplier, a small category tree, and two attributes, since almost every test needs them.
