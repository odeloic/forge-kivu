import { z } from 'zod'

import { optionalField, optionalNumberField, slugSchema } from './fields'

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

export const setOptionsSchema = z.object({
  options: z
    .array(
      z.object({
        name: catalogueFields.name,
        values: z
          .array(catalogueFields.optionValue)
          .min(1, 'List at least one value.')
          .max(CATALOGUE_LIMITS.optionValues)
          .refine(allDistinct, { message: 'Values must be distinct' }),
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

export const setSpecsSchema = z.object({
  specs: z
    .array(
      z.object({ attributeId: z.uuid(), value: catalogueFields.specValue }),
    )
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
