# Admin Endpoints Module Spec

## Decisions

1. **Admin endpoints remain in the shared API.** `apps/admin` and `apps/web` use the same Hono API and database. 
2. **Admin authentication uses its own routes and cookie.** The module exposes `/admin/auth/login`, `/admin/auth/logout`, and `/admin/auth/me` using the host-only `admin_session` cookie. The workshop `session` cookie is never accepted by admin middleware and vice versa.
3. **Admin sessions carry an `admin` audience.** The `sessions` table gains an `audience` column so a token issued for the workshop cannot authorize an admin request even if it is copied between hosts and vice versa.
4. **Admin login requires an existing admin account.** The login service verifies both the password and `role === 'admin'` before creating a session. There is no admin signup endpoint.
5. **Domain modules continue to own domain behavior.** Catalogue, supplier, media, settings, and taxonomy modules keep their admin route handlers. The admin module only composes those sub-apps and applies the shared admin guard.
6. **Every admin domain route is protected by the API.** Nuxt access middleware improves navigation but is not an authorization boundary. The API requires both an admin-audience session and the `admin` role.
7. **The admin cookie is host-only and hardened.** It uses `HttpOnly`, `Secure` in production, `SameSite=Strict`, and `Path=/`, with no `Domain` attribute.
8. **Admin password recovery and multi-factor authentication are deferred.** Admin accounts remain provisioned outside public HTTP routes. The separate session audience and route namespace allow stronger authentication to be added without changing domain endpoints.

## Module layout

```text
apps/api/src/modules/admin/
├── admin-auth.routes.ts    login, logout, current admin
├── admin-auth.schemas.ts   login request validation
├── admin-auth.service.ts   admin credential and session operations
└── admin.routes.ts         guarded composition of domain sub-apps

apps/api/src/middleware/
└── admin-auth.ts           validates admin_session and its audience
```

The existing domain modules continue exporting their admin sub-apps. `apps/api/src/app.ts` mounts only `adminRoutes` at `/admin`.

## Session data

```text
sessions
├── id          text primary key
├── userId      foreign key → users.id
├── audience    'workshop' | 'admin'
└── expiresAt   timestamp
```

Existing sessions receive the `workshop` audience during the generated migration. New session creation must always name its audience.

## Routes

```text
POST /admin/auth/login    public; sets admin_session only for an admin
POST /admin/auth/logout   accepts admin_session; revokes it and clears the cookie
GET  /admin/auth/me       accepts admin_session; returns the current admin

/admin/media/**           admin-auth + admin role
/admin/products/**        admin-auth + admin role
/admin/settings/**        admin-auth + admin role
/admin/suppliers/**       admin-auth + admin role
/admin/categories/**      admin-auth + admin role
/admin/spec-attributes/** admin-auth + admin role
```

## Request flow

```text
admin.app.io/api/admin/*
  → Nuxt same-origin proxy
  → Hono /admin
  → admin-auth cookie validation
  → audience === 'admin'
  → role === 'admin'
  → domain route
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Log in with an admin session

Build: Generate the session-audience migration with `pnpm db:generate`, add the admin session service, and expose `POST /admin/auth/login`.

Acceptance criteria:
- Valid admin credentials return 200 and set `admin_session` with `HttpOnly`, `SameSite=Strict`, and `Secure` in production.
- Basic-user credentials and invalid credentials return the same error response and do not create a session.
- The stored session has `audience = 'admin'`; existing sessions have `audience = 'workshop'`.

### Step 2 — Resolve and revoke the admin session

Build: Add `GET /admin/auth/me`, `POST /admin/auth/logout`, and `admin-auth` middleware.

Acceptance criteria:
- `/admin/auth/me` returns the admin for a valid `admin_session` and 401 for a workshop cookie.
- Logout deletes the session row and clears only `admin_session`.
- Replaying a logged-out admin token returns 401.

### Step 3 — Guard the existing admin domain routes

Build: Move admin sub-app composition from `apps/api/src/app.ts` into `admin.routes.ts` and apply admin authentication and role checks once.

Acceptance criteria:
- An admin session can reach every mounted admin domain route.
- No cookie, a workshop session, an expired session, and a basic-user session each fail before a domain handler runs.
- Existing domain-route success and failure responses remain unchanged after composition moves.

### Step 4 — Wire the admin Nuxt application

Build: Replace the admin login stub with the typed admin-auth client calls and switch session refresh and logout to `/admin/auth/me` and `/admin/auth/logout`.

Acceptance criteria:
- The first server-rendered admin page resolves identity without a logged-out flash.
- Successful login follows the validated local redirect and reaches the dashboard.
- Expiring the admin session redirects the next protected navigation to `/login`.

## Known gap

`POST /media` and `POST /media/:id/complete` are authenticated-user routes on the
workshop audience, so the admin application cannot upload an image. Every admin
write that takes a `mediaId` — supplier logos, product media, variant images —
therefore depends on media created elsewhere. Closing this needs an admin-audience
upload path (`/admin/media`) in the media module; it is not part of the four steps
above.

## Test approach

Use API integration tests through `app.request()` with the real Postgres test database and existing auth helpers. Keep frontend tests limited to pure access resolution and the rule that every page declares access metadata; the stub markup needs no tests.
