# Media Module Spec

## Decisions

1. **Media owns all object-storage access.** No other module imports the S3 client. Ever.
2. **One table: `media`.** Other modules store media ids. Linking tables such as `product_images` (productId, mediaId, sortOrder) belong to the module that owns the products — not to Media. Media does not know who uses it, which keeps it reusable for product photos, supplier logos, and future attachments.
3. **Uploads use presigned URLs** — a temporary, signed link that lets the browser upload the file straight to object storage. The API never receives file bytes. The flow is three steps: request an upload, upload directly to storage, confirm.
4. **A `status` column (`pending` → `ready`) tracks the flow.** A row is `pending` until the client confirms and the service verifies the object actually exists with the expected size. Without this column, real media and abandoned uploads are indistinguishable.
5. **Verification at confirm uses a HEAD request** — a metadata-only call to storage that returns the object's size without downloading it.
6. **Serving is public and direct.** The bucket is public-read (or fronted by a CDN). The service exposes a pure `getPublicUrl(key)` that other modules call when building responses. No presigned download links, no image bytes proxied through the API.
7. **No module middleware.** Upload routes use the existing `auth` middleware; delete is guarded by the `/admin` namespace mount. Rules like "only ready media can be attached to a product" are service-level checks in the consuming module.
8. **File rules:** allowed types are jpeg, png, and webp; a maximum size applies. Both are enforced twice — by zod when the upload is requested, and against the real object at confirm.
9. **Deferred:** a cleanup job for abandoned `pending` rows and their objects, and image resizing/thumbnails. The `status` column is what makes the cleanup job possible later.

## Module layout

```
apps/api/src/modules/media/
├── media.tables.ts    media
├── media.schemas.ts   zod: create upload request
├── media.service.ts   all logic; the only interface other modules use
└── media.routes.ts    thin Hono sub-app
```

## Table

```
media
├── id            uuid pk
├── key           text unique (object-storage key)
├── mimeType      text
├── sizeBytes     int
├── status        'pending' | 'ready'
├── uploadedById  fk → users.id
└── createdAt
```

## Service surface

```
createUpload(userId, { mimeType, sizeBytes })  → { mediaId, uploadUrl }
confirmUpload(mediaId, userId)                 → media
getReady(mediaId)                              → media | null   (for other modules)
getPublicUrl(key)                              → string
remove(mediaId)                                  deletes object and row
```

## Routes

```
POST   /media               request an upload (logged in)
POST   /media/:id/confirm   confirm the upload (logged in)

DELETE /admin/media/:id
```

Admin routes follow `artifacts/api-route-conventions.md`: they live under the
`/admin` namespace, guarded once at the mount. The module exports two Hono
sub-apps — `mediaRoutes` and `adminMediaRoutes`, which carries no auth middleware
of its own.

The upload routes stay on `/media`: they need a session, but any logged-in user
may call them. `/admin` marks the role, not merely "needs a login".

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Request an upload

Build: `media` table (migration via `pnpm db:generate`), zod schema with allowed types and max size, `createUpload`, `POST /media`.

Acceptance criteria:
- A logged-in request with a valid type and size returns 201 with `{ mediaId, uploadUrl }`, and the database row is `pending`.
- A disallowed type or an oversized request returns 400. No session returns 401.
- Uploading a file to the returned `uploadUrl` with curl succeeds, and the object appears in the bucket under the row's `key`.

### Step 2 — Confirm the upload

Build: `confirmUpload` — HEAD the object, compare size, flip status to `ready`.

Acceptance criteria:
- After a real upload, confirm returns the media record with status `ready`.
- Confirming without having uploaded returns an error and the row stays `pending`.
- Confirming when the uploaded size does not match the declared size returns an error.
- Confirming media uploaded by a different user returns 404.
- Confirming an already-ready record returns it again unchanged (safe to retry).

### Step 3 — Serve and delete

Build: `getPublicUrl`, `getReady`, `DELETE /admin/media/:id`.

Acceptance criteria:
- The public URL of ready media loads in a browser.
- Delete as admin removes both the database row and the object from the bucket.
- Delete as a basic user returns 403.

## Test approach

Same as the auth module: integration tests through `app.request()` with the `loginAs` helper, real Postgres test database. Storage calls run against the local S3-compatible service used in development.
