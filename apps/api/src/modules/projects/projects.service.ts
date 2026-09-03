import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
} from 'drizzle-orm'

import { PROJECT_LIMITS } from '@forge-kivu/types'

import { db } from '../../db'
import { uniqueViolationConstraint } from '../../db/errors'
import { AppError } from '../../lib/errors'
import {
  getVariantRef,
  getVariantRefs,
  PRODUCT_STATUSES,
  type ProductStatus,
  type VariantRef,
} from '../catalogue/catalogue.service'
import { getSpaceById } from '../taxonomy/taxonomy.service'
import {
  type CreateProjectInput,
  type CreateProjectSpaceInput,
  type ListProjectsQuery,
  PROJECT_SORTS,
  type SetItemInput,
  type UpdateProjectInput,
  type UpdateProjectSpaceInput,
} from './projects.schemas'
import {
  PROJECT_SPACE_NAME_INDEX,
  projectItems,
  projectPhases,
  projects,
  projectSpaces,
  type ProjectPhase,
} from './projects.tables'

export type Project = typeof projects.$inferSelect

export type ProjectSummary = Project & { itemCount: number }

export type ProjectSpace = typeof projectSpaces.$inferSelect

export type ProjectSpaceRef = { id: string; name: string }

export type ProjectItem = {
  id: string
  variantId: string
  quantity: number
  space: ProjectSpaceRef | null
  sku: string | null
  price: number | null
  unit: { id: string; name: string; symbol: string }
  label: string | null
  options: VariantRef['options']
  product: { id: string; name: string; status: ProductStatus }
  category: { id: string; name: string; slug: string }
  categoryRoot: { id: string; name: string; slug: string }
  supplier: { id: string; name: string; slug: string }
  imageUrl: string | null
}

export type ProjectPhaseCompletion = {
  phase: ProjectPhase
  completedOn: string
}

export type ProjectDetail = Project & {
  items: ProjectItem[]
  spaces: ProjectSpace[]
  phases: ProjectPhaseCompletion[]
}

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
  if (!row) throw new AppError('NOT_FOUND')
  return row
}

type ItemRow = typeof projectItems.$inferSelect

const toItem = (
  row: ItemRow,
  ref: VariantRef,
  space: ProjectSpaceRef | null,
): ProjectItem => ({
  id: row.id,
  variantId: row.variantId,
  quantity: row.quantity,
  space,
  sku: ref.sku,
  price: ref.price,
  unit: ref.unit,
  label: ref.label,
  options: ref.options,
  product: ref.product,
  category: ref.category,
  categoryRoot: ref.categoryRoot,
  supplier: ref.supplier,
  imageUrl: ref.imageUrl,
})

const requireRef = (
  refs: Map<string, VariantRef>,
  variantId: string,
): VariantRef => {
  const ref = refs.get(variantId)
  if (!ref) {
    throw new Error(`projects: item references a missing variant ${variantId}`)
  }
  return ref
}

const spaceRefsFor = async (
  projectIds: string[],
): Promise<Map<string, ProjectSpaceRef>> => {
  if (projectIds.length === 0) return new Map()

  const rows = await db
    .select({ id: projectSpaces.id, name: projectSpaces.name })
    .from(projectSpaces)
    .where(inArray(projectSpaces.projectId, projectIds))

  return new Map(rows.map((row) => [row.id, row]))
}

const spaceOf = (
  spaceById: Map<string, ProjectSpaceRef>,
  spaceId: string | null,
): ProjectSpaceRef | null =>
  spaceId === null ? null : (spaceById.get(spaceId) ?? null)

const loadSpaces = async (projectId: string): Promise<ProjectSpace[]> =>
  db
    .select()
    .from(projectSpaces)
    .where(eq(projectSpaces.projectId, projectId))
    .orderBy(asc(projectSpaces.sortOrder), asc(projectSpaces.createdAt))

const loadItems = async (projectId: string): Promise<ProjectItem[]> => {
  const rows = await db
    .select()
    .from(projectItems)
    .where(eq(projectItems.projectId, projectId))
    .orderBy(asc(projectItems.variantId), asc(projectItems.spaceId))

  if (rows.length === 0) return []

  const [refs, spaceById] = await Promise.all([
    getVariantRefs(rows.map((row) => row.variantId)),
    spaceRefsFor([projectId]),
  ])

  return rows.map((row) =>
    toItem(
      row,
      requireRef(refs, row.variantId),
      spaceOf(spaceById, row.spaceId),
    ),
  )
}

const loadPhases = async (
  projectId: string,
): Promise<ProjectPhaseCompletion[]> =>
  db
    .select({
      phase: projectPhases.phase,
      completedOn: projectPhases.completedOn,
    })
    .from(projectPhases)
    .where(eq(projectPhases.projectId, projectId))
    .orderBy(asc(projectPhases.phase))

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

  if (!row) throw new AppError('NOT_FOUND')

  return row
}

export const list = async (
  ownerId: string,
  query: ListProjectsQuery,
): Promise<ProjectSummary[]> => {
  const conditions = [eq(projects.ownerId, ownerId)]
  if (query.projectType) {
    conditions.push(eq(projects.projectType, query.projectType))
  }
  if (query.phase) conditions.push(eq(projects.phase, query.phase))

  const sortColumn =
    query.sort === PROJECT_SORTS.CREATED_AT
      ? projects.createdAt
      : projects.updatedAt

  return db
    .select({
      ...getTableColumns(projects),
      itemCount: count(projectItems.id),
    })
    .from(projects)
    .leftJoin(projectItems, eq(projectItems.projectId, projects.id))
    .where(and(...conditions))
    .groupBy(projects.id)
    .orderBy(desc(sortColumn))
}

export const getOwned = async (
  id: string,
  ownerId: string,
): Promise<ProjectDetail | null> => {
  const project = await findOwned(id, ownerId)
  if (!project) return null

  const [items, spaces, phases] = await Promise.all([
    loadItems(id),
    loadSpaces(id),
    loadPhases(id),
  ])

  return { ...project, items, spaces, phases }
}

export const remove = async (id: string, ownerId: string): Promise<void> => {
  const deleted = await db
    .delete(projects)
    .where(ownedBy(id, ownerId))
    .returning({ id: projects.id })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

const findProjectSpace = async (
  projectId: string,
  spaceId: string,
): Promise<ProjectSpace | null> => {
  const [row] = await db
    .select()
    .from(projectSpaces)
    .where(
      and(
        eq(projectSpaces.projectId, projectId),
        eq(projectSpaces.id, spaceId),
      ),
    )
    .limit(1)

  return row ?? null
}

const requireProjectSpace = async (
  projectId: string,
  spaceId: string,
): Promise<ProjectSpace> => {
  const row = await findProjectSpace(projectId, spaceId)
  if (!row) throw new AppError('NOT_FOUND')
  return row
}

const spaceCondition = (spaceId: string | null) =>
  spaceId === null
    ? isNull(projectItems.spaceId)
    : eq(projectItems.spaceId, spaceId)

export const setItem = async (
  id: string,
  ownerId: string,
  variantId: string,
  input: SetItemInput,
): Promise<ProjectItem> => {
  await requireOwned(id, ownerId)

  const spaceId = input.spaceId ?? null
  const space = spaceId === null ? null : await requireProjectSpace(id, spaceId)

  const ref = await getVariantRef(variantId)
  if (!ref) throw new AppError('NOT_FOUND')
  if (ref.product.status !== PRODUCT_STATUSES.PUBLISHED) {
    throw new AppError('PRODUCT_NOT_PUBLISHED')
  }

  const [row] = await db
    .insert(projectItems)
    .values({ projectId: id, variantId, spaceId, quantity: input.quantity })
    .onConflictDoUpdate({
      target: [
        projectItems.projectId,
        projectItems.variantId,
        projectItems.spaceId,
      ],
      set: { quantity: input.quantity },
    })
    .returning()

  if (!row) throw new Error('setItem failed: upsert returned no row')

  return toItem(row, ref, space ? { id: space.id, name: space.name } : null)
}

export const removeItem = async (
  id: string,
  ownerId: string,
  variantId: string,
  spaceId: string | null,
): Promise<void> => {
  await requireOwned(id, ownerId)

  const deleted = await db
    .delete(projectItems)
    .where(
      and(
        eq(projectItems.projectId, id),
        eq(projectItems.variantId, variantId),
        spaceCondition(spaceId),
      ),
    )
    .returning({ id: projectItems.id })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

const asSpaceConflict = (error: unknown): never => {
  if (uniqueViolationConstraint(error) === PROJECT_SPACE_NAME_INDEX) {
    throw new AppError('PROJECT_SPACE_DUPLICATE')
  }
  throw error
}

const assertCanonicalSpace = async (spaceId: string): Promise<void> => {
  if (!(await getSpaceById(spaceId))) throw new AppError('NOT_FOUND')
}

export const createSpace = async (
  id: string,
  ownerId: string,
  input: CreateProjectSpaceInput,
): Promise<ProjectSpace> => {
  await requireOwned(id, ownerId)
  if (input.spaceId) await assertCanonicalSpace(input.spaceId)

  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(projectSpaces)
    .where(eq(projectSpaces.projectId, id))
  if (total >= PROJECT_LIMITS.spaces) throw new AppError('PROJECT_SPACE_LIMIT')

  const [row] = await db
    .insert(projectSpaces)
    .values({
      projectId: id,
      name: input.name,
      spaceId: input.spaceId ?? null,
      sortOrder: total,
    })
    .returning()
    .catch(asSpaceConflict)

  if (!row) throw new Error('createSpace failed: insert returned no row')

  return row
}

export const updateSpace = async (
  id: string,
  ownerId: string,
  spaceId: string,
  patch: UpdateProjectSpaceInput,
): Promise<ProjectSpace> => {
  await requireOwned(id, ownerId)
  if (patch.spaceId) await assertCanonicalSpace(patch.spaceId)

  const [row] = await db
    .update(projectSpaces)
    .set(patch)
    .where(and(eq(projectSpaces.projectId, id), eq(projectSpaces.id, spaceId)))
    .returning()
    .catch(asSpaceConflict)

  if (!row) throw new AppError('NOT_FOUND')

  return row
}

export const removeSpace = async (
  id: string,
  ownerId: string,
  spaceId: string,
): Promise<void> => {
  await requireOwned(id, ownerId)

  const deleted = await db
    .delete(projectSpaces)
    .where(and(eq(projectSpaces.projectId, id), eq(projectSpaces.id, spaceId)))
    .returning({ id: projectSpaces.id })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

export const listItems = async (
  id: string,
  ownerId: string,
): Promise<ProjectItem[]> => {
  await requireOwned(id, ownerId)

  return loadItems(id)
}

export const listItemsForProjects = async (
  projectIds: string[],
): Promise<Map<string, ProjectItem[]>> => {
  if (projectIds.length === 0) return new Map()

  const rows = await db
    .select()
    .from(projectItems)
    .where(inArray(projectItems.projectId, projectIds))
    .orderBy(
      asc(projectItems.projectId),
      asc(projectItems.variantId),
      asc(projectItems.spaceId),
    )

  if (rows.length === 0) return new Map()

  const [refs, spaceById] = await Promise.all([
    getVariantRefs([...new Set(rows.map((row) => row.variantId))]),
    spaceRefsFor(projectIds),
  ])

  const byProject = new Map<string, ProjectItem[]>()
  for (const row of rows) {
    const items = byProject.get(row.projectId) ?? []
    items.push(
      toItem(
        row,
        requireRef(refs, row.variantId),
        spaceOf(spaceById, row.spaceId),
      ),
    )
    byProject.set(row.projectId, items)
  }

  return byProject
}

export const setPhaseCompletion = async (
  id: string,
  ownerId: string,
  phase: ProjectPhase,
  completedOn: string,
): Promise<ProjectPhaseCompletion> => {
  await requireOwned(id, ownerId)

  const [row] = await db
    .insert(projectPhases)
    .values({ projectId: id, phase, completedOn })
    .onConflictDoUpdate({
      target: [projectPhases.projectId, projectPhases.phase],
      set: { completedOn },
    })
    .returning({
      phase: projectPhases.phase,
      completedOn: projectPhases.completedOn,
    })

  if (!row) throw new Error('setPhaseCompletion failed: upsert returned no row')

  return row
}

export const clearPhaseCompletion = async (
  id: string,
  ownerId: string,
  phase: ProjectPhase,
): Promise<void> => {
  await requireOwned(id, ownerId)

  const deleted = await db
    .delete(projectPhases)
    .where(and(eq(projectPhases.projectId, id), eq(projectPhases.phase, phase)))
    .returning({ phase: projectPhases.phase })

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}
