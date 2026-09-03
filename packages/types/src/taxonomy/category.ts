import { z } from 'zod'

import { optionalField } from '../fields'
import { TAXONOMY_LIMITS, taxonomyFields } from './base'

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
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

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

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type CategoryFormValues = z.output<typeof categoryFormSchema>
