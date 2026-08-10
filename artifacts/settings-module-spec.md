# Settings Module Spec

## Decisions

1. **One platform-wide settings row, typed columns.** `platform_settings` holds `currency`, `locale`, and `language` as real columns. Not a key-value table — key-value settings lose typing and validation, the same reason projects rejected a meta blob.
2. **The row is a singleton.** `id` is an integer primary key locked to 1 with a check constraint, seeded by migration. The service reads and patches that row; there is no create or delete.
3. **One currency for the whole platform.** Product prices and BOQ exports carry no currency of their own; they all mean this one. Seed values: `currency = 'RWF'`, `locale = 'en-RW'`, `language = 'en'`.
4. **Public read, admin write.** The row holds nothing sensitive and the frontend needs it before login. Writes go through `/admin` per `artifacts/api-route-conventions.md`.
5. **Deferred: multiple languages.** "Languages" as a list (and any translation machinery) waits until there is content to translate. The single `language` column states the platform default until then.

## Module layout

```
apps/api/src/modules/settings/
├── settings.tables.ts    platform_settings
├── settings.schemas.ts   zod: update
├── settings.service.ts   get, update; the only interface other modules use
└── settings.routes.ts    thin Hono sub-apps (public + admin)
```

## Table

```
platform_settings
├── id         integer pk, check (id = 1)
├── currency   text
├── locale     text
├── language   text
└── updatedAt
```

## Service surface

```
get()         → settings      (boq export reads currency here)
update(patch) → settings
```

## Routes

```
GET    /settings          public

PATCH  /admin/settings
```

The module exports two Hono sub-apps — `settingsRoutes` (public) and `adminSettingsRoutes`, which carries no auth middleware of its own; the guard is applied once where `/admin` is mounted in `app.ts`.

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Read and update the singleton

Build: `platform_settings` table with seed row (migration via `pnpm db:generate`), zod schema, `get`, `update`, both routes.

Acceptance criteria:
- `GET /settings` returns the seeded row to an anonymous caller.
- Admin patches `currency` via curl: 200, next `GET /settings` reflects it.
- A basic user gets 403 on `PATCH /admin/settings`; no session gets 401.
- Patching with an empty `currency` returns 400 from zod.
- Inserting a second row directly in the database fails on the check constraint.

## Test approach

Integration tests through `app.request()` with the `loginAs` helper, real Postgres test database, no mocks. Tests patch the singleton and restore the seed values afterwards so ordering never matters.
