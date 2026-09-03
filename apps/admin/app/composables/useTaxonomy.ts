import type { CategoryNode, SpecAttribute, Unit } from '@forge-kivu/api-client'
import type {
  CreateAttributeInput,
  CreateCategoryInput,
  UpdateAttributeInput,
  UpdateCategoryInput,
} from '@forge-kivu/types'

export type CategoryRow = {
  id: string
  name: string
  slug: string
  sortOrder: number
  parentId: string | null
  depth: number
  hasChildren: boolean
}

export const flattenTree = (nodes: CategoryNode[], depth = 0): CategoryRow[] =>
  nodes.flatMap((node) => [
    {
      id: node.id,
      name: node.name,
      slug: node.slug,
      sortOrder: node.sortOrder,
      parentId: node.parentId,
      depth,
      hasChildren: node.children.length > 0,
    },
    ...flattenTree(node.children, depth + 1),
  ])

export const descendantIds = (rows: CategoryRow[], id: string): Set<string> => {
  const banned = new Set([id])
  for (const row of rows) {
    if (row.parentId && banned.has(row.parentId)) banned.add(row.id)
  }
  return banned
}

export const useTaxonomy = () => {
  const api = useApi()

  const tree = async (): Promise<CategoryNode[]> => {
    const res = await api.categories.$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const attributes = async (): Promise<SpecAttribute[]> => {
    const res = await api['spec-attributes'].$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const units = async (): Promise<Unit[]> => {
    const res = await api.units.$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const createCategory = async (input: CreateCategoryInput): Promise<void> => {
    const res = await api.admin.categories.$post({ json: input })
    if (!res.ok) throw await toApiError(res)
  }

  const updateCategory = async (
    id: string,
    patch: UpdateCategoryInput,
  ): Promise<void> => {
    const res = await api.admin.categories[':id'].$patch({
      param: { id },
      json: patch,
    })
    if (!res.ok) throw await toApiError(res)
  }

  const removeCategory = async (id: string): Promise<void> => {
    const res = await api.admin.categories[':id'].$delete({ param: { id } })
    if (!res.ok) throw await toApiError(res)
  }

  const createAttribute = async (
    input: CreateAttributeInput,
  ): Promise<void> => {
    const res = await api.admin['spec-attributes'].$post({ json: input })
    if (!res.ok) throw await toApiError(res)
  }

  const updateAttribute = async (
    id: string,
    patch: UpdateAttributeInput,
  ): Promise<void> => {
    const res = await api.admin['spec-attributes'][':id'].$patch({
      param: { id },
      json: patch,
    })
    if (!res.ok) throw await toApiError(res)
  }

  const removeAttribute = async (id: string): Promise<void> => {
    const res = await api.admin['spec-attributes'][':id'].$delete({
      param: { id },
    })
    if (!res.ok) throw await toApiError(res)
  }

  return {
    tree,
    attributes,
    units,
    createCategory,
    updateCategory,
    removeCategory,
    createAttribute,
    updateAttribute,
    removeAttribute,
  }
}
