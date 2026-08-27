import type {
  AdminSupplier,
  AdminSupplierListItem,
} from '@forge-kivu/api-client'

export type SupplierInput = {
  name: string
  slug: string
  description: string | null
}

export const useSuppliers = () => {
  const api = useApi()

  const list = async (): Promise<AdminSupplierListItem[]> => {
    const res = await api.admin.suppliers.$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const create = async (input: SupplierInput): Promise<AdminSupplier> => {
    const res = await api.admin.suppliers.$post({ json: input })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const update = async (
    id: string,
    patch: Partial<SupplierInput & { visible: boolean }>,
  ): Promise<AdminSupplier> => {
    const res = await api.admin.suppliers[':id'].$patch({
      param: { id },
      json: patch,
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const remove = async (id: string): Promise<void> => {
    const res = await api.admin.suppliers[':id'].$delete({ param: { id } })
    if (!res.ok) throw await toApiError(res)
  }

  return { list, create, update, remove }
}
