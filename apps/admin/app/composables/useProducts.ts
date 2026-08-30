import type {
  AdminProductDetail,
  AdminProductListItem,
} from '@forge-kivu/api-client'
import type {
  CreateProductInput,
  ProductStatus,
  SetMediaInput,
  SetOptionsInput,
  SetSpecsInput,
  SetVariantsInput,
  UpdateProductInput,
} from '@forge-kivu/types'

export type ProductQuery = {
  supplierId?: string
  status?: ProductStatus
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

  const detail = async (id: string): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].$get({ param: { id } })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const create = async (
    input: CreateProductInput,
  ): Promise<AdminProductDetail> => {
    const res = await api.admin.products.$post({ json: input })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const update = async (
    id: string,
    patch: UpdateProductInput,
  ): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].$patch({
      param: { id },
      json: patch,
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const remove = async (id: string): Promise<void> => {
    const res = await api.admin.products[':id'].$delete({ param: { id } })
    if (!res.ok) throw await toApiError(res)
  }

  const publish = async (id: string): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].publish.$post({
      param: { id },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const unpublish = async (id: string): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].unpublish.$post({
      param: { id },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const setOptions = async (
    id: string,
    input: SetOptionsInput,
  ): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].options.$put({
      param: { id },
      json: input,
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const setVariants = async (
    id: string,
    input: SetVariantsInput,
  ): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].variants.$put({
      param: { id },
      json: input,
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const setSpecs = async (
    id: string,
    input: SetSpecsInput,
  ): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].specs.$put({
      param: { id },
      json: input,
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const setMedia = async (
    id: string,
    input: SetMediaInput,
  ): Promise<AdminProductDetail> => {
    const res = await api.admin.products[':id'].media.$put({
      param: { id },
      json: input,
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  return {
    list,
    detail,
    create,
    update,
    remove,
    publish,
    unpublish,
    setOptions,
    setVariants,
    setSpecs,
    setMedia,
  }
}
