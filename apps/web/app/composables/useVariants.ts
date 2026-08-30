import type { VariantPage } from '@forge-kivu/api-client'

export type VariantQuery = {
  q?: string
  category?: string
  supplier?: string
  page?: string
}

export const useVariants = () => {
  const api = useApi()

  const list = async (query: VariantQuery = {}): Promise<VariantPage> => {
    const res = await api.catalogue.variants.$get({ query })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  return { list }
}
