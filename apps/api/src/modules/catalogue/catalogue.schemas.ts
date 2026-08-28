import { z } from 'zod'

import { PRODUCT_STATUSES } from './catalogue.tables'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const SPEC_QUERY_PREFIX = 'spec.'

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().max(100).regex(SLUG_PATTERN))

const nameSchema = z.string().trim().min(1).max(200)
const descriptionSchema = z.string().trim().max(5000)
const skuSchema = z.string().trim().min(1).max(64)
const priceSchema = z.number().nonnegative().max(99999999).multipleOf(0.01)
const optionValueSchema = z.string().trim().min(1).max(100)
const specValueSchema = z.string().trim().min(1).max(200)

const atLeastOneField = (patch: object): boolean =>
  Object.keys(patch).length > 0

const allDistinct = (values: string[]): boolean =>
  new Set(values).size === values.length

export const createProductSchema = z.object({
  supplierId: z.uuid(),
  categoryId: z.uuid(),
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema.nullish(),
})

export const updateProductSchema = z
  .object({
    supplierId: z.uuid(),
    categoryId: z.uuid(),
    name: nameSchema,
    slug: slugSchema,
    description: descriptionSchema.nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const setOptionsSchema = z.object({
  options: z
    .array(
      z.object({
        name: nameSchema,
        values: z
          .array(optionValueSchema)
          .min(1)
          .max(50)
          .refine(allDistinct, { message: 'Values must be distinct' }),
      }),
    )
    .max(10)
    .refine((options) => allDistinct(options.map((option) => option.name)), {
      message: 'Option names must be distinct',
    }),
})

export const setVariantsSchema = z.object({
  variants: z
    .array(
      z.object({
        sku: skuSchema.nullish(),
        price: priceSchema.nullish(),
        imageMediaId: z.uuid().nullish(),
        optionValueIds: z
          .array(z.uuid())
          .max(10)
          .refine(allDistinct, { message: 'Option values must be distinct' })
          .optional()
          .default([]),
      }),
    )
    .min(1)
    .max(200),
})

export const setSpecsSchema = z.object({
  specs: z
    .array(z.object({ attributeId: z.uuid(), value: specValueSchema }))
    .max(50)
    .refine((specs) => allDistinct(specs.map((spec) => spec.attributeId)), {
      message: 'Attributes must be distinct',
    }),
})

export const setMediaSchema = z.object({
  mediaIds: z
    .array(z.uuid())
    .max(20)
    .refine(allDistinct, { message: 'Media ids must be distinct' }),
})

export const productIdParamSchema = z.object({ id: z.uuid() })

export const publicProductParamSchema = z.object({
  supplierSlug: slugSchema,
  productSlug: slugSchema,
})

export const adminListQuerySchema = z.object({
  supplierId: z.uuid().optional(),
  status: z
    .enum([
      PRODUCT_STATUSES.DRAFT,
      PRODUCT_STATUSES.PUBLISHED,
      PRODUCT_STATUSES.NOT_AVAILABLE,
    ])
    .optional(),
})

const priceQuerySchema = z
  .string()
  .regex(/^\d{1,12}$/)
  .transform(Number)
  .optional()

export const publicListQuerySchema = z
  .looseObject({
    category: slugSchema.optional(),
    supplier: slugSchema.optional(),
    priceMin: priceQuerySchema,
    priceMax: priceQuerySchema,
    page: z
      .string()
      .regex(/^[1-9]\d{0,3}$/)
      .transform(Number)
      .optional(),
  })
  .transform(({ category, supplier, priceMin, priceMax, page, ...rest }) => ({
    category,
    supplier,
    priceMin,
    priceMax,
    page,
    specs: Object.entries(rest).flatMap(([key, value]) => {
      if (!key.startsWith(SPEC_QUERY_PREFIX)) return []
      const values = [
        ...new Set(
          (Array.isArray(value) ? value : [value]).filter(
            (item): item is string => typeof item === 'string',
          ),
        ),
      ]
      if (values.length === 0) return []
      return [{ slug: key.slice(SPEC_QUERY_PREFIX.length), values }]
    }),
  }))

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type SetOptionsInput = z.infer<typeof setOptionsSchema>
export type SetVariantsInput = z.infer<typeof setVariantsSchema>
export type SetSpecsInput = z.infer<typeof setSpecsSchema>
export type SetMediaInput = z.infer<typeof setMediaSchema>
export type AdminListQuery = z.infer<typeof adminListQuerySchema>
export type PublicListQuery = z.infer<typeof publicListQuerySchema>
