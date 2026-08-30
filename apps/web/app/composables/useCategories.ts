import type { CategoryNode } from '@forge-kivu/api-client'

export type CategoryRow = {
  id: string
  name: string
  slug: string
  depth: number
}

export const flattenCategories = (
  nodes: CategoryNode[],
  depth = 0,
): CategoryRow[] =>
  nodes.flatMap((node) => [
    { id: node.id, name: node.name, slug: node.slug, depth },
    ...flattenCategories(node.children, depth + 1),
  ])

export const useCategories = () => {
  const api = useApi()

  const tree = async (): Promise<CategoryNode[]> => {
    const res = await api.categories.$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  return { tree }
}
