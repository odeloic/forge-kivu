# Taxonomy Module Spec

## Decisions

1. **Taxonomy owns the shared vocabulary: categories and spec attributes.** Both are defined once by the admin and used by every supplier's catalogue. They live in one module because they change rarely, have the same owner, and serve the same purpose: making products comparable across suppliers.
2. **One shared category tree.** Categories nest through a `parentId` self-reference, any depth. Per-supplier categories were rejected: they would break browsing and filtering across suppliers.
3. **Spec attribute names are shared, not per supplier.** Otherwise "Material" and "material" become two different filters. An attribute is a name plus an optional unit ("Width", "cm").
4. **Attributes are not tied to categories.** Any attribute can be used on any product. Deferred: per-category attribute sets (a `category_attributes` link table) if admins want suggested specs per category.
5. **Deleting a category or attribute is blocked while in use.** The foreign keys from the catalogue module are `restrict`; the service surfaces the failure as a conflict error. Reassigning products is an explicit admin action, never a side effect.
6. **Slugs are globally unique** — for categories and attributes both — because they appear in public URLs and filter query strings.
7. **A category cannot be moved under its own descendant.** The service walks the parent chain before an update. Without this check one bad request makes the tree unreadable.

## Module layout

```
apps/api/src/modules/taxonomy/
├── taxonomy.tables.ts    categories, spec_attributes
├── taxonomy.schemas.ts   zod: category create/update, attribute create/update
├── taxonomy.service.ts   all logic; the only interface other modules use
└── taxonomy.routes.ts    thin Hono sub-app
```

## Tables

```
categories
├── id         uuid pk
├── parentId   fk → categories.id (nullable; null = top level)
├── name       text
├── slug       text unique
├── sortOrder  int
└── createdAt

spec_attributes
├── id         uuid pk
├── name       text unique
├── slug       text unique
├── unit       text (nullable, e.g. "cm")
└── createdAt
```

## Service surface

```
createCategory({ name, slug, parentId?, sortOrder? })  → category
updateCategory(id, patch)                              → category
removeCategory(id)                                       fails with conflict while products use it
getTree()                                              → nested category tree
getCategoryById(id)                                    → category | null   (for other modules)

createAttribute({ name, slug, unit? })                 → attribute
updateAttribute(id, patch)                             → attribute
removeAttribute(id)                                      fails with conflict while in use
listAttributes()                                       → attribute[]
```

## Routes

```
GET    /categories                    public: full tree
GET    /spec-attributes               public: flat list

POST   /admin/categories
PATCH  /admin/categories/:id
DELETE /admin/categories/:id

POST   /admin/spec-attributes
PATCH  /admin/spec-attributes/:id
DELETE /admin/spec-attributes/:id
```

Admin routes follow `artifacts/api-route-conventions.md`: they live under the
`/admin` namespace, guarded once at the mount. The module exports two Hono
sub-apps — `taxonomyRoutes` (public) and `adminTaxonomyRoutes`, which carries no
auth middleware of its own.

There is no admin read route: the public tree and attribute list are complete, so
the admin screen reads the same URLs the storefront does.

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Category tree

Build: `categories` table (migration via `pnpm db:generate`), zod schemas, category service functions, public `GET /categories` and the three `/admin/categories` routes.

Acceptance criteria:
- Admin creates "Tiles", then "Floor Tiles" with `parentId` pointing at it; `GET /categories` returns the nested shape with children ordered by `sortOrder`.
- Creating with a used slug returns 409; a `parentId` that does not exist returns 400.
- Moving "Tiles" under "Floor Tiles" (its own child) returns 400 and changes nothing.
- A basic user gets 403 on writes; anonymous `GET /categories` returns 200.
- Deleting a category that has children returns 409 (children reference it).

### Step 2 — Spec attributes

Build: `spec_attributes` table (migration via `pnpm db:generate`), attribute service functions, public `GET /spec-attributes` and the three `/admin/spec-attributes` routes.

Acceptance criteria:
- Admin creates "Material" (no unit) and "Width" with unit "cm"; anonymous `GET /spec-attributes` returns both.
- Creating "material" when "Material" exists returns 409 — name uniqueness is case-insensitive.
- A basic user gets 403 on writes.
- The "blocked while in use" delete case is verified in the catalogue spec, step 3, once the foreign key exists.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper, real Postgres test database, no mocks. Tree assertions compare the full JSON shape, not row counts.
