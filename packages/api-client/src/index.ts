import { hc, type InferResponseType } from 'hono/client'

import type { AppType } from '@forge-kivu/api'

type ClientOptions = Parameters<typeof hc>[1]

export type ApiClient = ReturnType<typeof hc<AppType>>

export type SessionUser = InferResponseType<
  ApiClient['auth']['me']['$get'],
  200
>

export type AdminUser = InferResponseType<
  ApiClient['admin']['auth']['me']['$get'],
  200
>

export const createClient = (
  baseUrl: string,
  options?: ClientOptions,
): ApiClient => hc<AppType>(baseUrl, options)

export type ProductPage = InferResponseType<
  ApiClient['catalogue']['products']['$get'],
  200
>

export type ProductListItem = ProductPage['items'][number]

export type ProductFacets = InferResponseType<
  ApiClient['catalogue']['products']['facets']['$get'],
  200
>

export type AdminSupplier = InferResponseType<
  ApiClient['admin']['suppliers'][':id']['$patch'],
  200
>

export type AdminSupplierListItem = InferResponseType<
  ApiClient['admin']['suppliers']['$get'],
  200
>[number]

export type AdminProductListItem = InferResponseType<
  ApiClient['admin']['products']['$get'],
  200
>[number]

export type Settings = InferResponseType<ApiClient['settings']['$get'], 200>
