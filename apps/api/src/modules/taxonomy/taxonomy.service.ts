import { asc, eq, sql } from 'drizzle-orm'

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
  CreateSpaceInput,
  CreateUnitInput,
  UpdateAttributeInput,
  UpdateCategoryInput,
  UpdateSpaceInput,
  UpdateUnitInput,
} from './taxonomy.schemas'
import {
  categories,
  spaces,
  SPEC_ATTRIBUTE_NAME_INDEX,
  specAttributes,
  units,
} from './taxonomy.tables'

export type Category = typeof categories.$inferSelect
export type CategoryNode = Category & { children: CategoryNode[] }
export type SpecAttribute = typeof specAttributes.$inferSelect
export type Unit = typeof units.$inferSelect
export type Space = typeof spaces.$inferSelect
export type UnitRef = { id: string; name: string; symbol: string }

export const DEFAULT_UNIT_SLUG = 'piece'

const asSlugConflict = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new AppError('SLUG_TAKEN')
  }
  throw error
}

const asAttributeConflict = (error: unknown): never => {
  if (uniqueViolationConstraint(error) === SPEC_ATTRIBUTE_NAME_INDEX) {
    throw new AppError('NAME_TAKEN')
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
    throw new AppError('PARENT_NOT_FOUND')
  }

  while (cursor) {
    if (cursor.id === childId) {
      throw new AppError('PARENT_CYCLE')
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

  if (!row) throw new AppError('NOT_FOUND')

  return row
}

export const removeCategory = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(categories)
    .where(eq(categories.id, id))
    .returning({ id: categories.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError('CATEGORY_IN_USE')
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
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

const attributeHasSpecs = async (id: string): Promise<boolean> => {
  const [row] = await db.execute<{ used: boolean }>(
    sql`select exists(select 1 from "product_specs" where "attribute_id" = ${id}) as "used"`,
  )
  return row?.used === true
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
      type: input.type,
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
  if (patch.type !== undefined) {
    const [current] = await db
      .select({ type: specAttributes.type })
      .from(specAttributes)
      .where(eq(specAttributes.id, id))
      .limit(1)
    if (!current) throw new AppError('NOT_FOUND')
    if (current.type !== patch.type && (await attributeHasSpecs(id))) {
      throw new AppError('ATTRIBUTE_TYPE_LOCKED')
    }
  }

  const [row] = await db
    .update(specAttributes)
    .set(patch)
    .where(eq(specAttributes.id, id))
    .returning()
    .catch(asAttributeConflict)

  if (!row) throw new AppError('NOT_FOUND')

  return row
}

export const removeAttribute = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(specAttributes)
    .where(eq(specAttributes.id, id))
    .returning({ id: specAttributes.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError('ATTRIBUTE_IN_USE')
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

export const listAttributes = async (): Promise<SpecAttribute[]> =>
  db.select().from(specAttributes).orderBy(asc(specAttributes.name))

export const listUnits = async (): Promise<Unit[]> =>
  db.select().from(units).orderBy(asc(units.sortOrder), asc(units.name))

export const getUnitBySlug = async (slug: string): Promise<Unit | null> => {
  const [row] = await db
    .select()
    .from(units)
    .where(eq(units.slug, slug))
    .limit(1)

  return row ?? null
}

export const createUnit = async (input: CreateUnitInput): Promise<Unit> => {
  const [row] = await db
    .insert(units)
    .values({
      name: input.name,
      symbol: input.symbol,
      slug: input.slug,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new Error('create failed: insert returned no row')

  return row
}

export const updateUnit = async (
  id: string,
  patch: UpdateUnitInput,
): Promise<Unit> => {
  const [row] = await db
    .update(units)
    .set(patch)
    .where(eq(units.id, id))
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new AppError('NOT_FOUND')

  return row
}

export const removeUnit = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(units)
    .where(eq(units.id, id))
    .returning({ id: units.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError('UNIT_IN_USE')
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

export const listSpaces = async (): Promise<Space[]> =>
  db.select().from(spaces).orderBy(asc(spaces.sortOrder), asc(spaces.name))

export const getSpaceById = async (id: string): Promise<Space | null> => {
  const [row] = await db.select().from(spaces).where(eq(spaces.id, id)).limit(1)

  return row ?? null
}

export const createSpace = async (input: CreateSpaceInput): Promise<Space> => {
  const [row] = await db
    .insert(spaces)
    .values({
      name: input.name,
      slug: input.slug,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new Error('create failed: insert returned no row')

  return row
}

export const updateSpace = async (
  id: string,
  patch: UpdateSpaceInput,
): Promise<Space> => {
  const [row] = await db
    .update(spaces)
    .set(patch)
    .where(eq(spaces.id, id))
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new AppError('NOT_FOUND')

  return row
}

export const removeSpace = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(spaces)
    .where(eq(spaces.id, id))
    .returning({ id: spaces.id })
    .catch((error: unknown) => {
      if (isReferenceViolation(error)) {
        throw new AppError('SPACE_IN_USE')
      }
      throw error
    })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}
