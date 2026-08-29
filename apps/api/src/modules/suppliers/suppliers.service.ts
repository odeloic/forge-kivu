import { and, asc, eq, sql } from 'drizzle-orm'

import { db } from '../../db'
import { isReferenceViolation, isUniqueViolation } from '../../db/errors'
import { AppError } from '../../lib/errors'
import { getPublicUrl, getReady } from '../media/media.service'
import type {
  CreateGalleryItemInput,
  CreateSupplierInput,
  UpdateGalleryItemInput,
  UpdateSupplierInput,
} from './suppliers.schemas'
import { supplierGalleryItems, suppliers } from './suppliers.tables'

export type Supplier = typeof suppliers.$inferSelect
export type SupplierGalleryItem = typeof supplierGalleryItems.$inferSelect

export type SupplierResponse = Supplier & { logoUrl: string | null }

export type SupplierGalleryItemResponse = SupplierGalleryItem & {
  imageUrl: string
}

export type SupplierDetailResponse = SupplierResponse & {
  featuredImageUrl: string | null
  gallery: SupplierGalleryItemResponse[]
}

const withLogoUrl = async (row: Supplier): Promise<SupplierResponse> => {
  if (!row.logoMediaId) return { ...row, logoUrl: null }

  const logo = await getReady(row.logoMediaId)

  return { ...row, logoUrl: logo ? getPublicUrl(logo.key) : null }
}

const withGalleryItemUrl = (
  row: SupplierGalleryItem,
  mediaKey: string,
): SupplierGalleryItemResponse => ({
  ...row,
  imageUrl: getPublicUrl(mediaKey),
})

const requireReadyMedia = async (mediaId: string): Promise<void> => {
  if (!(await getReady(mediaId))) {
    throw new AppError('MEDIA_NOT_READY')
  }
}

const requireSupplier = async (id: string): Promise<void> => {
  const [row] = await db
    .select({ id: suppliers.id })
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1)

  if (!row) throw new AppError('NOT_FOUND')
}

const listGallery = async (
  supplierId: string,
): Promise<SupplierGalleryItemResponse[]> => {
  const rows = await db
    .select()
    .from(supplierGalleryItems)
    .where(eq(supplierGalleryItems.supplierId, supplierId))
    .orderBy(
      asc(supplierGalleryItems.displayOrder),
      asc(supplierGalleryItems.createdAt),
      asc(supplierGalleryItems.id),
    )

  return Promise.all(
    rows.map(async (row) => {
      const image = await getReady(row.mediaId)
      if (!image) throw new Error(`gallery media ${row.mediaId} is not ready`)
      return withGalleryItemUrl(row, image.key)
    }),
  )
}

const withDetail = async (row: Supplier): Promise<SupplierDetailResponse> => {
  const [base, gallery] = await Promise.all([
    withLogoUrl(row),
    listGallery(row.id),
  ])

  const featured = row.featuredMediaId
    ? await getReady(row.featuredMediaId)
    : null

  return {
    ...base,
    featuredImageUrl: featured ? getPublicUrl(featured.key) : null,
    gallery,
  }
}

export const create = async (
  input: CreateSupplierInput,
): Promise<SupplierResponse> => {
  if (input.logoMediaId) await requireReadyMedia(input.logoMediaId)
  if (input.featuredMediaId) await requireReadyMedia(input.featuredMediaId)

  const created = await db
    .insert(suppliers)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      logoMediaId: input.logoMediaId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      websiteUrl: input.websiteUrl ?? null,
      address: input.address ?? null,
      featuredMediaId: input.featuredMediaId ?? null,
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('SLUG_TAKEN')
      }
      throw error
    })

  const [row] = created
  if (!row) throw new Error('create failed: insert returned no row')

  return withLogoUrl(row)
}

export const listVisible = async (): Promise<SupplierResponse[]> => {
  const rows = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.visible, true))
    .orderBy(asc(suppliers.name))

  return Promise.all(rows.map(withLogoUrl))
}

export const listAll = async (): Promise<SupplierResponse[]> => {
  const rows = await db.select().from(suppliers).orderBy(asc(suppliers.name))

  return Promise.all(rows.map(withLogoUrl))
}

export const getBySlug = async (
  slug: string,
): Promise<SupplierDetailResponse | null> => {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.slug, slug), eq(suppliers.visible, true)))
    .limit(1)

  return row ? withDetail(row) : null
}

export const getById = async (
  id: string,
): Promise<SupplierDetailResponse | null> => {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1)

  return row ? withDetail(row) : null
}

export const update = async (
  id: string,
  patch: UpdateSupplierInput,
): Promise<SupplierResponse> => {
  if (patch.logoMediaId) await requireReadyMedia(patch.logoMediaId)
  if (patch.featuredMediaId) await requireReadyMedia(patch.featuredMediaId)

  const updated = await db
    .update(suppliers)
    .set(patch)
    .where(eq(suppliers.id, id))
    .returning()
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('SLUG_TAKEN')
      }
      throw error
    })

  const [row] = updated
  if (!row) throw new AppError('NOT_FOUND')

  return withLogoUrl(row)
}

export const remove = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(suppliers)
    .where(eq(suppliers.id, id))
    .returning({ id: suppliers.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError('SUPPLIER_IN_USE')
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

export const addGalleryItem = async (
  supplierId: string,
  input: CreateGalleryItemInput,
): Promise<SupplierGalleryItemResponse> => {
  await requireSupplier(supplierId)

  const image = await getReady(input.mediaId)
  if (!image) throw new AppError('MEDIA_NOT_READY')

  let displayOrder = input.displayOrder
  if (displayOrder === undefined) {
    const [row] = await db
      .select({
        next: sql<number>`coalesce(max(${supplierGalleryItems.displayOrder}), -1) + 1`,
      })
      .from(supplierGalleryItems)
      .where(eq(supplierGalleryItems.supplierId, supplierId))
    displayOrder = Number(row?.next ?? 0)
  }

  const created = await db
    .insert(supplierGalleryItems)
    .values({
      supplierId,
      mediaId: input.mediaId,
      caption: input.caption ?? null,
      altText: input.altText,
      linkUrl: input.linkUrl ?? null,
      displayOrder,
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('GALLERY_MEDIA_DUPLICATE')
      }
      throw error
    })

  const [row] = created
  if (!row) throw new Error('addGalleryItem failed: insert returned no row')

  return withGalleryItemUrl(row, image.key)
}

export const updateGalleryItem = async (
  supplierId: string,
  itemId: string,
  patch: UpdateGalleryItemInput,
): Promise<SupplierGalleryItemResponse> => {
  const updated = await db
    .update(supplierGalleryItems)
    .set(patch)
    .where(
      and(
        eq(supplierGalleryItems.id, itemId),
        eq(supplierGalleryItems.supplierId, supplierId),
      ),
    )
    .returning()

  const [row] = updated
  if (!row) throw new AppError('NOT_FOUND')

  const image = await getReady(row.mediaId)
  if (!image) throw new Error(`gallery media ${row.mediaId} is not ready`)

  return withGalleryItemUrl(row, image.key)
}

export const removeGalleryItem = async (
  supplierId: string,
  itemId: string,
): Promise<void> => {
  const deleted = await db
    .delete(supplierGalleryItems)
    .where(
      and(
        eq(supplierGalleryItems.id, itemId),
        eq(supplierGalleryItems.supplierId, supplierId),
      ),
    )
    .returning({ id: supplierGalleryItems.id })

  if (deleted.length === 0) throw new AppError('NOT_FOUND')
}

export const reorderGallery = async (
  supplierId: string,
  itemIds: string[],
): Promise<SupplierGalleryItemResponse[]> => {
  await requireSupplier(supplierId)

  const existing = await db
    .select({ id: supplierGalleryItems.id })
    .from(supplierGalleryItems)
    .where(eq(supplierGalleryItems.supplierId, supplierId))

  const existingIds = new Set(existing.map((row) => row.id))
  const matches =
    existingIds.size === itemIds.length &&
    itemIds.every((id) => existingIds.has(id))

  if (!matches) throw new AppError('GALLERY_ORDER_MISMATCH')

  await db.transaction(async (tx) => {
    for (const [index, itemId] of itemIds.entries()) {
      await tx
        .update(supplierGalleryItems)
        .set({ displayOrder: index })
        .where(eq(supplierGalleryItems.id, itemId))
    }
  })

  return listGallery(supplierId)
}
