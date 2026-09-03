import { z } from 'zod'

import { taxonomyFields } from './base'

export const createSpaceSchema = z.object({
  name: taxonomyFields.name,
  slug: taxonomyFields.slug,
  sortOrder: taxonomyFields.sortOrder.optional(),
})

export const updateSpaceSchema = z
  .object({
    name: taxonomyFields.name,
    slug: taxonomyFields.slug,
    sortOrder: taxonomyFields.sortOrder,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export type CreateSpaceInput = z.infer<typeof createSpaceSchema>
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>
