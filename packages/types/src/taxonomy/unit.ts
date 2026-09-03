import { z } from 'zod'

import { slugSchema } from '../fields'

export const UNIT_LIMITS = {
  name: 50,
  symbol: 10,
  slug: 50,
  sortOrder: 10000,
} as const

export const unitFields = {
  name: z.string().trim().min(1, 'Name is required.').max(UNIT_LIMITS.name),
  symbol: z
    .string()
    .trim()
    .min(1, 'Symbol is required.')
    .max(UNIT_LIMITS.symbol),
  slug: slugSchema(UNIT_LIMITS.slug),
  sortOrder: z.number().int().min(0).max(UNIT_LIMITS.sortOrder),
}

export const createUnitSchema = z.object({
  name: unitFields.name,
  symbol: unitFields.symbol,
  slug: unitFields.slug,
  sortOrder: unitFields.sortOrder.optional(),
})

export const updateUnitSchema = z
  .object({
    name: unitFields.name,
    symbol: unitFields.symbol,
    slug: unitFields.slug,
    sortOrder: unitFields.sortOrder,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export type CreateUnitInput = z.infer<typeof createUnitSchema>
export type UpdateUnitInput = z.infer<typeof updateUnitSchema>
