import { z } from 'zod'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().max(100).regex(SLUG_PATTERN))

const nameSchema = z.string().trim().min(1).max(200)
const unitSchema = z.string().trim().min(1).max(20)
const sortOrderSchema = z.number().int().min(0).max(10000)

const atLeastOneField = (patch: object): boolean =>
  Object.keys(patch).length > 0

export const createCategorySchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  parentId: z.uuid().nullish(),
  sortOrder: sortOrderSchema.optional(),
})

export const updateCategorySchema = z
  .object({
    name: nameSchema,
    slug: slugSchema,
    parentId: z.uuid().nullable(),
    sortOrder: sortOrderSchema,
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const createAttributeSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  unit: unitSchema.nullish(),
})

export const updateAttributeSchema = z
  .object({
    name: nameSchema,
    slug: slugSchema,
    unit: unitSchema.nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const taxonomyIdParamSchema = z.object({ id: z.uuid() })

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>
