import { and, asc, desc, eq } from 'drizzle-orm'

import { db } from '../../db'
import { AppError } from '../../lib/errors'
import {
  getVariantRef,
  getVariantRefs,
  PRODUCT_STATUSES,
  type ProductStatus,
} from '../catalogue/catalogue.service'
import type { CreateProjectInput, UpdateProjectInput } from './projects.schemas'
import { projectItems, projects } from './projects.tables'

export type Project = typeof projects.$inferSelect

export type ProjectItem = {
  variantId: string
  quantity: number
  sku: string | null
  price: number | null
  label: string | null
  product: { id: string; name: string; status: ProductStatus }
}

export type ProjectDetail = Project & { items: ProjectItem[] }

const ownedBy = (id: string, ownerId: string) =>
  and(eq(projects.id, id), eq(projects.ownerId, ownerId))

export const findOwned = async (
  id: string,
  ownerId: string,
): Promise<Project | null> => {
  const [row] = await db
    .select()
    .from(projects)
    .where(ownedBy(id, ownerId))
    .limit(1)

  return row ?? null
}

const requireOwned = async (id: string, ownerId: string): Promise<Project> => {
  const row = await findOwned(id, ownerId)
  if (!row) throw new AppError('NOT_FOUND', 'Project not found')
  return row
}

const loadItems = async (projectId: string): Promise<ProjectItem[]> => {
  const rows = await db
    .select()
    .from(projectItems)
    .where(eq(projectItems.projectId, projectId))
    .orderBy(asc(projectItems.variantId))

  if (rows.length === 0) return []

  const refs = await getVariantRefs(rows.map((row) => row.variantId))

  return rows.map((row) => {
    const ref = refs.get(row.variantId)
    if (!ref) {
      throw new Error(
        `projects: item references a missing variant ${row.variantId}`,
      )
    }
    return {
      variantId: row.variantId,
      quantity: row.quantity,
      sku: ref.sku,
      price: ref.price,
      label: ref.label,
      product: ref.product,
    }
  })
}

export const create = async (
  ownerId: string,
  input: CreateProjectInput,
): Promise<Project> => {
  const [row] = await db
    .insert(projects)
    .values({ ownerId, ...input })
    .returning()

  if (!row) throw new Error('create failed: insert returned no row')

  return row
}

export const update = async (
  id: string,
  ownerId: string,
  patch: UpdateProjectInput,
): Promise<Project> => {
  const [row] = await db
    .update(projects)
    .set(patch)
    .where(ownedBy(id, ownerId))
    .returning()

  if (!row) throw new AppError('NOT_FOUND', 'Project not found')

  return row
}

export const list = async (ownerId: string): Promise<Project[]> =>
  db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.createdAt))

export const getOwned = async (
  id: string,
  ownerId: string,
): Promise<ProjectDetail | null> => {
  const project = await findOwned(id, ownerId)
  if (!project) return null

  return { ...project, items: await loadItems(id) }
}

export const remove = async (id: string, ownerId: string): Promise<void> => {
  const deleted = await db
    .delete(projects)
    .where(ownedBy(id, ownerId))
    .returning({ id: projects.id })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND', 'Project not found')
  }
}

export const setItem = async (
  id: string,
  ownerId: string,
  variantId: string,
  quantity: number,
): Promise<ProjectItem> => {
  await requireOwned(id, ownerId)

  const ref = await getVariantRef(variantId)
  if (!ref) throw new AppError('NOT_FOUND', 'Variant not found')
  if (ref.product.status !== PRODUCT_STATUSES.PUBLISHED) {
    throw new AppError('PRODUCT_NOT_PUBLISHED', 'Product is not published')
  }

  await db
    .insert(projectItems)
    .values({ projectId: id, variantId, quantity })
    .onConflictDoUpdate({
      target: [projectItems.projectId, projectItems.variantId],
      set: { quantity },
    })

  return {
    variantId,
    quantity,
    sku: ref.sku,
    price: ref.price,
    label: ref.label,
    product: ref.product,
  }
}

export const removeItem = async (
  id: string,
  ownerId: string,
  variantId: string,
): Promise<void> => {
  await requireOwned(id, ownerId)

  const deleted = await db
    .delete(projectItems)
    .where(
      and(
        eq(projectItems.projectId, id),
        eq(projectItems.variantId, variantId),
      ),
    )
    .returning({ variantId: projectItems.variantId })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND', 'Item not found')
  }
}

export const listItems = async (
  id: string,
  ownerId: string,
): Promise<ProjectItem[]> => {
  await requireOwned(id, ownerId)

  return loadItems(id)
}
