import { z } from 'zod'

import { slugSchema } from '../fields'

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
