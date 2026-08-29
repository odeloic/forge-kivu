import type {
  AdminSupplier,
  AdminSupplierDetail,
  AdminSupplierListItem,
} from '@forge-kivu/api-client'
import type {
  CreateSupplierInput,
  UpdateGalleryItemInput,
  UpdateSupplierInput,
} from '@forge-kivu/types'

export type SupplierInput = CreateSupplierInput
export type SupplierPatch = UpdateSupplierInput

export const useSuppliers = () => {
  const api = useApi()

  const list = async (): Promise<AdminSupplierListItem[]> => {
    const res = await api.admin.suppliers.$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const detail = async (id: string): Promise<AdminSupplierDetail> => {
    const res = await api.admin.suppliers[':id'].$get({ param: { id } })
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
    patch: SupplierPatch,
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

  const addGalleryItem = async (id: string, mediaId: string): Promise<void> => {
    const res = await api.admin.suppliers[':id'].gallery.$post({
      param: { id },
      json: { mediaId },
    })
    if (!res.ok) throw await toApiError(res)
  }

  const updateGalleryItem = async (
    id: string,
    itemId: string,
    patch: UpdateGalleryItemInput,
  ): Promise<void> => {
    const res = await api.admin.suppliers[':id'].gallery[':itemId'].$patch({
      param: { id, itemId },
      json: patch,
    })
    if (!res.ok) throw await toApiError(res)
  }

  const removeGalleryItem = async (
    id: string,
    itemId: string,
  ): Promise<void> => {
    const res = await api.admin.suppliers[':id'].gallery[':itemId'].$delete({
      param: { id, itemId },
    })
    if (!res.ok) throw await toApiError(res)
  }

  const reorderGallery = async (
    id: string,
    itemIds: string[],
  ): Promise<void> => {
    const res = await api.admin.suppliers[':id'].gallery.order.$put({
      param: { id },
      json: { itemIds },
    })
    if (!res.ok) throw await toApiError(res)
  }

  return {
    list,
    detail,
    create,
    update,
    remove,
    addGalleryItem,
    updateGalleryItem,
    removeGalleryItem,
    reorderGallery,
  }
}
