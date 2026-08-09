# Suppliers Module Spec

## Decisions

1. **Suppliers owns the supplier space.** It owns the `suppliers` table. Other modules store a `supplierId` column and call this service — they never query the table directly.
2. **Admin-only management.** Creating, editing, hiding, and deleting supplier spaces is guarded by `requireRole('admin')`. There is no supplier self-service.
3. **This module is the boundary for future ownership handover.** Every access rule about "who may touch this supplier's data" lives in this service. Deferred: a nullable `ownerUserId` column (fk → users.id) plus ownership checks, when a supplier space is handed to a user. The module boundary is what makes that a small change.
4. **A `visible` flag controls public exposure.** Hidden suppliers do not appear in public listings, and neither do their products. New suppliers start hidden so a space can be filled before going live.
5. **The logo is a media id.** The media module owns the file; this module stores `logoMediaId` and builds the URL with `media.getPublicUrl` when responding.
6. **Slugs are globally unique** and used in public URLs (`/suppliers/:slug`). Set at creation, editable by admin.
7. **Delete is blocked while the supplier has products.** The foreign key from `products` (catalogue module) is `restrict`, and the service surfaces the failure as a conflict error. No cascade deletes across module boundaries.

## Module layout

```
apps/api/src/modules/suppliers/
├── suppliers.tables.ts    suppliers
├── suppliers.schemas.ts   zod: create, update
├── suppliers.service.ts   all logic; the only interface other modules use
└── suppliers.routes.ts    thin Hono sub-app
```

## Table

```
suppliers
├── id           uuid pk
├── name         text
├── slug         text unique
├── description  text (nullable)
├── logoMediaId  fk → media.id (nullable)
├── visible      boolean, default false
└── createdAt
```

## Service surface

```
create({ name, slug, description?, logoMediaId? })  → supplier
update(id, patch)                                   → supplier
listVisible()                                       → supplier[]        (public)
listAll()                                           → supplier[]        (admin)
getBySlug(slug)                                     → supplier | null   (visible only)
getById(id)                                         → supplier | null   (for other modules)
remove(id)                                            fails with conflict while products exist
```

## Routes

```
GET    /suppliers               public: visible suppliers only
GET    /suppliers/:slug         public: one visible supplier

GET    /admin/suppliers         every supplier, hidden included
POST   /admin/suppliers
PATCH  /admin/suppliers/:id
DELETE /admin/suppliers/:id
```

Admin routes follow `artifacts/api-route-conventions.md`: they live under the
`/admin` namespace, guarded once at the mount. The module exports two Hono
sub-apps — `supplierRoutes` (public) and `adminSupplierRoutes`, which carries no
auth middleware of its own.

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Create and list as admin

Build: `suppliers` table (migration via `pnpm db:generate`), zod schemas, `create`, `listAll`, `POST /admin/suppliers`, `GET /admin/suppliers`.

Acceptance criteria:
- Admin creates a supplier via curl: 201, row in the database with `visible = false`.
- Creating with an already-used slug returns 409, caught from the unique constraint, not a check-then-insert.
- A basic user gets 403; no session gets 401.
- `GET /admin/suppliers` includes the hidden supplier just created, and rejects a basic user with 403 and an anonymous caller with 401.

### Step 2 — Public reads

Build: `listVisible`, public `GET /suppliers` and `GET /suppliers/:slug`, logo URL built with `media.getPublicUrl`.

Acceptance criteria:
- An anonymous request to `GET /suppliers` returns only suppliers with `visible = true`.
- `GET /suppliers/:slug` for a hidden supplier returns 404.
- A supplier with a logo returns a `logoUrl` that loads in a browser; one without returns `logoUrl: null`.

### Step 3 — Update and delete

Build: `update`, `remove`, `PATCH /admin/suppliers/:id`, `DELETE /admin/suppliers/:id`.

Acceptance criteria:
- Setting `visible` to true makes the supplier appear in the public list on the next request; setting it back hides it again.
- Setting `logoMediaId` to media that is not `ready` returns 400 (checked through `media.getReady`).
- Delete removes the row. The "blocked while products exist" case is verified in the catalogue spec, step 1, once the foreign key exists.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper, real Postgres test database, no mocks. Logo cases reuse the media test helpers to produce a `ready` media row.
