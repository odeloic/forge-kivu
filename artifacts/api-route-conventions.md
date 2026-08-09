# API Route Conventions

Cross-cutting rules for every module's routes. Module specs reference this instead
of restating it.

## Decisions

1. **Admin routes live under `/admin`.** Anything that requires `role = 'admin'` is
   mounted at `/admin/<resource>`. Public and authenticated-user routes keep their
   plain resource path.
2. **A URL never changes its contents based on who is asking.** `GET /suppliers`
   returns the same bytes to everyone. The admin view of the same data is a
   different path, `GET /admin/suppliers`, because it is a different collection.
3. **The guard is applied once, at the namespace mount**, not per route. Module
   admin sub-apps carry no auth middleware of their own.
4. **`/admin` is not a REST resource.** It is a namespace. The path names an
   audience, not a thing, which is a deliberate trade: it buys the cache boundary
   in decision 5 and the blanket guard in decision 3.
5. **Cacheability follows the namespace.** Everything under `/admin` is
   uncacheable by definition; public paths need no `Vary: Cookie` and can sit
   behind a CDN. A dual-audience URL would be one cache misconfiguration away from
   serving hidden rows to the public.

## Not every non-public route is an admin route

Three categories, only one of which is namespaced:

```
public              GET /suppliers                  no session needed
authenticated user  POST /media                     any logged-in user
admin               POST /admin/suppliers           role = 'admin'
```

Authenticated-user routes stay on the resource path. `/admin` means the role, not
merely "needs a login".

## Composition

Each module exports its public sub-app and, when it has admin routes, a second
sub-app. `app.ts` is the composition root:

```ts
const adminRoutes = new Hono()
  .use('*', auth, requireRole(ROLES.ADMIN))
  .route('/suppliers', adminSupplierRoutes)
  .route('/products', adminProductRoutes)

export const app = new Hono<...>()
  ...
  .route('/suppliers', supplierRoutes)
  .route('/admin', adminRoutes)
```

Two things this buys, both verified against Hono 4.13.1:

- The guard binds to the URL prefix, not to the mount. A route declared anywhere
  else that happens to resolve under `/admin` is still guarded. Adding an admin
  route and forgetting to protect it is not possible.
- An unrouted path under the namespace answers 401/403, not 404. The namespace
  does not leak which admin routes exist.

## Gotchas

1. **`.use()` must be registered before `.route()`.** Hono matches in registration
   order; a guard added after the routes it should cover silently does nothing —
   no warning, no error, the routes are simply open.
2. **Sub-apps that read `c.get('user')` need `new Hono<AuthEnv>()`.** Once the
   guard moves to the namespace it is no longer in the module's type chain.
3. **Keep the chain unbroken** (`.use().route().route()`). `packages/api-client`
   infers its types from `AppType`; splitting the chain into statements loses the
   inference.
