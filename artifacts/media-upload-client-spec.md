# Media Upload Client Spec

~~Status: implemented.~~
Status: implemented, but **the admin app cannot reach `POST /media`** — see
"Session audience blocks admin uploads" below.

The browser half of the media module: how `apps/admin`, `apps/web` and any
future app turn a dropped file into a `ready` media id.

## What already exists

The upload contract is done and does not need to change — though this spec does
touch two server-side files, both refactors with no behavioural change: the
limits move out of `media.schemas.ts` into `packages/types`, and three
client-only codes join `packages/types/src/errors.ts`.

`POST /media` inserts a `pending`
row and returns `{ mediaId, uploadUrl }`, a presigned PUT valid for 900 seconds.
`POST /media/:id/confirm` HEADs the object, compares `ContentLength` against the
declared size, and flips the row to `ready`. Confirm is idempotent: calling it on
a `ready` row returns the row unchanged.

Nothing on the client needs to invent validation rules — jpeg/png/webp and a
10 MB ceiling are already enforced by zod at create and against the real object
at confirm. The client mirrors them only to fail fast.

## Decisions

1. **No upload library is necessary for this.** 

2. **`XMLHttpRequest` for the PUT, not `fetch`.** `fetch` cannot report upload
   progress: streaming a request body needs `duplex: 'half'` over HTTP/2, which
   Safari does not support. `xhr.upload.onprogress` is the only portable source
   of a percentage.

3. **The split follows the existing layers.** `nuxt-base` owns the orchestration
   because it owns the API client; `ui` owns the drop zone and the tile because
   it owns appearance.

4. **Limits live in `packages/types`.** `ALLOWED_MIME_TYPES` and
   `MAX_SIZE_BYTES` move out of `apps/api/src/modules/media/media.schemas.ts`
   into `packages/types/src/media.ts`, which the API imports back. Two copies of
   a number that must agree is a drift waiting to happen, and `types` is already
   a dependency of every app.

5. **A rejected file is a tile, not a swallowed error.** Files that fail
   client-side validation still enter the queue as `failed` items.

6. **Failures are per item.** There is no dialog-level error state. Each item
   carries its own `ErrorCode`, rendered on its tile, retried on its own.

7. **Presign lazily, one file at a time, at the head of the queue.** The URL
   lives 900 seconds; presigning twenty files up front would hand out URLs that
   expire before the queue reaches them.

8. **Concurrency 3.** Enough to saturate a link, few enough that per-tile
   progress still means something to watch.

9. **The composable stops at readiness.** It hands back `readyMediaIds`; the
   page decides what to attach them to. ~~The gallery dialog's "Add 4 images"
   button is a separate step calling `POST /admin/suppliers/:id/gallery`, which
   only needs `mediaId` now that `altText` is nullish. This keeps the same
   composable usable for a supplier logo, a featured image, and the project
   attachments the storefront will need later~~
   Actually this does not even make sense, if an image is uploaded as it's dropped, 
  and it's own loading state is reported on its won card, there is no need for the
  Add 4 images button (design issue, which you should ignore!) - the button here
would simply be redundant! My call!

10. **Partial success attaches what succeeded.** If three of five files upload,
    "Add 3 images" attaches those three; the two failed tiles stay in the dialog
    for retry.
11. **Removing an in-flight item aborts it.** One verb, not a `cancel` and a
    `remove`. The abandoned `pending` row is exactly the garbage the media
    spec's deferred cleanup job exists to collect.

12. **Retry asks the server what happened.** If the item already has a
    `mediaId`, retry calls confirm first; `UPLOAD_INCOMPLETE` means the bytes
    never landed, so it re-presigns and re-uploads. This uses the server's own
    verification instead of tracking URL expiry on the client, and confirm's
    idempotency makes it free to attempt.

13. **`@vueuse/core` in `packages/ui` only.** `useDropZone` and `useFileDialog`
    are worth not writing twice. `nuxt-base` does not take the dependency —
    object-URL lifecycle is two lines against state the composable already
    tracks explicitly, and `useObjectUrl` is shaped for a single ref, not an
    array. Imported by package name, not auto-imported, so neither layer has to
    own a module registration the other depends on.

14. **No queue length cap in version one.** The per-file 10 MB ceiling and the
    concurrency limit are the real guards. A "maximum 20 images" rule is a
    product decision the dialog can enforce when there is one.

## Layout

```
packages/types/src/
└── media.ts                 ALLOWED_MIME_TYPES, MAX_SIZE_BYTES

packages/nuxt-base/app/
├── utils/upload.ts          validateFile, putWithProgress   (pure, tested directly)
└── composables/useMediaUpload.ts   queue and state machine

packages/ui/app/components/
├── UiDropZone.vue           drag state, click to pick, emits File[]
└── UiUploadTile.vue         thumbnail, label, status text, progress, slots

apps/admin/app/components/
└── GalleryUploadDialog.vue  wires the three together, creates gallery items
```

Reaching the dialog also needed the gallery tab in `pages/suppliers/[slug].vue`,
which was a placeholder. It now lists the supplier's images, flags the ones
without alt text, and opens the dialog. Reordering, editing and removing gallery
items stay out of scope here.

## Shared limits

```ts
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number]
export const MAX_SIZE_BYTES = 10 * 1024 * 1024
```

`media.schemas.ts` imports and re-exports them so `media.service.ts` and the
existing tests are untouched.

## Error codes

Three client-only codes join `packages/types/src/errors.ts`:

```
FILE_TOO_LARGE        413   'This file is too large.'
FILE_TYPE_UNSUPPORTED 415   'Only JPEG, PNG and WebP images are allowed.'
UPLOAD_FAILED         400   'The file could not be uploaded.'
```

The API never emits them; they exist so `errorMessage()` stays the single
rendering path rather than growing a parallel union with its own message table.
The status numbers are inert for these three — only `toNuxtError` reads them,
and nothing throws these into a Nuxt error.

`UPLOAD_FAILED` covers a network failure or a non-2xx from object storage during
the PUT. `UPLOAD_INCOMPLETE` and `SIZE_MISMATCH` already exist and come back from
confirm.

The tile composes its own detail line — "Too large — 12.4 MB" — from the file
and the code; `errorMessage()` supplies the generic sentence.

## Composable surface

```ts
type UploadStatus =
  | 'queued'
  | 'requesting'
  | 'uploading'
  | 'confirming'
  | 'ready'
  | 'failed'

type UploadItem = {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  progress: number          // 0..1, bytes sent over file.size
  mediaId: string | null
  error: ErrorCode | null
}

const {
  items,          // Readonly<Ref<UploadItem[]>>
  counts,         // { total, ready, failed, pending }
  progress,       // byte-weighted aggregate, 0..1
  busy,           // any item still in flight
  readyMediaIds,  // string[]
  add,            // (files: Iterable<File>) => void
  retry,          // (id: string) => void
  remove,         // (id: string) => void
  clear,          // () => void
} = useMediaUpload({ concurrency: 3, onReady })
```

`onReady` is `(item: UploadItem) => Promise<void> | void`, awaited between
`confirming` and `ready`. Without it the composable still stops at readiness and
`readyMediaIds` is the whole output; with it, attaching is part of each item's
own lifecycle, which is what lets a card report one continuous state instead of
waiting on a button.

`add` validates synchronously, skips files already queued (same name, size and
`lastModified`), creates a preview object URL per item, and pumps the queue.
`remove` and `clear` abort anything in flight and revoke their object URLs;
`onScopeDispose` does the same for the rest.

## Per-item state machine

```
queued → requesting → uploading → confirming → attaching → ready
   ↓          ↓            ↓            ↓           ↓
 failed ←───────────────────────────────────────────┘
```

1. `requesting` — `POST /media` with `{ mimeType: file.type, sizeBytes: file.size }`.
2. `uploading` — XHR PUT to `uploadUrl` with the file as body and
   `Content-Type` set to the same MIME type. The header is not optional: the URL
   was signed with `ContentType`, so a mismatch fails the signature.
   `xhr.upload.onprogress` drives `progress`.
3. `confirming` — `POST /media/:id/confirm`.
4. `attaching` — the caller's `onReady` hook, skipped entirely when none is
   given. This is what removes the "Add N images" button: a card that finishes
   uploading attaches itself.
5. `ready` — `progress` is pinned to 1 and `mediaId` joins `readyMediaIds`.

A failure in `attaching` fails the item like any other step. Retry re-confirms
(idempotent) and calls `onReady` again; a gallery item that was in fact created
comes back as `GALLERY_MEDIA_DUPLICATE` from the unique
`(supplier_id, media_id)` constraint rather than duplicating the row.

A file that fails client validation is inserted directly as `failed`, never
entering the queue.

## Dialog behaviour

From page 2 of the Supplier Profile Admin design:

- The drop zone is always present, reading "Drop images here" when empty and
  "Drop more images here" once tiles exist.
- Dragging shows the count: "Release to upload 5 images".
- Tiles show `Uploaded`, a percentage, `Queued`, or an error line.
- The footer summarises: "1 of 5 uploaded · 1 failed", then "4 uploaded".
- ~~The primary button counts ready items — "Add 4 images" — and is disabled while
  `busy` or while `readyMediaIds` is empty.~~ Redundant, Upload/Queueing happens on drop!
- On success the page refreshes the gallery and calls `clear()`.

The logo and featured image do not use this dialog. Replace opens the file
picker in place on the Profile tab and runs a single item through the same
composable.

## Infrastructure

The presigned PUT goes straight to `S3_ENDPOINT`, bypassing the Nuxt `/api`
proxy. ~~The bucket needs CORS allowing `PUT` from both app origins — the local
MinIO too, or nothing works in development.~~ Development needs nothing: MinIO
defaults `MINIO_API_CORS_ALLOW_ORIGIN` to `*`, and `docker-compose.yml` already
runs `mc anonymous set download` so `getPublicUrl` resolves. A managed bucket in
production needs an explicit CORS rule allowing `PUT` from the app origins —
deploy configuration, not code.

Two existing settings are load-bearing and easy to break later:

- `S3_ENDPOINT` must stay browser-reachable — it is `http://localhost:9100`
  today. If it ever becomes an internal hostname, signing needs its own public
  endpoint separate from the one the API dials.
- The bucket must stay anonymously readable for previews and public URLs.

## Deferred

- S3 multipart and resumability. A plain PUT already streams the file body; real
  chunking means three more API routes for no gain on 10 MB JPEGs.
- Client-side image compression or resizing.
- A media picker. There is no list endpoint yet, which is why the flow is
  upload-first rather than choose-or-upload.
- A batch presign endpoint. Twenty files cost forty API round trips today, which
  is fine at gallery scale.
- The cleanup job for abandoned `pending` rows, still deferred from the media
  spec — but this design leans on it harder than that spec assumed. Removing an
  in-flight tile and closing the tab mid-upload both orphan a row and possibly
  an object, and nothing collects them. Nothing breaks in the meantime: orphans
  are invisible to every read path because `getReady` filters on status. The
  table and the bucket simply accumulate junk at the rate people abandon
  uploads. Closing this before shipping means a real server-side addition.

## Implementation plan

### Step 1 — Shared limits and error codes

Move the constants to `packages/types/src/media.ts`, import them back into
`media.schemas.ts`, add the three client codes and their messages.

Acceptance: `pnpm typecheck` and the API test suite pass untouched.

### Step 2 — Upload utilities

`validateFile` and `putWithProgress` in `packages/nuxt-base/app/utils/upload.ts`.

Acceptance: unit tests in `packages/nuxt-base/test/` cover an oversized file, a
disallowed type, a progress sequence, an abort, and a non-2xx response. The
project stays on `environment: 'node'`; the tests stub `XMLHttpRequest` and
`URL.createObjectURL`, so no new test dependency is needed.

### Step 3 — The composable

`useMediaUpload` with the queue, the state machine, retry and abort.

Acceptance: with a stubbed `useApi`, a five-file queue runs three at a time,
`readyMediaIds` grows only on confirm, a failed item does not stall the queue,
retry after a confirm failure re-uploads, and removing an in-flight item aborts
its request and revokes its preview.

### Step 4 — The `ui` components

`UiDropZone` and `UiUploadTile`, taking `@vueuse/core` as a dependency pinned in
`packages/ui` itself — the same treatment `reka-ui` gets, per design-system spec
decision 2, rather than the root catalog, since no other package uses it.

Acceptance: both render against the existing tokens, carry no upload or media
knowledge, and `packages/ui` still declares no dependency on `nuxt-base`.

### Step 5 — The gallery dialog

`GalleryUploadDialog.vue` in `apps/admin`, wired to
`POST /admin/suppliers/:id/gallery`.

Acceptance: uploading five files where one is oversized attaches four gallery
items and leaves one failed tile; the new rows appear flagged "Needs alt text";
closing the dialog mid-queue aborts what is still in flight.

## Veto if wrong

1. No external xhr dependency needed. Hand-rolled XHR queue in `nuxt-base`.
2. Three client-only codes go into the existing `errorCodes` map rather than a
   separate client-error union.
3. `@vueuse/core` lands in `packages/ui` only, imported by name, no
   `@vueuse/nuxt` module.
4. ~~The composable stops at `readyMediaIds`; attaching is the page's job, so the
   dialog's primary button is a second explicit step.~~ The composable takes an
   `onReady` hook and attaches per card; `readyMediaIds` remains for callers that
   pass no hook.
5. Removing an in-flight item is the only cancel; abandoned `pending` rows are
   left to the deferred cleanup job.
6. Retry re-confirms before re-uploading, rather than tracking URL expiry.
7. No queue length cap in version one.
8. Client-invalid files occupy failed tiles instead of being dropped.
9. The `ui` components take dumb props and never import the `UploadStatus` type.
10. Logo and featured image reuse the composable directly without a dialog.


## Session audience blocks admin uploads

`POST /media` and `POST /media/:id/confirm` are mounted with the `auth`
middleware, which reads `SESSION_COOKIE` and validates against
`SESSION_AUDIENCES.WORKSHOP`. `apps/admin` only ever establishes an admin
session (`ADMIN_SESSION_COOKIE`, `SESSION_AUDIENCES.ADMIN`), so every upload the
admin app starts fails at the first request.

Verified from a logged-in admin browser session:

```js
await fetch('/api/media', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mimeType: 'image/png', sizeBytes: 1024 }) })
// 401 Unauthorized
```

This blocks the gallery "Add image" dialog and the profile logo / featured
"Replace" pickers — the client work is in place and correct, but the entry point
returns 401 before any of it runs. Fixing it means deciding which audiences may
upload: either mount upload routes under `/admin` with `adminAuth`, or accept
both audiences on the shared routes. That is an auth-model decision, left open
here rather than settled in passing.

## Alt text on create — decision

The `alt-text-moved` annotation on the design canvas left this open: "the spec
requires `alt_text` on create, so either the row is created without it or
creation waits until the row is filled in."

Resolved as **created without it**. `supplier_gallery_items.alt_text` is
nullable (migration `0013_nifty_vance_astro`), `createGalleryItemSchema` takes
`altText` as `nullish`, and the gallery table flags an undescribed row with
"Needs alt text" until it is edited in place.
