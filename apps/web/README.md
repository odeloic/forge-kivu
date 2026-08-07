# Web

The web application runs on Nuxt at http://localhost:3000 and consumes the compiled `@forge-kivu/api-client` package.

## Setup

Install workspace dependencies from the repository root:

```sh
pnpm install
```

## Development

Start the application from the repository root:

```sh
pnpm --filter @forge-kivu/web dev
```

The development command compiles the API client before starting Nuxt.

## Build

```sh
pnpm --filter @forge-kivu/web build
```

The build command emits the API declarations, compiles the API client, and then builds Nuxt.

Preview the production build:

```sh
pnpm --filter @forge-kivu/web preview
```

## Typecheck

```sh
pnpm --filter @forge-kivu/web typecheck
```

Nuxt consumes `packages/api-client/dist/index.d.ts`; its typechecker does not load `apps/api/src`.

## Generate

```sh
pnpm --filter @forge-kivu/web generate
```
