import { asc, eq } from 'drizzle-orm'

import { db } from '../../db'
import {
  isReferenceViolation,
  isUniqueViolation,
  uniqueViolationConstraint,
} from '../../db/errors'
import { AppError } from '../../lib/errors'
import type {
  CreateAttributeInput,
  CreateCategoryInput,
  UpdateAttributeInput,
  UpdateCategoryInput,
} from './taxonomy.schemas'
import {
  categories,
  SPEC_ATTRIBUTE_NAME_INDEX,
  specAttributes,
} from './taxonomy.tables'

export type Category = typeof categories.$inferSelect
export type CategoryNode = Category & { children: CategoryNode[] }
export type SpecAttribute = typeof specAttributes.$inferSelect

const asSlugConflict = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new AppError('SLUG_TAKEN', 'Slug already in use')
  }
  throw error
}

const asAttributeConflict = (error: unknown): never => {
  if (uniqueViolationConstraint(error) === SPEC_ATTRIBUTE_NAME_INDEX) {
    throw new AppError('NAME_TAKEN', 'Attribute name already in use')
  }
  return asSlugConflict(error)
}

export const getCategoryById = async (id: string): Promise<Category | null> => {
  const [row] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)

  return row ?? null
}

const assertParentUsable = async (
  parentId: string,
  childId?: string,
): Promise<void> => {
  let cursor = await getCategoryById(parentId)
  if (!cursor) {
    throw new AppError('PARENT_NOT_FOUND', 'Parent category not found')
  }

  while (cursor) {
    if (cursor.id === childId) {
      throw new AppError(
        'PARENT_CYCLE',
        'A category cannot be moved under itself or its own descendant',
      )
    }
    cursor = cursor.parentId ? await getCategoryById(cursor.parentId) : null
  }
}

export const createCategory = async (
  input: CreateCategoryInput,
): Promise<Category> => {
  if (input.parentId) await assertParentUsable(input.parentId)

  const [row] = await db
    .insert(categories)
    .values({
      name: input.name,
      slug: input.slug,
      parentId: input.parentId ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new Error('create failed: insert returned no row')

  return row
}

export const updateCategory = async (
  id: string,
  patch: UpdateCategoryInput,
): Promise<Category> => {
  if (patch.parentId) await assertParentUsable(patch.parentId, id)

  const [row] = await db
    .update(categories)
    .set(patch)
    .where(eq(categories.id, id))
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new AppError('NOT_FOUND', 'Category not found')

  return row
}

export const removeCategory = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError(
          'CATEGORY_IN_USE',
          'Category still has children or products',
        )
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND', 'Category not found')
  }
}

export const getTree = async (): Promise<CategoryNode[]> => {
  const rows = await db
    .select()
    .from(categories)
    .orderBy(asc(categories.sortOrder), asc(categories.name))

  const nodes = new Map<string, CategoryNode>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  )

  const roots: CategoryNode[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)
    if (!node) continue

    const parent = row.parentId ? nodes.get(row.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  return roots
}

export const createAttribute = async (
  input: CreateAttributeInput,
): Promise<SpecAttribute> => {
  const [row] = await db
    .insert(specAttributes)
    .values({
      name: input.name,
      slug: input.slug,
      unit: input.unit ?? null,
    })
    .returning()
    .catch(asAttributeConflict)

  if (!row) throw new Error('create failed: insert returned no row')

  return row
}

export const updateAttribute = async (
  id: string,
  patch: UpdateAttributeInput,
): Promise<SpecAttribute> => {
  const [row] = await db
    .update(specAttributes)
    .set(patch)
    .where(eq(specAttributes.id, id))
    .returning()
    .catch(asAttributeConflict)

  if (!row) throw new AppError('NOT_FOUND', 'Spec attribute not found')

  return row
}

export const removeAttribute = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(specAttributes)
    .where(eq(specAttributes.id, id))
    .returning({ id: specAttributes.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError(
          'ATTRIBUTE_IN_USE',
          'Spec attribute is still used by products',
        )
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND', 'Spec attribute not found')
  }
}

export const listAttributes = async (): Promise<SpecAttribute[]> =>
  db.select().from(specAttributes).orderBy(asc(specAttributes.name))
