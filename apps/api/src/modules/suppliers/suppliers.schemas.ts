import { z } from 'zod'

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().max(100).regex(SLUG_PATTERN))

const nameSchema = z.string().trim().min(1).max(200)
const descriptionSchema = z.string().trim().max(2000)

export const createSupplierSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema.nullish(),
  logoMediaId: z.uuid().nullish(),
})

export const updateSupplierSchema = z
  .object({
    name: nameSchema,
    slug: slugSchema,
    description: descriptionSchema.nullable(),
    logoMediaId: z.uuid().nullable(),
    visible: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export const supplierIdParamSchema = z.object({ id: z.uuid() })

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
