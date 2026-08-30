import { PRODUCT_STATUSES, slugSchema } from '@forge-kivu/types'
import { z } from 'zod'

export {
  createProductSchema,
  setMediaSchema,
  setOptionsSchema,
  setSpecsSchema,
  setVariantsSchema,
  updateProductSchema,
  type CreateProductInput,
  type SetMediaInput,
  type SetOptionsInput,
  type SetSpecsInput,
  type SetVariantsInput,
  type UpdateProductInput,
} from '@forge-kivu/types'

export const SPEC_QUERY_PREFIX = 'spec.'

const querySlugSchema = slugSchema(100)

export const productIdParamSchema = z.object({ id: z.uuid() })

export const publicProductParamSchema = z.object({
  supplierSlug: querySlugSchema,
  productSlug: querySlugSchema,
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
    category: querySlugSchema.optional(),
    supplier: querySlugSchema.optional(),
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

export type AdminListQuery = z.infer<typeof adminListQuerySchema>
export type PublicListQuery = z.infer<typeof publicListQuerySchema>
