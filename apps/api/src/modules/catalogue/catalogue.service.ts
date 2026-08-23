import { and, asc, count, desc, eq, exists, inArray, sql } from 'drizzle-orm'

import { db } from '../../db'
import { isReferenceViolation, isUniqueViolation } from '../../db/errors'
import { AppError } from '../../lib/errors'
import { getPublicUrl, getReady } from '../media/media.service'
import {
  getById as getSupplierById,
  getBySlug as getSupplierBySlug,
  listAll as listAllSuppliers,
  listVisible as listVisibleSuppliers,
} from '../suppliers/suppliers.service'
import {
  type CategoryNode,
  getCategoryById,
  getTree,
  listAttributes,
} from '../taxonomy/taxonomy.service'
import type {
  AdminListQuery,
  CreateProductInput,
  PublicListQuery,
  SetMediaInput,
  SetOptionsInput,
  SetSpecsInput,
  SetVariantsInput,
  UpdateProductInput,
} from './catalogue.schemas'
import {
  PRODUCT_STATUSES,
  productMedia,
  productOptions,
  productOptionValues,
  products,
  productSpecs,
  type ProductStatus,
  productVariants,
  variantOptionValues,
} from './catalogue.tables'

export { PRODUCT_STATUSES, type ProductStatus }

export type Product = typeof products.$inferSelect

export type ProductRef = { id: string; name: string; slug: string }

export type ProductOptionResponse = {
  id: string
  name: string
  sortOrder: number
  values: { id: string; value: string; sortOrder: number }[]
}

export type ProductVariantResponse = {
  id: string
  sku: string | null
  price: number | null
  sortOrder: number
  imageMediaId: string | null
  imageUrl: string | null
  optionValueIds: string[]
}

export type ProductSpecResponse = {
  attributeId: string
  name: string
  slug: string
  unit: string | null
  value: string
}

export type ProductMediaResponse = {
  mediaId: string
  url: string
  sortOrder: number
}

export type ProductDetail = Product & {
  supplier: ProductRef
  category: ProductRef
  options: ProductOptionResponse[]
  variants: ProductVariantResponse[]
  specs: ProductSpecResponse[]
  media: ProductMediaResponse[]
}

export type ProductListItem = {
  id: string
  name: string
  slug: string
  description: string | null
  status: ProductStatus
  supplier: ProductRef
  category: ProductRef
  priceFrom: number | null
  imageUrl: string | null
  createdAt: Date
}

export type ProductPage = {
  items: ProductListItem[]
  page: number
  pageSize: number
  total: number
}

const PAGE_SIZE = 20

const toRef = (row: ProductRef): ProductRef => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
})

const requireRef = (map: Map<string, ProductRef>, id: string): ProductRef => {
  const ref = map.get(id)
  if (!ref) throw new Error(`catalogue: no reference loaded for ${id}`)
  return ref
}

const asSlugConflict = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new AppError('SLUG_TAKEN')
  }
  throw error
}

const asVariantInUse = (error: unknown): never => {
  if (isReferenceViolation(error)) {
    throw new AppError('VARIANT_IN_USE')
  }
  throw error
}

const assertSupplier = async (supplierId: string): Promise<void> => {
  if (!(await getSupplierById(supplierId))) {
    throw new AppError('SUPPLIER_NOT_FOUND')
  }
}

const assertCategory = async (categoryId: string): Promise<void> => {
  if (!(await getCategoryById(categoryId))) {
    throw new AppError('CATEGORY_NOT_FOUND')
  }
}

const assertReadyMedia = async (mediaId: string): Promise<void> => {
  if (!(await getReady(mediaId))) {
    throw new AppError('MEDIA_NOT_READY')
  }
}

const mediaUrl = async (mediaId: string | null): Promise<string | null> => {
  if (!mediaId) return null
  const row = await getReady(mediaId)
  return row ? getPublicUrl(row.key) : null
}

const collectCategories = (
  nodes: CategoryNode[],
  into: Map<string, ProductRef>,
): Map<string, ProductRef> => {
  for (const node of nodes) {
    into.set(node.id, toRef(node))
    collectCategories(node.children, into)
  }
  return into
}

const subtreeIds = (nodes: CategoryNode[], slug: string): string[] | null => {
  for (const node of nodes) {
    if (node.slug === slug) {
      return [...collectCategories([node], new Map()).keys()]
    }
    const found = subtreeIds(node.children, slug)
    if (found) return found
  }
  return null
}

const supplierRefs = async (
  visibleOnly: boolean,
): Promise<Map<string, ProductRef>> => {
  const rows = visibleOnly
    ? await listVisibleSuppliers()
    : await listAllSuppliers()

  return new Map(rows.map((row) => [row.id, toRef(row)]))
}

const findProduct = async (id: string): Promise<Product | null> => {
  const [row] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1)

  return row ?? null
}

const requireProduct = async (id: string): Promise<Product> => {
  const row = await findProduct(id)
  if (!row) throw new AppError('NOT_FOUND')
  return row
}

const loadOptions = async (
  productId: string,
): Promise<ProductOptionResponse[]> => {
  const rows = await db
    .select({
      id: productOptions.id,
      name: productOptions.name,
      sortOrder: productOptions.sortOrder,
      valueId: productOptionValues.id,
      value: productOptionValues.value,
      valueSortOrder: productOptionValues.sortOrder,
    })
    .from(productOptions)
    .leftJoin(
      productOptionValues,
      eq(productOptionValues.optionId, productOptions.id),
    )
    .where(eq(productOptions.productId, productId))
    .orderBy(asc(productOptions.sortOrder), asc(productOptionValues.sortOrder))

  const options = new Map<string, ProductOptionResponse>()
  for (const row of rows) {
    const option = options.get(row.id) ?? {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      values: [],
    }
    if (row.valueId && row.value !== null && row.valueSortOrder !== null) {
      option.values.push({
        id: row.valueId,
        value: row.value,
        sortOrder: row.valueSortOrder,
      })
    }
    options.set(row.id, option)
  }

  return [...options.values()]
}

const loadVariants = async (
  productId: string,
): Promise<ProductVariantResponse[]> => {
  const rows = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, productId))
    .orderBy(asc(productVariants.sortOrder))

  if (rows.length === 0) return []

  const links = await db
    .select()
    .from(variantOptionValues)
    .where(
      inArray(
        variantOptionValues.variantId,
        rows.map((row) => row.id),
      ),
    )

  const valuesByVariant = new Map<string, string[]>()
  for (const link of links) {
    const ids = valuesByVariant.get(link.variantId) ?? []
    ids.push(link.optionValueId)
    valuesByVariant.set(link.variantId, ids)
  }

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      sku: row.sku,
      price: row.price,
      sortOrder: row.sortOrder,
      imageMediaId: row.imageMediaId,
      imageUrl: await mediaUrl(row.imageMediaId),
      optionValueIds: valuesByVariant.get(row.id) ?? [],
    })),
  )
}

const loadSpecs = async (productId: string): Promise<ProductSpecResponse[]> => {
  const rows = await db
    .select()
    .from(productSpecs)
    .where(eq(productSpecs.productId, productId))

  if (rows.length === 0) return []

  const attributes = new Map(
    (await listAttributes()).map((attribute) => [attribute.id, attribute]),
  )

  return rows.flatMap((row) => {
    const attribute = attributes.get(row.attributeId)
    if (!attribute) return []
    return [
      {
        attributeId: attribute.id,
        name: attribute.name,
        slug: attribute.slug,
        unit: attribute.unit,
        value: row.value,
      },
    ]
  })
}

const loadMedia = async (
  productId: string,
): Promise<ProductMediaResponse[]> => {
  const rows = await db
    .select()
    .from(productMedia)
    .where(eq(productMedia.productId, productId))
    .orderBy(asc(productMedia.sortOrder))

  const resolved = await Promise.all(
    rows.map(async (row) => ({
      mediaId: row.mediaId,
      sortOrder: row.sortOrder,
      url: await mediaUrl(row.mediaId),
    })),
  )

  return resolved.flatMap((row) =>
    row.url
      ? [{ mediaId: row.mediaId, sortOrder: row.sortOrder, url: row.url }]
      : [],
  )
}

const buildDetail = async (product: Product): Promise<ProductDetail> => {
  const [supplier, category, options, variants, specs, media] =
    await Promise.all([
      getSupplierById(product.supplierId),
      getCategoryById(product.categoryId),
      loadOptions(product.id),
      loadVariants(product.id),
      loadSpecs(product.id),
      loadMedia(product.id),
    ])

  if (!supplier || !category) {
    throw new Error('catalogue: product references a missing row')
  }

  return {
    ...product,
    supplier: toRef(supplier),
    category: toRef(category),
    options,
    variants,
    specs,
    media,
  }
}

const buildListItems = async (
  rows: Product[],
  supplierById: Map<string, ProductRef>,
  categoryById: Map<string, ProductRef>,
): Promise<ProductListItem[]> => {
  if (rows.length === 0) return []

  const productIds = rows.map((row) => row.id)

  const [variantRows, mediaRows] = await Promise.all([
    db
      .select({
        productId: productVariants.productId,
        price: productVariants.price,
      })
      .from(productVariants)
      .where(inArray(productVariants.productId, productIds)),
    db
      .select()
      .from(productMedia)
      .where(inArray(productMedia.productId, productIds))
      .orderBy(asc(productMedia.sortOrder)),
  ])

  const priceByProduct = new Map<string, number>()
  for (const variant of variantRows) {
    if (variant.price === null) continue
    const current = priceByProduct.get(variant.productId)
    if (current === undefined || variant.price < current) {
      priceByProduct.set(variant.productId, variant.price)
    }
  }

  const coverByProduct = new Map<string, string>()
  for (const row of mediaRows) {
    if (!coverByProduct.has(row.productId)) {
      coverByProduct.set(row.productId, row.mediaId)
    }
  }

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      status: row.status,
      supplier: requireRef(supplierById, row.supplierId),
      category: requireRef(categoryById, row.categoryId),
      priceFrom: priceByProduct.get(row.id) ?? null,
      imageUrl: await mediaUrl(coverByProduct.get(row.id) ?? null),
      createdAt: row.createdAt,
    })),
  )
}

export const createProduct = async (
  input: CreateProductInput,
): Promise<ProductDetail> => {
  await assertSupplier(input.supplierId)
  await assertCategory(input.categoryId)

  const product = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(products)
      .values({
        supplierId: input.supplierId,
        categoryId: input.categoryId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
      })
      .returning()
      .catch(asSlugConflict)

    if (!row) throw new Error('createProduct failed: insert returned no row')

    await tx.insert(productVariants).values({ productId: row.id })

    return row
  })

  return buildDetail(product)
}

export const updateProduct = async (
  id: string,
  patch: UpdateProductInput,
): Promise<ProductDetail> => {
  if (patch.supplierId) await assertSupplier(patch.supplierId)
  if (patch.categoryId) await assertCategory(patch.categoryId)

  const [row] = await db
    .update(products)
    .set(patch)
    .where(eq(products.id, id))
    .returning()
    .catch(asSlugConflict)

  if (!row) throw new AppError('NOT_FOUND')

  return buildDetail(row)
}

export const removeProduct = async (id: string): Promise<void> => {
  const deleted = await db
    .delete(products)
    .where(eq(products.id, id))
    .returning({ id: products.id })
    .catch(asVariantInUse)

  if (deleted.length === 0) {
    throw new AppError('NOT_FOUND')
  }
}

const setStatus = async (
  id: string,
  status: ProductStatus,
): Promise<ProductDetail> => {
  const [row] = await db
    .update(products)
    .set({ status })
    .where(eq(products.id, id))
    .returning()

  if (!row) throw new AppError('NOT_FOUND')

  return buildDetail(row)
}

export const publish = (id: string): Promise<ProductDetail> =>
  setStatus(id, PRODUCT_STATUSES.PUBLISHED)

export const unpublish = (id: string): Promise<ProductDetail> =>
  setStatus(id, PRODUCT_STATUSES.NOT_AVAILABLE)

export const setOptions = async (
  productId: string,
  input: SetOptionsInput,
): Promise<ProductDetail> => {
  const product = await requireProduct(productId)

  await db
    .transaction(async (tx) => {
      await tx
        .delete(productOptions)
        .where(eq(productOptions.productId, productId))
      await tx
        .delete(productVariants)
        .where(eq(productVariants.productId, productId))

      for (const [index, option] of input.options.entries()) {
        const [row] = await tx
          .insert(productOptions)
          .values({ productId, name: option.name, sortOrder: index })
          .returning({ id: productOptions.id })

        if (!row) throw new Error('setOptions failed: insert returned no row')

        await tx.insert(productOptionValues).values(
          option.values.map((value, order) => ({
            optionId: row.id,
            value,
            sortOrder: order,
          })),
        )
      }

      await tx.insert(productVariants).values({ productId })
    })
    .catch(asVariantInUse)

  return buildDetail(product)
}

export const setVariants = async (
  productId: string,
  input: SetVariantsInput,
): Promise<ProductDetail> => {
  const product = await requireProduct(productId)
  const options = await loadOptions(productId)

  const optionIdByValueId = new Map<string, string>()
  for (const option of options) {
    for (const value of option.values)
      optionIdByValueId.set(value.id, option.id)
  }

  const combinations = new Set<string>()
  for (const variant of input.variants) {
    const chosenOptions = variant.optionValueIds.map((valueId) => {
      const optionId = optionIdByValueId.get(valueId)
      if (!optionId) {
        throw new AppError('OPTION_VALUE_NOT_FOUND')
      }
      return optionId
    })

    if (new Set(chosenOptions).size !== options.length) {
      throw new AppError('VARIANT_INCOMPLETE')
    }

    const combination = [...variant.optionValueIds].sort().join('|')
    if (combinations.has(combination)) {
      throw new AppError('VARIANT_DUPLICATE')
    }
    combinations.add(combination)
  }

  for (const variant of input.variants) {
    if (variant.imageMediaId) await assertReadyMedia(variant.imageMediaId)
  }

  await db
    .transaction(async (tx) => {
      await tx
        .delete(productVariants)
        .where(eq(productVariants.productId, productId))

      for (const [index, variant] of input.variants.entries()) {
        const [row] = await tx
          .insert(productVariants)
          .values({
            productId,
            sku: variant.sku ?? null,
            price: variant.price ?? null,
            imageMediaId: variant.imageMediaId ?? null,
            sortOrder: index,
          })
          .returning({ id: productVariants.id })

        if (!row) throw new Error('setVariants failed: insert returned no row')

        if (variant.optionValueIds.length > 0) {
          await tx.insert(variantOptionValues).values(
            variant.optionValueIds.map((optionValueId) => ({
              variantId: row.id,
              optionValueId,
            })),
          )
        }
      }
    })
    .catch(asVariantInUse)

  return buildDetail(product)
}

export const setSpecs = async (
  productId: string,
  input: SetSpecsInput,
): Promise<ProductDetail> => {
  const product = await requireProduct(productId)

  const known = new Set((await listAttributes()).map((row) => row.id))
  for (const spec of input.specs) {
    if (!known.has(spec.attributeId)) {
      throw new AppError('ATTRIBUTE_NOT_FOUND')
    }
  }

  await db.transaction(async (tx) => {
    await tx.delete(productSpecs).where(eq(productSpecs.productId, productId))

    if (input.specs.length > 0) {
      await tx.insert(productSpecs).values(
        input.specs.map((spec) => ({
          productId,
          attributeId: spec.attributeId,
          value: spec.value,
        })),
      )
    }
  })

  return buildDetail(product)
}

export const setMedia = async (
  productId: string,
  input: SetMediaInput,
): Promise<ProductDetail> => {
  const product = await requireProduct(productId)

  for (const mediaId of input.mediaIds) await assertReadyMedia(mediaId)

  await db.transaction(async (tx) => {
    await tx.delete(productMedia).where(eq(productMedia.productId, productId))

    if (input.mediaIds.length > 0) {
      await tx.insert(productMedia).values(
        input.mediaIds.map((mediaId, index) => ({
          productId,
          mediaId,
          sortOrder: index,
        })),
      )
    }
  })

  return buildDetail(product)
}

export type VariantRef = {
  id: string
  sku: string | null
  price: number | null
  label: string | null
  product: { id: string; name: string; status: ProductStatus }
}

const variantLabels = async (
  variantIds: string[],
): Promise<Map<string, string>> => {
  const rows = await db
    .select({
      variantId: variantOptionValues.variantId,
      value: productOptionValues.value,
    })
    .from(variantOptionValues)
    .innerJoin(
      productOptionValues,
      eq(productOptionValues.id, variantOptionValues.optionValueId),
    )
    .innerJoin(
      productOptions,
      eq(productOptions.id, productOptionValues.optionId),
    )
    .where(inArray(variantOptionValues.variantId, variantIds))
    .orderBy(asc(productOptions.sortOrder))

  const labels = new Map<string, string>()
  for (const row of rows) {
    const current = labels.get(row.variantId)
    labels.set(row.variantId, current ? `${current} / ${row.value}` : row.value)
  }
  return labels
}

export const getVariantRefs = async (
  variantIds: string[],
): Promise<Map<string, VariantRef>> => {
  if (variantIds.length === 0) return new Map()

  const [rows, labels] = await Promise.all([
    db
      .select({
        id: productVariants.id,
        sku: productVariants.sku,
        price: productVariants.price,
        productId: products.id,
        productName: products.name,
        productStatus: products.status,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, variantIds)),
    variantLabels(variantIds),
  ])

  return new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        sku: row.sku,
        price: row.price,
        label: labels.get(row.id) ?? null,
        product: {
          id: row.productId,
          name: row.productName,
          status: row.productStatus,
        },
      },
    ]),
  )
}

export const getVariantRef = async (
  variantId: string,
): Promise<VariantRef | null> =>
  (await getVariantRefs([variantId])).get(variantId) ?? null

export const getForAdmin = async (id: string): Promise<ProductDetail> =>
  buildDetail(await requireProduct(id))

export const listForAdmin = async (
  query: AdminListQuery,
): Promise<ProductListItem[]> => {
  const conditions = [
    ...(query.supplierId ? [eq(products.supplierId, query.supplierId)] : []),
    ...(query.status ? [eq(products.status, query.status)] : []),
  ]

  const rows = await db
    .select()
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.createdAt))

  const [supplierById, categoryById] = await Promise.all([
    supplierRefs(false),
    getTree().then((tree) => collectCategories(tree, new Map())),
  ])

  return buildListItems(rows, supplierById, categoryById)
}

const emptyPage = (page: number): ProductPage => ({
  items: [],
  page,
  pageSize: PAGE_SIZE,
  total: 0,
})

export const listPublished = async (
  query: PublicListQuery,
): Promise<ProductPage> => {
  const page = query.page ?? 1

  const [supplierById, tree] = await Promise.all([
    supplierRefs(true),
    getTree(),
  ])
  const categoryById = collectCategories(tree, new Map())

  let supplierIds = [...supplierById.keys()]
  if (query.supplier) {
    const match = [...supplierById.values()].find(
      (supplier) => supplier.slug === query.supplier,
    )
    if (!match) return emptyPage(page)
    supplierIds = [match.id]
  }
  if (supplierIds.length === 0) return emptyPage(page)

  const conditions = [
    eq(products.status, PRODUCT_STATUSES.PUBLISHED),
    inArray(products.supplierId, supplierIds),
  ]

  if (query.category) {
    const ids = subtreeIds(tree, query.category)
    if (!ids) return emptyPage(page)
    conditions.push(inArray(products.categoryId, ids))
  }

  if (query.specs.length > 0) {
    const attributeIdBySlug = new Map(
      (await listAttributes()).map((row) => [row.slug, row.id]),
    )

    for (const filter of query.specs) {
      const attributeId = attributeIdBySlug.get(filter.slug)
      if (!attributeId) return emptyPage(page)

      conditions.push(
        exists(
          db
            .select({ matched: sql`1` })
            .from(productSpecs)
            .where(
              and(
                eq(productSpecs.productId, products.id),
                eq(productSpecs.attributeId, attributeId),
                eq(productSpecs.value, filter.value),
              ),
            ),
        ),
      )
    }
  }

  const where = and(...conditions)

  const [totals, rows] = await Promise.all([
    db.select({ value: count() }).from(products).where(where),
    db
      .select()
      .from(products)
      .where(where)
      .orderBy(desc(products.createdAt), asc(products.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ])

  return {
    items: await buildListItems(rows, supplierById, categoryById),
    page,
    pageSize: PAGE_SIZE,
    total: totals[0]?.value ?? 0,
  }
}

export const getPublished = async (
  supplierSlug: string,
  productSlug: string,
): Promise<ProductDetail | null> => {
  const supplier = await getSupplierBySlug(supplierSlug)
  if (!supplier) return null

  const [row] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.supplierId, supplier.id),
        eq(products.slug, productSlug),
        eq(products.status, PRODUCT_STATUSES.PUBLISHED),
      ),
    )
    .limit(1)

  return row ? buildDetail(row) : null
}

export type FacetValue = { value: string; count: number }

export type AttributeFacet = {
  slug: string
  name: string
  unit: string | null
  values: FacetValue[]
}

export type ProductFacets = {
  attributes: AttributeFacet[]
}

export const getFacets = async (): Promise<ProductFacets> => {
  const supplierIds = (await listVisibleSuppliers()).map((row) => row.id)
  if (supplierIds.length === 0) return { attributes: [] }

  const [rows, attributeById] = await Promise.all([
    db
      .select({
        attributeId: productSpecs.attributeId,
        value: productSpecs.value,
        count: count(),
      })
      .from(productSpecs)
      .innerJoin(products, eq(products.id, productSpecs.productId))
      .where(
        and(
          eq(products.status, PRODUCT_STATUSES.PUBLISHED),
          inArray(products.supplierId, supplierIds),
        ),
      )
      .groupBy(productSpecs.attributeId, productSpecs.value),
    listAttributes().then(
      (attributes) =>
        new Map(attributes.map((attribute) => [attribute.id, attribute])),
    ),
  ])

  const bySlug = new Map<string, AttributeFacet>()
  for (const row of rows) {
    const attribute = attributeById.get(row.attributeId)
    if (!attribute) continue
    const facet = bySlug.get(attribute.slug) ?? {
      slug: attribute.slug,
      name: attribute.name,
      unit: attribute.unit,
      values: [],
    }
    facet.values.push({ value: row.value, count: row.count })
    bySlug.set(attribute.slug, facet)
  }

  const attributes = [...bySlug.values()].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
  for (const facet of attributes) {
    facet.values.sort(
      (a, b) => b.count - a.count || a.value.localeCompare(b.value),
    )
  }

  return { attributes }
}
