# Auth Module Spec

## Decisions

1. **Auth owns identity.** It owns the `users` and `sessions` tables. Other modules store a `userId` column. They may import `users` inside their own `*.tables.ts` file, but only to declare a foreign key. They must never query auth tables — they call the auth service instead.
2. **Sessions are hand-rolled. No auth library.** The needs are small: email + password, two roles. Every piece is a standard, well-documented pattern.
3. **The session token is an opaque random string** — 32 random bytes from `crypto.getRandomValues()`. The database stores only a hash of the token. If the database leaks, stored hashes cannot be used to hijack sessions.
4. **The token travels in a cookie**, not a bearer header. Cookie attributes: `HttpOnly` (page scripts cannot read it, so injected scripts cannot steal it), `SameSite=Lax`, `Path=/`, and `Secure` in production only (so plain-http local tools keep working).
5. **No JWT** (JSON Web Token, a self-contained signed token). A JWT cannot be revoked before it expires, but logout and password reset must take effect immediately. The cost of database sessions is one indexed primary-key read per request, which is nothing for this app.
6. **Passwords are hashed with `Bun.password`** (argon2id, built into Bun). No dependency.
7. **Roles stay boring.** One `role` column on `users`: `basic` or `admin`. No permission tables for now, no policy engine. Admin routes are guarded by a `requireRole(ROLES.ADMIN)` middleware. "A 'basic' user only sees their own data" is a plain `where userId = ...` in each module's service — domain logic, not a permission system (yet!) -> might help to start with an enum to represent the user roles at least ? or the role enum on the table is enough?? 
8. **Sliding expiry.** Sessions last 30 days. When a session is used past its halfway point, its expiry is extended.
9. **CSRF protection** (cross-site request forgery: another website tricking the browser into sending a request with your cookie): Hono's `csrf()` middleware is applied globally. The API accepts JSON bodies only.
10. **Nuxt integration.** The API is proxied through Nuxt so browser and API share one origin. During server-side rendering, `useApi()` builds the client per request and forwards the incoming `cookie` header — otherwise server-rendered pages would always look logged out.
11. **Out of scope:** social login, two-factor auth, email verification. If social login is needed later, add the Arctic library inside this module.

## Module layout

```
apps/api/src/modules/auth/
├── auth.tables.ts    users, sessions, passwordResetTokens
├── auth.schemas.ts   zod schemas: signup, login, reset
├── auth.service.ts   all logic; the only interface other modules use
└── auth.routes.ts    thin Hono sub-app

apps/api/src/middleware/
├── auth.ts           reads cookie, validates session, sets c.var.user
└── require-role.ts   requireRole('admin')
```

## Tables

```
users
├── id            uuid pk
├── email         text unique (stored lowercase)
├── passwordHash  text
├── role          'basic' | 'admin'
└── createdAt

sessions
├── id            text pk (hash of the token)
├── userId        fk → users.id
└── expiresAt

password_reset_tokens
├── id            text pk (hash of the token)
├── userId        fk → users.id
└── expiresAt
```

## Service surface

```
signup(email, password)             → session token
login(email, password)              → session token | null
validateSession(token)              → { user, session } | null   (extends expiry when past halfway)
invalidateSession(token)
invalidateAllSessions(userId)
createPasswordReset(email)
resetPassword(token, newPassword)
getUserById(id)                     → user | null   (for other modules)
```

## Routes

```
POST /auth/signup
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /auth/password-reset            request a reset email
POST /auth/password-reset/confirm    set the new password
```

## Implementation plan

Each step is a vertical slice: it ends with something you can run and check before starting the next.

### Step 1 — Sign up and receive a session

Build: `users` and `sessions` tables (migration via `pnpm db:generate`), password hashing, token generation and hashing, cookie writing, `POST /auth/signup` with zod validation.

Acceptance criteria:
- Signup via curl returns 201 and a `Set-Cookie` header with `HttpOnly` and `SameSite=Lax`.
- The email is stored lowercase; signing up with `A@b.co` then `a@b.co` returns a conflict error. The duplicate is caught from the unique constraint, not a check-then-insert.
- The `sessions.id` value in the database is not the token from the cookie (it is its hash).

### Step 2 — Log in and log out

Build: `POST /auth/login` and `POST /auth/logout`.

Acceptance criteria:
- Correct credentials return 200 and set the session cookie.
- Wrong password and unknown email return the same status and the same error body.
- Login for an unknown email still runs a hash verification against a dummy hash, so both failures take similar time.
- Logout deletes the session row and clears the cookie; replaying the old cookie afterwards is rejected.

### Step 3 — Know who is calling

Build: `auth` middleware (cookie → `validateSession` → `c.var.user`), `GET /auth/me`, `requireRole` middleware, sliding expiry inside `validateSession`, global `csrf()`.

Acceptance criteria:
- `GET /auth/me` with a valid cookie returns the user; without one returns 401.
- A session past its `expiresAt` returns 401 and the row is deleted.
- A request made past the halfway point of the session's life pushes `expiresAt` forward.
- A test admin route returns 403 for a basic user and 200 for an admin.

### Step 4 — Nuxt wiring

Build: Nuxt proxy for the API, cookie forwarding in `useApi()` during server-side rendering.

Acceptance criteria:
- A logged-in page is rendered as logged-in on first paint: the server-rendered HTML already contains the user state, with no logged-out flash before client scripts run.
- Login from the browser sets the cookie and it flows through the proxy on later requests.

### Step 5 — Password reset (can be deferred; nothing depends on it)

Build: `password_reset_tokens` table, both reset routes, a minimal `lib/mail.ts`, session invalidation on success.

Acceptance criteria:
- The response to a reset request is identical whether the email exists or not.
- A token works once, then never again; a token older than 15 minutes is rejected.
- After a successful reset, every existing session for that user is rejected.

## Test approach

Integration tests through `app.request()` — no network, no mocks, real Postgres test database. A `loginAs(user)` helper signs up, captures the `Set-Cookie` header, and returns it for reuse as a `Cookie` header in later requests.
