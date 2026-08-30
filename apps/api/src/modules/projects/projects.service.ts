import {
  and,
  asc,
  count,
  desc,
  eq,
  getTableColumns,
  inArray,
} from 'drizzle-orm'

import { db } from '../../db'
import { AppError } from '../../lib/errors'
import {
  getVariantRef,
  getVariantRefs,
  PRODUCT_STATUSES,
  type ProductStatus,
  type VariantRef,
} from '../catalogue/catalogue.service'
import {
  type CreateProjectInput,
  type ListProjectsQuery,
  PROJECT_SORTS,
  type UpdateProjectInput,
} from './projects.schemas'
import {
  projectItems,
  projectPhases,
  projects,
  type ProjectPhase,
} from './projects.tables'

export type Project = typeof projects.$inferSelect

export type ProjectSummary = Project & { itemCount: number }

export type ProjectItem = {
  variantId: string
  quantity: number
  sku: string | null
  price: number | null
  label: string | null
  product: { id: string; name: string; status: ProductStatus }
  category: { id: string; name: string; slug: string }
  supplier: { id: string; name: string; slug: string }
  imageUrl: string | null
}

export type ProjectPhaseCompletion = {
  phase: ProjectPhase
  completedOn: string
}

export type ProjectDetail = Project & {
  items: ProjectItem[]
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

const toItem = (
  row: { variantId: string; quantity: number },
  ref: VariantRef,
): ProjectItem => ({
  variantId: row.variantId,
  quantity: row.quantity,
  sku: ref.sku,
  price: ref.price,
  label: ref.label,
  product: ref.product,
  category: ref.category,
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

const loadItems = async (projectId: string): Promise<ProjectItem[]> => {
  const rows = await db
    .select()
    .from(projectItems)
    .where(eq(projectItems.projectId, projectId))
    .orderBy(asc(projectItems.variantId))

  if (rows.length === 0) return []

  const refs = await getVariantRefs(rows.map((row) => row.variantId))

  return rows.map((row) => toItem(row, requireRef(refs, row.variantId)))
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
      itemCount: count(projectItems.variantId),
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

  const [items, phases] = await Promise.all([loadItems(id), loadPhases(id)])

  return { ...project, items, phases }
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

export const setItem = async (
  id: string,
  ownerId: string,
  variantId: string,
  quantity: number,
): Promise<ProjectItem> => {
  await requireOwned(id, ownerId)

  const ref = await getVariantRef(variantId)
  if (!ref) throw new AppError('NOT_FOUND')
  if (ref.product.status !== PRODUCT_STATUSES.PUBLISHED) {
    throw new AppError('PRODUCT_NOT_PUBLISHED')
  }

  await db
    .insert(projectItems)
    .values({ projectId: id, variantId, quantity })
    .onConflictDoUpdate({
      target: [projectItems.projectId, projectItems.variantId],
      set: { quantity },
    })

  return toItem({ variantId, quantity }, ref)
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
    .orderBy(asc(projectItems.projectId), asc(projectItems.variantId))

  if (rows.length === 0) return new Map()

  const refs = await getVariantRefs([
    ...new Set(rows.map((row) => row.variantId)),
  ])

  const byProject = new Map<string, ProjectItem[]>()
  for (const row of rows) {
    const items = byProject.get(row.projectId) ?? []
    items.push(toItem(row, requireRef(refs, row.variantId)))
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
