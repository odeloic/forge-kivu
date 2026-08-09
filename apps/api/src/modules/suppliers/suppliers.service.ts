import { and, asc, eq } from 'drizzle-orm'

import { db } from '../../db'
import { isForeignKeyViolation, isUniqueViolation } from '../../db/errors'
import { AppError } from '../../lib/errors'
import { getPublicUrl, getReady } from '../media/media.service'
import type {
  CreateSupplierInput,
  UpdateSupplierInput,
} from './suppliers.schemas'
import { suppliers } from './suppliers.tables'

export type Supplier = typeof suppliers.$inferSelect

export type SupplierResponse = Supplier & { logoUrl: string | null }

const withLogoUrl = async (row: Supplier): Promise<SupplierResponse> => {
  if (!row.logoMediaId) return { ...row, logoUrl: null }

  const logo = await getReady(row.logoMediaId)

  return { ...row, logoUrl: logo ? getPublicUrl(logo.key) : null }
}

const requireReadyLogo = async (mediaId: string): Promise<void> => {
  if (!(await getReady(mediaId))) {
    throw new AppError('MEDIA_NOT_READY', 'Logo media is not ready')
  }
}

export const create = async (
  input: CreateSupplierInput,
): Promise<SupplierResponse> => {
  if (input.logoMediaId) await requireReadyLogo(input.logoMediaId)

  const created = await db
    .insert(suppliers)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      logoMediaId: input.logoMediaId ?? null,
    })
    .returning()
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('SLUG_TAKEN', 'Slug already in use')
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
): Promise<SupplierResponse | null> => {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.slug, slug), eq(suppliers.visible, true)))
    .limit(1)

  return row ? withLogoUrl(row) : null
}

export const getById = async (id: string): Promise<SupplierResponse | null> => {
  const [row] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, id))
    .limit(1)

  return row ? withLogoUrl(row) : null
}

export const update = async (
  id: string,
  patch: UpdateSupplierInput,
): Promise<SupplierResponse> => {
  if (patch.logoMediaId) await requireReadyLogo(patch.logoMediaId)

  const updated = await db
    .update(suppliers)
    .set(patch)
    .where(eq(suppliers.id, id))
    .returning()
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('SLUG_TAKEN', 'Slug already in use')
      }
      throw error
    })

  const [row] = updated
  if (!row) throw new AppError('NOT_FOUND', 'Supplier not found')

  return withLogoUrl(row)
}

export const remove = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(suppliers)
    .where(eq(suppliers.id, id))
    .returning({ id: suppliers.id })
    .catch((error: unknown) => {
      if (isForeignKeyViolation(error)) {
        throw new AppError('SUPPLIER_IN_USE', 'Supplier still has products')
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND', 'Supplier not found')
  }
}
