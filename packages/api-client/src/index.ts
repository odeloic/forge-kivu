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

export type ProductDetail = InferResponseType<
  ApiClient['catalogue']['products'][':supplierSlug'][':productSlug']['$get'],
  200
>

export type ProductOption = ProductDetail['options'][number]
export type ProductVariant = ProductDetail['variants'][number]

export type AdminSupplier = InferResponseType<
  ApiClient['admin']['suppliers'][':id']['$patch'],
  200
>

export type AdminSupplierListItem = InferResponseType<
  ApiClient['admin']['suppliers']['$get'],
  200
>[number]

export type SupplierDetail = InferResponseType<
  ApiClient['suppliers'][':slug']['$get'],
  200
>

export type SupplierGalleryItem = SupplierDetail['gallery'][number]

export type AdminSupplierDetail = InferResponseType<
  ApiClient['admin']['suppliers'][':id']['$get'],
  200
>

export type AdminProductListItem = InferResponseType<
  ApiClient['admin']['products']['$get'],
  200
>[number]

export type AdminProductDetail = InferResponseType<
  ApiClient['admin']['products'][':id']['$get'],
  200
>

export type AdminProductOption = AdminProductDetail['options'][number]
export type AdminProductVariant = AdminProductDetail['variants'][number]
export type AdminProductSpec = AdminProductDetail['specs'][number]
export type AdminProductMedia = AdminProductDetail['media'][number]

export type CategoryNode = InferResponseType<
  ApiClient['categories']['$get'],
  200
>[number]

export type SpecAttribute = InferResponseType<
  ApiClient['spec-attributes']['$get'],
  200
>[number]

export type Settings = InferResponseType<ApiClient['settings']['$get'], 200>

export type Project = InferResponseType<ApiClient['projects']['$post'], 201>

export type ProjectListItem = InferResponseType<
  ApiClient['projects']['$get'],
  200
>[number]

export type ProjectDetail = InferResponseType<
  ApiClient['projects'][':id']['$get'],
  200
>

export type ProjectItem = ProjectDetail['items'][number]
export type ProjectPhaseCompletion = ProjectDetail['phases'][number]

export type BoqSummary = InferResponseType<
  ApiClient['projects'][':projectId']['boqs']['$get'],
  200
>[number]

export type BoqDetail = InferResponseType<ApiClient['boqs'][':id']['$get'], 200>

export type BoqItem = BoqDetail['items'][number]

export type VariantPage = InferResponseType<
  ApiClient['catalogue']['variants']['$get'],
  200
>

export type VariantListItem = VariantPage['items'][number]
