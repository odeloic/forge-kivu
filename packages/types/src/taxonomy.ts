import { z } from 'zod'

import { optionalField, slugSchema } from './fields'

export const TAXONOMY_LIMITS = {
  name: 200,
  slug: 100,
  unit: 20,
  sortOrder: 10000,
} as const

export const taxonomyFields = {
  name: z.string().trim().min(1, 'Name is required.').max(TAXONOMY_LIMITS.name),
  slug: slugSchema(TAXONOMY_LIMITS.slug),
  unit: z.string().trim().min(1).max(TAXONOMY_LIMITS.unit),
  sortOrder: z.number().int().min(0).max(TAXONOMY_LIMITS.sortOrder),
}

const atLeastOneField = (patch: object): boolean =>
  Object.keys(patch).length > 0

export const createCategorySchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  parentId: z.uuid().nullish(),
  sortOrder: taxonomyFields.sortOrder.optional(),
})

export const updateCategorySchema = z
  .object({
    name: taxonomyFields.name,
    slug: taxonomyFields.slug,
    parentId: z.uuid().nullable(),
    sortOrder: taxonomyFields.sortOrder,
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const createAttributeSchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  unit: taxonomyFields.unit.nullish(),
})

export const updateAttributeSchema = z
  .object({
    name: taxonomyFields.name,
    slug: taxonomyFields.slug,
    unit: taxonomyFields.unit.nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const categoryFormSchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  parentId: optionalField(z.uuid()),
  sortOrder: z.coerce
    .number()
    .int('Sort order must be a whole number.')
    .min(0, 'Sort order cannot be negative.')
    .max(TAXONOMY_LIMITS.sortOrder),
})

export const attributeFormSchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  unit: optionalField(taxonomyFields.unit),
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CreateAttributeInput = z.infer<typeof createAttributeSchema>
export type UpdateAttributeInput = z.infer<typeof updateAttributeSchema>
export type CategoryFormValues = z.output<typeof categoryFormSchema>
export type AttributeFormValues = z.output<typeof attributeFormSchema>
