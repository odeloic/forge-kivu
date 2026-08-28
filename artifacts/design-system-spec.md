# Design System Spec

`@forge-kivu/ui` — the Nuxt layer both `apps/admin` and `apps/web` extend for
tokens, base element styling, and the shared `Ui*` components.

## Decisions

1. **A layer of its own, not part of `nuxt-base`.** `nuxt-base` owns the API
   proxy, session resolution and access policy; the design system owns
   appearance. A surface that needs one rarely needs the other on the same
   schedule, and keeping them apart means the CSS never loads for a headless
   consumer of the API layer.
2. **The layer owns `reka-ui`.** The module (`reka-ui/nuxt`) and the dependency
   are declared once, in the layer. Both apps get the primitives auto-imported;
   neither declares `reka-ui` itself. The `Ui*` components are the only files
   that import from it directly.
3. **Stylesheets are resolved from the layer directory, not `~/assets`.** A
   layer's `~` is ambiguous once an app extends it, so `nuxt.config.ts` builds
   absolute paths with `fileURLToPath`. Consistent with the repo rule against
   `@/*` aliases across package boundaries.
4. **Load order is reset → tokens → base.** Unchanged from what `apps/admin`
   declared before the extraction; the layer now declares it once.
5. **The fonts move with the styles.** The IBM Plex preconnect and stylesheet
   links live in the layer's `app.head`, so a consuming app cannot load the type
   scale without the faces it names.
6. **Apps keep their own components; only genuinely shared ones move.**
   `UiButton`, `UiDialog` and `UiConfirmDialog` moved out of `apps/admin`.
   `ProductCard`, `ProductFilters`, `AppNav` and the rest stay with their app —
   they carry catalogue knowledge, not design-system knowledge.
7. **No test suite in the layer.** It holds CSS and three thin wrappers over
   reka-ui primitives; there is nothing to assert that the apps' own suites do
   not already cover. It is deliberately absent from the root `vitest.config.ts`
   projects list.

## Layout

```
packages/ui/
├── nuxt.config.ts          css + reka-ui/nuxt + font links
├── package.json            reka-ui pinned here
└── app/
    ├── assets/css/
    │   ├── reset.css
    │   ├── tokens.css
    │   └── base.css
    └── components/
        ├── UiButton.vue
        ├── UiDialog.vue
        └── UiConfirmDialog.vue
```

Both apps declare `extends: ['@forge-kivu/nuxt-base', '@forge-kivu/ui']`.

## Token additions made during the extraction

- `--text-xl: 1.375rem` — one step above `--text-lg`, for a storefront product
  title and its price. Nothing in the admin uses it.
- `.choice` — a label modifier that opts out of the global uppercase micro-label
  rule. `label` in `base.css` styles a field caption; a label wrapping a
  checkbox beside a value like "Portland limestone cement" needs body text. The
  global rule is left alone so no admin page changes.

## Veto if wrong

1. `@forge-kivu/ui` is a Nuxt layer consumed through `extends`, not a component
   library consumed through imports.
2. `reka-ui` is declared only in the layer; neither app lists it.
3. Stylesheet paths are absolute, built from `import.meta.url`.
4. The global `label` rule keeps its uppercase treatment; `.choice` is the
   opt-out rather than the other way round.
5. The layer ships no tests and is not a vitest project.
