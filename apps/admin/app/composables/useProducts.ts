import type { AdminProductListItem } from '@forge-kivu/api-client'

export type ProductQuery = {
  supplierId?: string
  status?: AdminProductListItem['status']
}

export const useProducts = () => {
  const api = useApi()

  const list = async (
    query: ProductQuery = {},
  ): Promise<AdminProductListItem[]> => {
    const res = await api.admin.products.$get({ query })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  return { list }
}
