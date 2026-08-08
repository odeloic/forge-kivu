# API

```mermaid
apps/api/src
├── index.ts              # entry: port + fetch only
├── app.ts                # builds the app, mounts all modules, exports AppType
├── env.ts
├── db/
│   ├── index.ts          # drizzle client (as today)
│   └── schema.ts         # barrel that re-exports every module's tables
├── storage/              # s3 client (as today)
├── middleware/           # auth, require-role, error handler, request-id
├── lib/                  # AppError, pagination helpers, shared zod utils
└── modules/
    ├── auth/
    ├── catalog/
    │   ├── catalog.tables.ts    # drizzle tables for this domain
    │   ├── catalog.schemas.ts   # zod request/response schemas
    │   ├── catalog.service.ts   # business logic, talks to db
    │   └── catalog.routes.ts    # Hono sub-app, thin handlers
    ├── projects/
    ├── rfq/
    ├── suppliers/
    └── media/
```

The API runs on Bun and Hono at http://localhost:3001.

Install workspace dependencies from the repository root:

```sh
pnpm install
```

## Development

```sh
pnpm --filter @forge-kivu/api dev
```

## Build

```sh
pnpm --filter @forge-kivu/api build
```

The build produces the Bun server bundle and TypeScript declarations in `dist`. The package exports `dist/index.d.ts` to type consumers so they do not load files from `src`.

Run the built server:

```sh
pnpm --filter @forge-kivu/api start
```

## Typecheck

```sh
pnpm --filter @forge-kivu/api typecheck
```
