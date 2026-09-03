import { z } from 'zod'

import { optionalField, optionalNumberField, slugSchema } from './fields'
import {
  ATTRIBUTE_VALUE_TYPES,
  type AttributeValueType,
  hexSchema,
  OPTION_VALUE_TYPE_VALUES,
} from './taxonomy'

export const PRODUCT_STATUSES = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  NOT_AVAILABLE: 'not_available',
} as const

export type ProductStatus =
  (typeof PRODUCT_STATUSES)[keyof typeof PRODUCT_STATUSES]

export const CATALOGUE_LIMITS = {
  name: 200,
  slug: 100,
  description: 5000,
  sku: 64,
  price: 99999999,
  optionValue: 100,
  specValue: 200,
  options: 10,
  optionValues: 50,
  variants: 200,
  variantOptions: 10,
  specs: 50,
  media: 20,
  search: 100,
} as const

export const catalogueFields = {
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(CATALOGUE_LIMITS.name),
  slug: slugSchema(CATALOGUE_LIMITS.slug),
  description: z.string().trim().max(CATALOGUE_LIMITS.description),
  sku: z.string().trim().min(1).max(CATALOGUE_LIMITS.sku),
  price: z
    .number()
    .nonnegative('Price cannot be negative.')
    .max(CATALOGUE_LIMITS.price)
    .multipleOf(0.01, 'Price can have at most two decimals.'),
  optionValue: z.string().trim().min(1).max(CATALOGUE_LIMITS.optionValue),
  specValue: z
    .string()
    .trim()
    .min(1, 'Value is required.')
    .max(CATALOGUE_LIMITS.specValue),
  search: z.string().trim().min(1).max(CATALOGUE_LIMITS.search),
}

const atLeastOneField = (patch: object): boolean =>
  Object.keys(patch).length > 0

const allDistinct = (values: string[]): boolean =>
  new Set(values).size === values.length

export const createProductSchema = z.object({
  supplierId: z.uuid(),
  categoryId: z.uuid(),
  name: catalogueFields.name,
  slug: catalogueFields.slug,
  description: catalogueFields.description.nullish(),
})

export const updateProductSchema = z
  .object({
    supplierId: z.uuid(),
    categoryId: z.uuid(),
    name: catalogueFields.name,
    slug: catalogueFields.slug,
    description: catalogueFields.description.nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const optionValueSchema = z.object({
  value: catalogueFields.optionValue,
  hex: hexSchema.optional(),
})

export const setOptionsSchema = z.object({
  options: z
    .array(
      z.object({
        name: catalogueFields.name,
        type: z
          .enum(OPTION_VALUE_TYPE_VALUES)
          .default(ATTRIBUTE_VALUE_TYPES.TEXT),
        values: z
          .array(optionValueSchema)
          .min(1, 'List at least one value.')
          .max(CATALOGUE_LIMITS.optionValues)
          .refine((values) => allDistinct(values.map((row) => row.value)), {
            message: 'Values must be distinct',
          }),
      }),
    )
    .max(CATALOGUE_LIMITS.options)
    .refine((options) => allDistinct(options.map((option) => option.name)), {
      message: 'Option names must be distinct',
    }),
})

export const setVariantsSchema = z.object({
  variants: z
    .array(
      z.object({
        sku: catalogueFields.sku.nullish(),
        price: catalogueFields.price.nullish(),
        imageMediaId: z.uuid().nullish(),
        unitId: z.uuid().optional(),
        optionValueIds: z
          .array(z.uuid())
          .max(CATALOGUE_LIMITS.variantOptions)
          .refine(allDistinct, { message: 'Option values must be distinct' })
          .optional()
          .default([]),
      }),
    )
    .min(1, 'A product needs at least one variant.')
    .max(CATALOGUE_LIMITS.variants),
})

export const CATALOGUE_SPEC_NUMBER = {
  max: 9999999999.9999,
  step: 0.0001,
} as const

const specNumberSchema = z
  .number()
  .min(-CATALOGUE_SPEC_NUMBER.max)
  .max(CATALOGUE_SPEC_NUMBER.max)
  .multipleOf(CATALOGUE_SPEC_NUMBER.step, 'Use at most four decimals.')

export const specValueSchema = z.object({
  attributeId: z.uuid(),
  value: catalogueFields.specValue,
  hex: hexSchema.optional(),
  valueNumber: specNumberSchema.optional(),
  valueMin: specNumberSchema.optional(),
  valueMax: specNumberSchema.optional(),
  valueBool: z.boolean().optional(),
})

export type SpecValueInput = z.infer<typeof specValueSchema>

export type TypedSpecValue = {
  attributeId: string
  value: string
  hex: string | null
  valueNumber: number | null
  valueMin: number | null
  valueMax: number | null
  valueBool: boolean | null
}

type SpecTypedField =
  'hex' | 'valueNumber' | 'valueMin' | 'valueMax' | 'valueBool'

const SPEC_FIELDS_BY_TYPE: Record<AttributeValueType, SpecTypedField[]> = {
  [ATTRIBUTE_VALUE_TYPES.TEXT]: [],
  [ATTRIBUTE_VALUE_TYPES.NUMBER]: ['valueNumber'],
  [ATTRIBUTE_VALUE_TYPES.BOOLEAN]: ['valueBool'],
  [ATTRIBUTE_VALUE_TYPES.RANGE]: ['valueMin', 'valueMax'],
  [ATTRIBUTE_VALUE_TYPES.COLOR]: ['hex'],
}

export const specValueForType = (type: AttributeValueType) =>
  specValueSchema.transform((spec, ctx): TypedSpecValue => {
    const required = SPEC_FIELDS_BY_TYPE[type]
    for (const field of required) {
      if (spec[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: `A ${type} value needs ${field}.`,
        })
      }
    }
    if (
      type === ATTRIBUTE_VALUE_TYPES.RANGE &&
      spec.valueMin !== undefined &&
      spec.valueMax !== undefined &&
      spec.valueMin > spec.valueMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['valueMax'],
        message: 'The maximum must not be below the minimum.',
      })
    }

    const keep = new Set<SpecTypedField>(required)
    return {
      attributeId: spec.attributeId,
      value: spec.value,
      hex: keep.has('hex') ? (spec.hex ?? null) : null,
      valueNumber: keep.has('valueNumber') ? (spec.valueNumber ?? null) : null,
      valueMin: keep.has('valueMin') ? (spec.valueMin ?? null) : null,
      valueMax: keep.has('valueMax') ? (spec.valueMax ?? null) : null,
      valueBool: keep.has('valueBool') ? (spec.valueBool ?? null) : null,
    }
  })

export const setSpecsSchema = z.object({
  specs: z
    .array(specValueSchema)
    .max(CATALOGUE_LIMITS.specs)
    .refine((specs) => allDistinct(specs.map((spec) => spec.attributeId)), {
      message: 'Attributes must be distinct',
    }),
})

export const setMediaSchema = z.object({
  mediaIds: z
    .array(z.uuid())
    .max(CATALOGUE_LIMITS.media)
    .refine(allDistinct, { message: 'Media ids must be distinct' }),
})

export const variantFormSchema = z.object({
  sku: optionalField(catalogueFields.sku),
  price: optionalNumberField(catalogueFields.price),
  imageMediaId: z.uuid().nullable(),
  unitId: z.uuid('Choose a unit.'),
  optionValueIds: z.array(z.uuid()).max(CATALOGUE_LIMITS.variantOptions),
})

export const variantsFormSchema = z.object({
  variants: z
    .array(variantFormSchema)
    .min(1, 'A product needs at least one variant.')
    .max(CATALOGUE_LIMITS.variants),
})

export const productFormSchema = z.object({
  supplierId: z.uuid('Choose a supplier.'),
  categoryId: z.uuid('Choose a category.'),
  name: catalogueFields.name,
  slug: catalogueFields.slug,
  description: optionalField(catalogueFields.description),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type SetOptionsInput = z.infer<typeof setOptionsSchema>
export type SetVariantsInput = z.infer<typeof setVariantsSchema>
export type SetSpecsInput = z.infer<typeof setSpecsSchema>
export type SetMediaInput = z.infer<typeof setMediaSchema>
export type ProductFormValues = z.output<typeof productFormSchema>
export type VariantFormValues = z.output<typeof variantFormSchema>
export type VariantsFormValues = z.output<typeof variantsFormSchema>
