import { z } from 'zod'

import { optionalField, slugSchema } from './fields'

export const SUPPLIER_LIMITS = {
  name: 200,
  slug: 100,
  description: 2000,
  email: 320,
  phone: 50,
  url: 2000,
  address: 500,
  caption: 500,
  altText: 500,
} as const

export const supplierFields = {
  name: z.string().trim().min(1, 'Name is required.').max(SUPPLIER_LIMITS.name),
  slug: slugSchema(SUPPLIER_LIMITS.slug),
  description: z.string().trim().max(SUPPLIER_LIMITS.description),
  email: z.string().trim().max(SUPPLIER_LIMITS.email).pipe(z.email()),
  phone: z.string().trim().min(1).max(SUPPLIER_LIMITS.phone),
  websiteUrl: z
    .string()
    .trim()
    .max(SUPPLIER_LIMITS.url)
    .pipe(z.url({ protocol: /^https?$/ })),
  address: z.string().trim().max(SUPPLIER_LIMITS.address),
  caption: z.string().trim().max(SUPPLIER_LIMITS.caption),
  altText: z.string().trim().min(1).max(SUPPLIER_LIMITS.altText),
  displayOrder: z.number().int().min(0),
}

export const createSupplierSchema = z.object({
  name: supplierFields.name,
  slug: supplierFields.slug,
  description: supplierFields.description.nullish(),
  logoMediaId: z.uuid().nullish(),
  email: supplierFields.email.nullish(),
  phone: supplierFields.phone.nullish(),
  websiteUrl: supplierFields.websiteUrl.nullish(),
  address: supplierFields.address.nullish(),
  featuredMediaId: z.uuid().nullish(),
})

export const updateSupplierSchema = z
  .object({
    name: supplierFields.name,
    slug: supplierFields.slug,
    description: supplierFields.description.nullable(),
    logoMediaId: z.uuid().nullable(),
    email: supplierFields.email.nullable(),
    phone: supplierFields.phone.nullable(),
    websiteUrl: supplierFields.websiteUrl.nullable(),
    address: supplierFields.address.nullable(),
    featuredMediaId: z.uuid().nullable(),
    visible: z.boolean(),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export const createGalleryItemSchema = z.object({
  mediaId: z.uuid(),
  caption: supplierFields.caption.nullish(),
  altText: supplierFields.altText.nullish(),
  linkUrl: supplierFields.websiteUrl.nullish(),
  displayOrder: supplierFields.displayOrder.optional(),
})

export const updateGalleryItemSchema = z
  .object({
    caption: supplierFields.caption.nullable(),
    altText: supplierFields.altText.nullable(),
    linkUrl: supplierFields.websiteUrl.nullable(),
    displayOrder: supplierFields.displayOrder,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export const reorderGallerySchema = z.object({
  itemIds: z.array(z.uuid()).min(1),
})

export const supplierProfileFormSchema = z.object({
  name: supplierFields.name,
  slug: supplierFields.slug,
  description: optionalField(supplierFields.description),
  email: optionalField(supplierFields.email),
  phone: optionalField(supplierFields.phone),
  websiteUrl: optionalField(supplierFields.websiteUrl),
  address: optionalField(supplierFields.address),
})

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>
export type CreateGalleryItemInput = z.infer<typeof createGalleryItemSchema>
export type UpdateGalleryItemInput = z.infer<typeof updateGalleryItemSchema>
export type SupplierProfileFormValues = z.output<
  typeof supplierProfileFormSchema
>
