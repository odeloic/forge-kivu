import { z } from 'zod'

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.string().max(100).regex(SLUG_PATTERN))

const nameSchema = z.string().trim().min(1).max(200)
const descriptionSchema = z.string().trim().max(2000)
const emailSchema = z.string().trim().max(320).pipe(z.email())
const phoneSchema = z.string().trim().min(1).max(50)
const urlSchema = z
  .string()
  .trim()
  .max(2000)
  .pipe(z.url({ protocol: /^https?$/ }))
const addressSchema = z.string().trim().max(500)
const captionSchema = z.string().trim().max(500)
const altTextSchema = z.string().trim().min(1).max(500)
const displayOrderSchema = z.number().int().min(0)

export const createSupplierSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema.nullish(),
  logoMediaId: z.uuid().nullish(),
  email: emailSchema.nullish(),
  phone: phoneSchema.nullish(),
  websiteUrl: urlSchema.nullish(),
  address: addressSchema.nullish(),
  featuredMediaId: z.uuid().nullish(),
})

export const updateSupplierSchema = z
  .object({
    name: nameSchema,
    slug: slugSchema,
    description: descriptionSchema.nullable(),
    logoMediaId: z.uuid().nullable(),
    email: emailSchema.nullable(),
    phone: phoneSchema.nullable(),
    websiteUrl: urlSchema.nullable(),
    address: addressSchema.nullable(),
    featuredMediaId: z.uuid().nullable(),
    visible: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export const supplierIdParamSchema = z.object({ id: z.uuid() })

export const createGalleryItemSchema = z.object({
  mediaId: z.uuid(),
  caption: captionSchema.nullish(),
  altText: altTextSchema.nullish(),
  linkUrl: urlSchema.nullish(),
  displayOrder: displayOrderSchema.optional(),
})

export const updateGalleryItemSchema = z
  .object({
    caption: captionSchema.nullable(),
    altText: altTextSchema.nullable(),
    linkUrl: urlSchema.nullable(),
    displayOrder: displayOrderSchema,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export const reorderGallerySchema = z.object({
  itemIds: z.array(z.uuid()).min(1),
})

export const galleryItemParamSchema = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
export type CreateGalleryItemInput = z.infer<typeof createGalleryItemSchema>
export type UpdateGalleryItemInput = z.infer<typeof updateGalleryItemSchema>
