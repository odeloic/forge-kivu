# Web Routing Spec

Nuxt 4 routing, navigation and access control for `apps/web`. Tracks ODE-370
(skeleton) and ODE-372 (structure).

## Scope

Routes, navigation and access control only. ~~No styling, no design system, no
component library. Markup is whatever is minimally sufficient to prove the wiring.~~
Styling now comes from the `@forge-kivu/ui` layer and reka-ui primitives; see
`artifacts/design-system-spec.md`. This spec still owns only routes, navigation
and access.

~~Catalogue and product URL semantics are deliberately unsettled — there is no
catalogue yet, and the shape will move. Those pages exist as empty stubs at the
paths ODE-372 lists so the tree is walkable; nothing is built on top of them.~~
The catalogue is settled at `/` with filters in the query string, and product
detail at `/products/:supplierSlug/:productSlug`. The remaining pages are still
stubs. One open question: the catalogue lives at `/` while `/products` is an
empty stub that `PRIMARY_NAV` still links — either the catalogue moves to
`/products`, or `Products` comes out of the nav.

## Decisions

1. **Frontend paths do not determine access.** A frontend path may differ from the
   endpoint it calls: `/workshop/projects` reads `GET /projects`. Renaming a route
   such as `/workshop` to `/my-space` does not change its authorization policy.
2. **Page metadata is the only runtime source of access policy.** Every page must
   declare `definePageMeta({ access })` with `'public' | 'guest' | 'authenticated' |
   'admin-only'`. There are no URL-prefix overrides.
3. **Missing access metadata is denied and rejected by tests.** A matched page
   without `access` resolves to `denied`, which no user can pass. A source-level
   test also fails when a page omits the declaration or uses an invalid value.
4. **Roles and access policies are separate concepts.** A role describes the user;
   an access policy describes what a page requires. Adding a role such as `EDITOR`
   needs no new access policy unless the product introduces an editor-specific
   capability.
5. **Navigation and the guard read the same source.** Nav entries are `{ path, label }`
   with no access field of their own; visibility is computed by resolving the path
   through the router and reading the resolved route's meta — the exact value the
   middleware acts on. A link that renders is a link that will pass.
6. **No session redirects to `/login?redirect=<path>`; the wrong role throws 403.**
   A silent bounce to `/` makes a role failure indistinguishable from a working
   navigation. `createError({ statusCode: 403 })` is visible in the UI and
   assertable in a test.
7. **`/auth/me` is the only source of truth for identity.** The session cookie is
   `HttpOnly`, so nothing client-side can read it. A plugin resolves the user once
   during SSR into `useState`; the payload carries it to the client, so route
   middleware reads it synchronously and no page flashes logged-out.
8. **A 401 from any API call clears session state.** `createClient` receives a
   wrapped `fetch`. An expired cookie surfaces as logged-out on the next
   navigation instead of a page that renders half-authenticated.
9. **`error.vue` is the catch-all for 403, 404 and 500.** No `[...slug].vue` page —
   it would shadow Nuxt's built-in 404 routing and split error rendering across two
   places.
10. **Admins are seeded, not promoted.** Signup hardcodes `role: 'basic'` and there
   is no promote route, so `/admin` is unreachable without direct database access.
   A dev-only `pnpm db:seed` fills that gap; it refuses to run when
   `NODE_ENV=production`.

## Access resolution

```
resolveAccess(route)  → 'public' | 'guest' | 'authenticated' | 'admin-only' | 'denied'
  route matches no page        → 'public'   (so an unknown path 404s
                                             rather than bouncing to /login)
  route.meta.access set        → that value
  otherwise                    → 'denied'

canAccess(access, user)
  'public'        → always
  'guest'         → user is null
  'authenticated' → user is not null
  'admin-only'    → user is not null and user.role === 'admin'
  'denied'        → never
```

Both are pure functions in `app/utils/access.ts`, unit-tested without mounting Nuxt.
The middleware and the nav renderer are the only callers.

## Page tree

```
public   /                                    landing
         /login                               access: 'guest'
         /contact
         /products                            stub
         /products/:supplierSlug/:productSlug  ~~stub~~ product detail
         /catalogue/categories/:slug          stub
         /suppliers                           stub
         /suppliers/:slug                     stub
         /spaces                              stub, no endpoint yet
         /brands                              stub, no endpoint yet

authenticated /workshop
         /workshop/projects
         /workshop/projects/:id/overview
         /workshop/projects/:id/boqs
         /workshop/projects/:id/inventory
         /workshop/projects/:id/settings

admin-only    /admin                         dashboard
```

~~Only five pages call the API.~~ Seven pages call the API: `/` reads
`GET /catalogue/products` and `GET /catalogue/products/facets`, and
`/products/:supplierSlug/:productSlug` reads
`GET /catalogue/products/:supplierSlug/:productSlug`. The rest are a heading and
nothing else.

Two gaps the product detail page ships around:

- The breadcrumb shows the leaf category only. `getPublished` returns
  `category` as a single ref with no ancestors, so the trail cannot be built
  from the response. Either the detail response carries the ancestor path, or
  the page fetches the tree.
- **Add to project** is disabled-by-selection but wired to nothing, and the `+`
  on a product card still emits `add` with no listener. Neither has an endpoint.
  Decide what they add to — a BOQ, a draft project — or take both out.

| Page | Endpoint | Proves |
| --- | --- | --- |
| `/login` | `POST /auth/login` | the cookie survives the Nuxt proxy |
| every page | `GET /auth/me` | identity resolves before first paint |
| `/workshop/projects` | `GET /projects` | an authenticated route returns real data |
| `/admin` | `GET /admin/suppliers` | the role gate holds end to end |
| `error.vue` | — | 403 and 404 both render |

## Layout

```
apps/web/app/
├── app.vue                     NuxtLayout + NuxtPage shell
├── error.vue                   403 / 404 / 500
├── utils/access.ts             resolveAccess, canAccess
├── utils/navigation.ts         { path, label } entries, grouped
├── middleware/auth.global.ts   the only guard
├── plugins/session.ts          resolves /auth/me once into useState
├── composables/
│   ├── useSessionState.ts      the shared session ref
│   ├── useApi.ts               createClient + 401 interceptor
│   └── useSession.ts           user, isAuthenticated, isAdmin, login, logout
├── components/
│   ├── AppNav.vue              renders entries, filtered by canAccess
│   └── AppSession.vue          identity and the log in / log out control
├── layouts/
│   ├── default.vue             public nav
│   ├── workshop.vue            project nav
│   └── admin.vue               admin nav
└── pages/…
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Remove the todos scaffolding

Build: Delete `apps/api/src/todos.ts` and its routes, `packages/types` todo
exports, `TodoItem.vue`, and the web and API client todo tests. Reduce `app.vue`
to a shell.

Acceptance criteria:
- `pnpm lint`, `pnpm typecheck`, and the package test suites pass.
- No `todo` reference remains outside `node_modules`.

### Step 2 — Session state

Build: `plugins/session.ts` calls `GET /auth/me` into `useState('session')`.
`useSession()` exposes `user`, `isAuthenticated`, `isAdmin`, `login`, `logout`,
`refresh`. `useApi()` wraps `fetch` to clear state on 401.

Acceptance criteria:
- Server-rendered HTML of a logged-in page already contains the user; no
  logged-out flash before hydration.
- Exactly one `/auth/me` request per full page load, not one per component.
- Deleting the session row server-side makes the next navigation render as
  logged-out rather than erroring.

### Step 3 — Access rules and the guard

Build: Add the policy resolver in `utils/access.ts`, enforce it in
`middleware/auth.global.ts`, and declare access metadata on every page.

Acceptance criteria:
- Unit tests cover every `resolveAccess` branch and every `canAccess` pair.
- A source-level test fails if any page omits `access` or declares an invalid policy.
- Anonymous hitting `/workshop/projects` lands on `/login?redirect=/workshop/projects`
  and returns there after logging in.
- A `basic` user hitting `/admin` gets a rendered 403, not a redirect.
- A matched page without `access` returns 403 for every user.
- Moving an authenticated page from `/workshop` to `/my-space` does not require an
  access resolver change.

### Step 4 — Pages, layouts, navigation

Build: Add the page tree above, three layouts, and `AppNav.vue` filtering through
`canAccess`.

Acceptance criteria:
- Anonymous sees no `/workshop` or `/admin` links; `basic` sees `/workshop` but not
  `/admin`; `admin` sees both.
- `/workshop/projects` lists projects from `GET /projects`.
- `/admin` renders suppliers from `GET /admin/suppliers`.

### Step 5 — Admin seed

Build: Add `pnpm db:seed` in `apps/api` to create one `admin` and one `basic`
user from `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_BASIC_EMAIL`, and
`SEED_BASIC_PASSWORD`. Reuse the auth service rather than writing rows by hand.

Acceptance criteria:
- Running it twice is harmless.
- It exits non-zero when `NODE_ENV=production`.
- The seeded admin can log in through the web UI and reach `/admin`.

### Step 6 — Error fallthrough

Build: Add `error.vue` handling 403, 404, and 500 distinctly, with a link back
to `/`.

Acceptance criteria:
- An unknown path renders the 404 branch.
- A role failure renders the 403 branch.
- Both are reachable during SSR and after client-side navigation.

## Test approach

`resolveAccess` and `canAccess` get plain Vitest unit tests. A source-level test
scans `app/pages/**/*.vue` and requires one valid access declaration per page.
The page markup gets no tests at this stage because it carries no route policy.

## Veto if wrong

1. `/workshop` is the authenticated namespace, per ODE-372 — the API keeps serving
   these under `/projects`.
2. `'guest'` is a distinct access policy, so `/login` bounces an already-authenticated
   user instead of showing them a login form.
3. Access comes only from page metadata; URL prefixes never override it.
4. Roles are not access policies; a new role does not imply a new policy.
5. Nav visibility is derived from resolved route meta rather than duplicated on the
   nav entries.
6. Stub pages are created for `/spaces`, `/brands` and `/contact` even though no
   endpoint exists behind them.
7. Project sub-pages are real routes (`/workshop/projects/:id/overview`) rather than
   tabs on one page.
8. The seed script reuses the auth service's signup path, so seeded passwords are
   hashed identically to real ones.
