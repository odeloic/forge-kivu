---
name: shared-schemas
description: How to author cross-boundary zod schema entities shared between the API and the Nuxt apps.
when_to_use: Use when adding or changing validation rules for an entity, adding a new API input schema, or building a form that submits to the API.
---

Validation rules live once, in `packages/types`, and are consumed by both the API (Hono + `@hono/zod-validator`) and the frontends (vee-validate). The supplier entity is the reference implementation: `packages/types/src/suppliers.ts`, `apps/api/src/modules/suppliers/suppliers.schemas.ts`, `apps/admin/app/components/SupplierProfileForm.vue`.

## Where things live

| Concern | Location |
| --- | --- |
| Limits, patterns, field schemas, entity schemas, form schemas | `packages/types/src/<entity>.ts` |
| Shared field primitives (`slugSchema`, `optionalField`, `SLUG_PATTERN`) | `packages/types/src/fields.ts` |
| Route param schemas (`z.object({ id: z.uuid() })`) and transport-only refinements | `apps/api/src/modules/<entity>/<entity>.schemas.ts` |
| Human error messages for API error codes | `packages/nuxt-base/app/utils/errors.ts` |

`packages/types` is bundled into the browser. Never put server secrets, database concerns, or heavy dependencies in it.

## Authoring an entity file

Follow this structure, in order:

1. **Limits const** — one `as const` object holding every length/size bound. It is the single source for both the schema `.max()` calls and UI attributes like `:maxlength`.

```ts
export const SUPPLIER_LIMITS = { name: 200, slug: 100 } as const
```

2. **Field schemas** — one object with a schema per field. Normalize inside the schema (`.trim()`, `.toLowerCase()` via `.pipe()`), so neither the API nor the form needs pre-cleaning. Give human-readable messages to rules a user can hit in a form (`.min(1, 'Name is required.')`, regex messages).

```ts
export const supplierFields = {
  name: z.string().trim().min(1, 'Name is required.').max(SUPPLIER_LIMITS.name),
  slug: slugSchema(SUPPLIER_LIMITS.slug),
}
```

3. **Entity schemas** — compose the field schemas into API input shapes. Convention: `create*Schema` uses `.nullish()` for optional fields; `update*Schema` uses `.nullable()` + `.partial()` + a non-empty `.refine()`.

4. **Form schemas** — a projection of the entity schema for form state, where every value is a string. Wrap optional text fields in `optionalField(...)` (from `fields.ts`), which converts empty/whitespace input to `null` and otherwise applies the field schema. Forms then submit `handleSubmit` output directly, with no manual `'' → null` mapping.

5. **Inferred types** — export `z.infer` types at the bottom; never hand-write a type a schema can infer. App code imports these instead of redeclaring shapes (see `useSuppliers.ts`).

Export the new file from `packages/types/src/index.ts`.

## API side

The module's `*.schemas.ts` re-exports the shared schemas and only defines transport concerns locally:

```ts
export { createSupplierSchema, updateSupplierSchema } from '@forge-kivu/types'
export const supplierIdParamSchema = z.object({ id: z.uuid() })
```

Routes keep using `zValidator('json', createSupplierSchema)` unchanged.

## Form side

Do not pass a raw zod schema as `validationSchema` — vee-validate misreads it as a map of
per-field rules and silently blocks submit with an empty `errors` bag. Wrap it with
`toTypedSchema` from `packages/nuxt-base/app/utils/validation.ts` (a small Standard Schema to
vee-validate adapter, auto-imported in both apps):

```ts
const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(supplierProfileFormSchema),
  initialValues: { name: props.supplier.name, email: props.supplier.email ?? '' },
})
const [name, nameAttrs] = defineField('name')
```

- Bind fields with `v-model="name" v-bind="nameAttrs"`; show `errors.<field>` in a `<span class="hint status-bad">`.
- Put `novalidate` on the form and drop `required`/`pattern` attributes — the schema owns the rules. Keep `type="email|url|tel"` for keyboards and bind `:maxlength` from the limits const.
- Keep `useAsyncAction` for request state; `handleSubmit` output is the request payload as-is.

## Rules

- A validation bound that exists in two places is a bug. If a rule appears in a component attribute, an API schema, and a DB column, the limits const is the source and the others derive from it.
- Do not duplicate `SLUG_PATTERN` or slug schemas per module — import from `@forge-kivu/types` (taxonomy and catalogue still carry local copies; migrate them when touched).
- New shared dependencies go in the `pnpm-workspace.yaml` catalog, pinned.
