# E-commerce Engine

This repository is a pnpm monorepo containing a Bun and Hono API, a typed Hono client, and a Nuxt application.

## Requirements

- Node.js 24 or later
- pnpm 11.20.0
- Bun

## Setup

Install dependencies from the repository root:

```sh
pnpm install
```

Start the API and frontend applications together:

```sh
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001
- Admin: http://localhost:3002

## Commands

Run these commands from the repository root:

```sh
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm format:check
```

`pnpm build` builds the API, emits its declarations, compiles the API client, and builds the Nuxt application. Commands that consume the API client generate their required declarations automatically.

## Workspace structure

- `apps/api`: Bun and Hono API
- `apps/admin`: Nuxt admin application
- `apps/web`: Nuxt application
- `packages/api-client`: compiled type-safe Hono client
- `packages/types`: shared schemas and types
- `packages/tsconfig`: shared TypeScript configuration
- `packages/eslint-config`: shared ESLint configuration

## Type boundary

The API and API client expose compiled artifacts instead of TypeScript source:

```text
apps/api/src
  → apps/api/dist/index.d.ts
  → packages/api-client/dist
  → apps/web
```

This prevents downstream typecheckers from loading API implementation files. Imports that can appear in public declarations must be portable:

- Use relative imports within a package when an alias adds no value.
- Use workspace package names such as `@forge-kivu/types` between packages.
- Use package-scoped `package.json#imports` aliases such as `#api/*` for internal aliases.
- Do not use a generic `@/*` TypeScript path alias in code that can leak into public declarations.

Generated `dist` directories are ignored and should not be committed.
