import { z } from 'zod'

export {
  createGalleryItemSchema,
  createSupplierSchema,
  reorderGallerySchema,
  SLUG_PATTERN,
  updateGalleryItemSchema,
  updateSupplierSchema,
} from '@forge-kivu/types'
export type {
  CreateGalleryItemInput,
  CreateSupplierInput,
  UpdateGalleryItemInput,
  UpdateSupplierInput,
} from '@forge-kivu/types'

export const supplierIdParamSchema = z.object({ id: z.uuid() })

export const galleryItemParamSchema = z.object({
  id: z.uuid(),
  itemId: z.uuid(),
})
