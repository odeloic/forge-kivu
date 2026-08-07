# API

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
