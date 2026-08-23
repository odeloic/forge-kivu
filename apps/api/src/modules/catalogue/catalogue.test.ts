import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import { env } from '../../env'
import { jsonRequest, loginAs, resetDatabase } from '../../test/helpers'
import {
  createPendingMedia,
  createReadyMedia,
  ensurePublicBucket,
} from '../../test/media'
import { ROLES } from '@forge-kivu/types'
import { media } from '../media/media.tables'
import { suppliers } from '../suppliers/suppliers.tables'
import {
  productMedia,
  productOptions,
  productOptionValues,
  products,
  productSpecs,
  productVariants,
  variantOptionValues,
} from './catalogue.tables'

const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

const BASIC = { email: 'ada@example.com', password: 'correct horse' }

type Detail = {
  id: string
  status: string
  supplier: { id: string; slug: string }
  category: { id: string; slug: string }
  options: {
    id: string
    name: string
    values: { id: string; value: string }[]
  }[]
  variants: {
    id: string
    sku: string | null
    price: number | null
    imageUrl: string | null
    optionValueIds: string[]
  }[]
  specs: {
    attributeId: string
    name: string
    unit: string | null
    value: string
  }[]
  media: { mediaId: string; url: string; sortOrder: number }[]
}

type Page = {
  items: { id: string; slug: string; priceFrom: number | null }[]
  page: number
  pageSize: number
  total: number
}

const write = (
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE',
  cookie: string,
  body?: unknown,
): RequestInit => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})

const authGet = (path: string, cookie?: string) =>
  app.request(path, cookie ? { headers: { cookie } } : undefined)

const postProduct = (cookie: string, body: unknown) =>
  app.request('/admin/products', jsonRequest(body, cookie))

const getProduct = (id: string, cookie?: string) =>
  authGet(`/admin/products/${id}`, cookie)

const listProducts = (cookie?: string, query = '') =>
  authGet(`/admin/products${query}`, cookie)

const patchProduct = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/products/${id}`, write('PATCH', cookie, body))

const deleteProduct = (id: string, cookie: string) =>
  app.request(`/admin/products/${id}`, write('DELETE', cookie))

const putOptions = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/products/${id}/options`, write('PUT', cookie, body))

const putVariants = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/products/${id}/variants`, write('PUT', cookie, body))

const putSpecs = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/products/${id}/specs`, write('PUT', cookie, body))

const putMedia = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/products/${id}/media`, write('PUT', cookie, body))

const publishProduct = (id: string, cookie: string) =>
  app.request(`/admin/products/${id}/publish`, write('POST', cookie))

const unpublishProduct = (id: string, cookie: string) =>
  app.request(`/admin/products/${id}/unpublish`, write('POST', cookie))

const browse = (query = '') => app.request(`/catalogue/products${query}`)

const view = (supplierSlug: string, productSlug: string, cookie?: string) =>
  authGet(`/catalogue/products/${supplierSlug}/${productSlug}`, cookie)

const deleteSupplier = (id: string, cookie: string) =>
  app.request(`/admin/suppliers/${id}`, write('DELETE', cookie))

const deleteAttribute = (id: string, cookie: string) =>
  app.request(`/admin/spec-attributes/${id}`, write('DELETE', cookie))

const createdId = async (res: Response, what: string): Promise<string> => {
  if (res.status !== 201) {
    throw new Error(`${what} failed with status ${res.status}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

type Seed = {
  supplierId: string
  otherSupplierId: string
  tiles: string
  floorTiles: string
  material: string
  width: string
}

const seed = async (cookie: string): Promise<Seed> => {
  const supplierId = await createdId(
    await app.request(
      '/admin/suppliers',
      jsonRequest({ name: 'Kivu Tiles', slug: 'kivu-tiles' }, cookie),
    ),
    'supplier create',
  )
  const otherSupplierId = await createdId(
    await app.request(
      '/admin/suppliers',
      jsonRequest({ name: 'Lake Stone', slug: 'lake-stone' }, cookie),
    ),
    'supplier create',
  )
  const tiles = await createdId(
    await app.request(
      '/admin/categories',
      jsonRequest({ name: 'Tiles', slug: 'tiles' }, cookie),
    ),
    'category create',
  )
  const floorTiles = await createdId(
    await app.request(
      '/admin/categories',
      jsonRequest(
        { name: 'Floor Tiles', slug: 'floor-tiles', parentId: tiles },
        cookie,
      ),
    ),
    'category create',
  )
  const material = await createdId(
    await app.request(
      '/admin/spec-attributes',
      jsonRequest({ name: 'Material', slug: 'material' }, cookie),
    ),
    'attribute create',
  )
  const width = await createdId(
    await app.request(
      '/admin/spec-attributes',
      jsonRequest({ name: 'Width', slug: 'width', unit: 'cm' }, cookie),
    ),
    'attribute create',
  )

  return { supplierId, otherSupplierId, tiles, floorTiles, material, width }
}

const showSupplier = (id: string) =>
  db.update(suppliers).set({ visible: true }).where(eq(suppliers.id, id))

const hideSupplier = (id: string) =>
  db.update(suppliers).set({ visible: false }).where(eq(suppliers.id, id))

const productBody = (data: Seed, overrides: Record<string, unknown> = {}) => ({
  supplierId: data.supplierId,
  categoryId: data.floorTiles,
  name: 'White Cement Tile',
  slug: 'white-cement',
  ...overrides,
})

const createProduct = async (
  cookie: string,
  data: Seed,
  overrides: Record<string, unknown> = {},
): Promise<string> =>
  createdId(
    await postProduct(cookie, productBody(data, overrides)),
    'product create',
  )

const detailOf = async (res: Response): Promise<Detail> =>
  (await res.json()) as Detail

beforeAll(async () => {
  await ensurePublicBucket()
})

beforeEach(async () => {
  await resetDatabase()
})

describe('create a product', () => {
  it('creates a draft with one default variant', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)

    const res = await postProduct(
      admin,
      productBody(data, { description: 'Matte finish' }),
    )

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      id: expect.any(String),
      name: 'White Cement Tile',
      slug: 'white-cement',
      description: 'Matte finish',
      status: 'draft',
      supplier: { id: data.supplierId, slug: 'kivu-tiles' },
      category: { id: data.floorTiles, slug: 'floor-tiles' },
      options: [],
      specs: [],
      media: [],
      variants: [{ price: null, sku: null, optionValueIds: [] }],
    })

    expect(await db.select().from(products)).toHaveLength(1)
    expect(await db.select().from(productVariants)).toHaveLength(1)
  })

  it('rejects an unknown supplier and an unknown category', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)

    const noSupplier = await postProduct(
      admin,
      productBody(data, { supplierId: crypto.randomUUID() }),
    )
    const noCategory = await postProduct(
      admin,
      productBody(data, { categoryId: crypto.randomUUID() }),
    )

    expect(noSupplier.status).toBe(400)
    expect(await noSupplier.json()).toMatchObject({
      error: { code: 'SUPPLIER_NOT_FOUND' },
    })
    expect(noCategory.status).toBe(400)
    expect(await noCategory.json()).toMatchObject({
      error: { code: 'CATEGORY_NOT_FOUND' },
    })
    expect(await db.select().from(products)).toHaveLength(0)
  })

  it('allows the same slug under a different supplier only', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await createProduct(admin, data)

    const otherSupplier = await postProduct(
      admin,
      productBody(data, { supplierId: data.otherSupplierId }),
    )
    const sameSupplier = await postProduct(admin, productBody(data))

    expect(otherSupplier.status).toBe(201)
    expect(sameSupplier.status).toBe(409)
    expect(await sameSupplier.json()).toMatchObject({
      error: { code: 'SLUG_TAKEN' },
    })
    expect(await db.select().from(products)).toHaveLength(2)
  })

  it('blocks deleting a supplier that still has products', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await createProduct(admin, data)

    const res = await deleteSupplier(data.supplierId, admin)

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: { code: 'SUPPLIER_IN_USE' },
    })
  })

  it('rejects a basic user and an anonymous request', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)

    const forbidden = await postProduct(basic, productBody(data))
    const unauthenticated = await postProduct('', productBody(data))

    expect(forbidden.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(products)).toHaveLength(0)
  })
})

describe('read and update a product as admin', () => {
  it('lists drafts and filters by supplier and status', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await createProduct(admin, data)
    const otherId = await createProduct(admin, data, {
      supplierId: data.otherSupplierId,
      slug: 'grey-cement',
      name: 'Grey Cement Tile',
    })
    await publishProduct(otherId, admin)

    const all = await listProducts(admin)
    const bySupplier = await listProducts(
      admin,
      `?supplierId=${data.supplierId}`,
    )
    const byStatus = await listProducts(admin, '?status=published')

    expect(all.status).toBe(200)
    expect(await all.json()).toHaveLength(2)
    expect(await bySupplier.json()).toMatchObject([{ slug: 'white-cement' }])
    expect(await byStatus.json()).toMatchObject([{ slug: 'grey-cement' }])
  })

  it('edits fields and moves the product to another category', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const res = await patchProduct(id, admin, {
      name: 'Ivory Cement Tile',
      description: null,
      categoryId: data.tiles,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      name: 'Ivory Cement Tile',
      description: null,
      category: { id: data.tiles, slug: 'tiles' },
    })
  })

  it('rejects an empty patch, an unknown product and an unknown category', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const empty = await patchProduct(id, admin, {})
    const unknownProduct = await patchProduct(crypto.randomUUID(), admin, {
      name: 'Nope',
    })
    const unknownCategory = await patchProduct(id, admin, {
      categoryId: crypto.randomUUID(),
    })

    expect(empty.status).toBe(400)
    expect(unknownProduct.status).toBe(404)
    expect(unknownCategory.status).toBe(400)
  })

  it('returns 404 for an unknown product detail', async () => {
    const admin = await loginAs(ADMIN)

    const res = await getProduct(crypto.randomUUID(), admin)

    expect(res.status).toBe(404)
  })

  it('rejects a basic user and an anonymous request', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const forbidden = await getProduct(id, basic)
    const unauthenticated = await getProduct(id)

    expect(forbidden.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
  })
})

describe('options and variants', () => {
  const colorAndSize = {
    options: [
      { name: 'Color', values: ['Red', 'Blue'] },
      { name: 'Size', values: ['60x60', '30x30'] },
    ],
  }

  const valueId = (detail: Detail, option: string, value: string): string => {
    const found = detail.options
      .find((row) => row.name === option)
      ?.values.find((row) => row.value === value)
    if (!found) throw new Error(`option value ${option}/${value} not found`)
    return found.id
  }

  const withOptions = async (
    cookie: string,
    data: Seed,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string; detail: Detail }> => {
    const id = await createProduct(cookie, data, overrides)
    const res = await putOptions(id, cookie, colorAndSize)
    if (res.status !== 200) {
      throw new Error(`set options failed with status ${res.status}`)
    }
    return { id, detail: await detailOf(res) }
  }

  it('replaces the default variant with every combination', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const { id, detail } = await withOptions(admin, data)

    const res = await putVariants(id, admin, {
      variants: [
        {
          price: 12.5,
          sku: 'RED-60',
          optionValueIds: [
            valueId(detail, 'Color', 'Red'),
            valueId(detail, 'Size', '60x60'),
          ],
        },
        {
          price: 10,
          optionValueIds: [
            valueId(detail, 'Color', 'Red'),
            valueId(detail, 'Size', '30x30'),
          ],
        },
        {
          price: 13,
          optionValueIds: [
            valueId(detail, 'Color', 'Blue'),
            valueId(detail, 'Size', '60x60'),
          ],
        },
        {
          price: 11,
          optionValueIds: [
            valueId(detail, 'Color', 'Blue'),
            valueId(detail, 'Size', '30x30'),
          ],
        },
      ],
    })

    expect(res.status).toBe(200)
    const updated = await detailOf(res)
    expect(updated.variants).toHaveLength(4)
    expect(updated.variants[0]).toMatchObject({ price: 12.5, sku: 'RED-60' })
    expect(
      updated.variants.every((row) => row.optionValueIds.length === 2),
    ).toBe(true)

    expect(await db.select().from(productVariants)).toHaveLength(4)
    expect(await db.select().from(variantOptionValues)).toHaveLength(8)
  })

  it('keeps one default variant when options are replaced', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const { detail } = await withOptions(admin, data)

    expect(detail.options).toMatchObject([
      { name: 'Color', values: [{ value: 'Red' }, { value: 'Blue' }] },
      { name: 'Size', values: [{ value: '60x60' }, { value: '30x30' }] },
    ])
    expect(detail.variants).toHaveLength(1)
    expect(detail.variants[0]?.optionValueIds).toEqual([])
    expect(await db.select().from(productOptions)).toHaveLength(2)
    expect(await db.select().from(productOptionValues)).toHaveLength(4)
  })

  it('rejects an option value that belongs to another product', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const mine = await withOptions(admin, data)
    const theirs = await withOptions(admin, data, {
      slug: 'grey-cement',
      name: 'Grey Cement Tile',
    })

    const res = await putVariants(mine.id, admin, {
      variants: [
        {
          price: 12,
          optionValueIds: [
            valueId(theirs.detail, 'Color', 'Red'),
            valueId(theirs.detail, 'Size', '60x60'),
          ],
        },
      ],
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'OPTION_VALUE_NOT_FOUND' },
    })
  })

  it('rejects two variants with the same combination and applies nothing', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const { id, detail } = await withOptions(admin, data)
    const combination = [
      valueId(detail, 'Color', 'Red'),
      valueId(detail, 'Size', '60x60'),
    ]

    const res = await putVariants(id, admin, {
      variants: [
        { price: 12, optionValueIds: combination },
        { price: 13, optionValueIds: [...combination].reverse() },
      ],
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'VARIANT_DUPLICATE' },
    })
    const rows = await db.select().from(productVariants)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ price: null })
  })

  it('rejects a variant that skips an option', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const { id, detail } = await withOptions(admin, data)

    const res = await putVariants(id, admin, {
      variants: [
        { price: 12, optionValueIds: [valueId(detail, 'Color', 'Red')] },
      ],
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'VARIANT_INCOMPLETE' },
    })
  })

  it('rejects an empty variant list', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const res = await putVariants(id, admin, { variants: [] })

    expect(res.status).toBe(400)
    expect(await db.select().from(productVariants)).toHaveLength(1)
  })

  it('prices a product that has no options through one variant', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const res = await putVariants(id, admin, {
      variants: [{ price: 9.99, sku: 'PLAIN' }],
    })

    expect(res.status).toBe(200)
    expect((await detailOf(res)).variants).toMatchObject([
      { price: 9.99, sku: 'PLAIN', optionValueIds: [] },
    ])
  })

  it('rejects a variant image that is not ready', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const pending = await createPendingMedia(admin)

    const res = await putVariants(id, admin, {
      variants: [{ price: 5, imageMediaId: pending }],
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
  })

  it('rejects a basic user on both replace routes', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const options = await putOptions(id, basic, colorAndSize)
    const variants = await putVariants(id, basic, {
      variants: [{ price: 1 }],
    })
    const unauthenticated = await putOptions(id, '', colorAndSize)

    expect(options.status).toBe(403)
    expect(variants.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(productOptions)).toHaveLength(0)
  })
})

describe('specs and media', () => {
  it('returns spec names and units on the admin detail', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const res = await putSpecs(id, admin, {
      specs: [
        { attributeId: data.material, value: 'Ceramic' },
        { attributeId: data.width, value: '60' },
      ],
    })

    expect(res.status).toBe(200)
    expect((await detailOf(res)).specs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          attributeId: data.material,
          name: 'Material',
          unit: null,
          value: 'Ceramic',
        }),
        expect.objectContaining({
          attributeId: data.width,
          name: 'Width',
          unit: 'cm',
          value: '60',
        }),
      ]),
    )
  })

  it('rejects an unknown attribute and blocks deleting one in use', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const unknown = await putSpecs(id, admin, {
      specs: [{ attributeId: crypto.randomUUID(), value: 'Ceramic' }],
    })
    await putSpecs(id, admin, {
      specs: [{ attributeId: data.material, value: 'Ceramic' }],
    })
    const inUse = await deleteAttribute(data.material, admin)

    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toMatchObject({
      error: { code: 'ATTRIBUTE_NOT_FOUND' },
    })
    expect(inUse.status).toBe(409)
    expect(await inUse.json()).toMatchObject({
      error: { code: 'ATTRIBUTE_IN_USE' },
    })
  })

  it('replaces the whole spec set', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    await putSpecs(id, admin, {
      specs: [
        { attributeId: data.material, value: 'Ceramic' },
        { attributeId: data.width, value: '60' },
      ],
    })

    const res = await putSpecs(id, admin, {
      specs: [{ attributeId: data.width, value: '30' }],
    })

    expect((await detailOf(res)).specs).toMatchObject([
      { attributeId: data.width, value: '30' },
    ])
    expect(await db.select().from(productSpecs)).toHaveLength(1)
  })

  it('attaches ready media and orders it by the submitted order', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const first = await createReadyMedia(admin)
    const second = await createReadyMedia(admin)

    const attached = await putMedia(id, admin, { mediaIds: [first, second] })
    const reordered = await putMedia(id, admin, { mediaIds: [second, first] })

    expect(attached.status).toBe(200)
    expect((await detailOf(attached)).media).toMatchObject([
      {
        mediaId: first,
        sortOrder: 0,
        url: expect.stringContaining(env.S3_BUCKET),
      },
      { mediaId: second, sortOrder: 1 },
    ])
    expect((await detailOf(reordered)).media).toMatchObject([
      { mediaId: second, sortOrder: 0 },
      { mediaId: first, sortOrder: 1 },
    ])
  })

  it('rejects media that is pending or missing and applies nothing', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const ready = await createReadyMedia(admin)
    const pending = await createPendingMedia(admin)

    const notReady = await putMedia(id, admin, { mediaIds: [ready, pending] })
    const missing = await putMedia(id, admin, {
      mediaIds: [ready, crypto.randomUUID()],
    })

    expect(notReady.status).toBe(400)
    expect(await notReady.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
    expect(missing.status).toBe(400)
    expect(await db.select().from(productMedia)).toHaveLength(0)
  })

  it('rejects a basic user on both replace routes', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const specs = await putSpecs(id, basic, { specs: [] })
    const attached = await putMedia(id, basic, { mediaIds: [] })

    expect(specs.status).toBe(403)
    expect(attached.status).toBe(403)
  })
})

describe('publish and browse publicly', () => {
  const publishedProduct = async (
    cookie: string,
    data: Seed,
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const id = await createProduct(cookie, data, overrides)
    const res = await publishProduct(id, cookie)
    if (res.status !== 200) {
      throw new Error(`publish failed with status ${res.status}`)
    }
    return id
  }

  it('hides a draft from the public list and detail', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await createProduct(admin, data)

    const list = await browse()
    const detail = await view('kivu-tiles', 'white-cement', admin)

    expect(await list.json()).toMatchObject({ items: [], total: 0 })
    expect(detail.status).toBe(404)
  })

  it('serves a published product to an anonymous caller', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    const id = await createProduct(admin, data)
    const mediaId = await createReadyMedia(admin)
    await putVariants(id, admin, { variants: [{ price: 14.25, sku: 'WC' }] })
    await putSpecs(id, admin, {
      specs: [{ attributeId: data.material, value: 'Ceramic' }],
    })
    await putMedia(id, admin, { mediaIds: [mediaId] })
    await publishProduct(id, admin)

    const list = await browse()
    const detail = await view('kivu-tiles', 'white-cement')

    expect(list.status).toBe(200)
    expect(await list.json()).toMatchObject({
      items: [
        {
          id,
          slug: 'white-cement',
          priceFrom: 14.25,
          supplier: { slug: 'kivu-tiles' },
          category: { slug: 'floor-tiles' },
          imageUrl: expect.stringContaining(env.S3_BUCKET),
        },
      ],
      page: 1,
      total: 1,
    })

    expect(detail.status).toBe(200)
    const body = await detailOf(detail)
    expect(body).toMatchObject({
      id,
      status: 'published',
      variants: [{ price: 14.25, sku: 'WC' }],
      specs: [{ name: 'Material', value: 'Ceramic' }],
      media: [{ mediaId }],
    })

    const fetched = await fetch(body.media[0]?.url as string)
    expect(fetched.status).toBe(200)
  })

  it('drops products of a hidden supplier from public responses', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await publishedProduct(admin, data)

    const visible = await browse()
    await hideSupplier(data.supplierId)
    const hidden = await browse()
    const detail = await view('kivu-tiles', 'white-cement')

    expect(await visible.json()).toMatchObject({ total: 1 })
    expect(await hidden.json()).toMatchObject({ items: [], total: 0 })
    expect(detail.status).toBe(404)
  })

  it('retires a product to not_available and brings it back', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    const id = await publishedProduct(admin, data)

    const retired = await unpublishProduct(id, admin)
    const whileRetired = await browse()
    const detail = await view('kivu-tiles', 'white-cement')
    const restored = await publishProduct(id, admin)
    const afterRestore = await browse()

    expect(retired.status).toBe(200)
    expect(await retired.json()).toMatchObject({ status: 'not_available' })
    expect(await whileRetired.json()).toMatchObject({ items: [], total: 0 })
    expect(detail.status).toBe(404)
    expect(await restored.json()).toMatchObject({ status: 'published' })
    expect(await afterRestore.json()).toMatchObject({ total: 1 })
  })

  it('never returns a retired product to draft', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await publishedProduct(admin, data)

    await unpublishProduct(id, admin)
    await publishProduct(id, admin)
    await unpublishProduct(id, admin)

    const fetched = await getProduct(id, admin)
    const drafts = await listProducts(admin, '?status=draft')
    const retired = await listProducts(admin, '?status=not_available')

    expect(await fetched.json()).toMatchObject({ status: 'not_available' })
    expect(await drafts.json()).toEqual([])
    expect(await retired.json()).toHaveLength(1)
  })

  it('filters by category including descendants, supplier and specs', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await showSupplier(data.otherSupplierId)

    const ceramic = await publishedProduct(admin, data)
    await putSpecs(ceramic, admin, {
      specs: [{ attributeId: data.material, value: 'Ceramic' }],
    })

    const stone = await publishedProduct(admin, data, {
      slug: 'grey-cement',
      name: 'Grey Cement Tile',
      categoryId: data.tiles,
    })
    await putSpecs(stone, admin, {
      specs: [{ attributeId: data.material, value: 'Stone' }],
    })

    await publishedProduct(admin, data, {
      supplierId: data.otherSupplierId,
      slug: 'lake-slab',
      name: 'Lake Slab',
    })

    const byParentCategory = (await (
      await browse('?category=tiles')
    ).json()) as Page
    const byLeafCategory = (await (
      await browse('?category=floor-tiles')
    ).json()) as Page
    const bySupplier = (await (
      await browse('?supplier=lake-stone')
    ).json()) as Page
    const bySpec = (await (
      await browse('?spec.material=Ceramic')
    ).json()) as Page
    const combined = (await (
      await browse(
        '?category=floor-tiles&supplier=kivu-tiles&spec.material=Ceramic',
      )
    ).json()) as Page
    const unknownCategory = (await (
      await browse('?category=nothing-here')
    ).json()) as Page

    expect(byParentCategory.total).toBe(3)
    expect(byLeafCategory.items.map((row) => row.slug).sort()).toEqual([
      'lake-slab',
      'white-cement',
    ])
    expect(bySupplier.items).toMatchObject([{ slug: 'lake-slab' }])
    expect(bySpec.items).toMatchObject([{ slug: 'white-cement' }])
    expect(combined.items).toMatchObject([{ slug: 'white-cement' }])
    expect(unknownCategory).toMatchObject({ items: [], total: 0 })
  })

  it('caps the page size and serves the next slice', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    for (let index = 0; index < 21; index += 1) {
      await createProduct(admin, data, {
        slug: `tile-${index}`,
        name: `Tile ${index}`,
      })
    }
    await db.update(products).set({ status: 'published' })

    const first = (await (await browse()).json()) as Page
    const second = (await (await browse('?page=2')).json()) as Page

    expect(first.items).toHaveLength(20)
    expect(first.pageSize).toBe(20)
    expect(first.total).toBe(21)
    expect(second.items).toHaveLength(1)
    expect(second.page).toBe(2)
    expect(second.total).toBe(21)
  })

  it('returns 404 for an unknown supplier or product slug', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await publishedProduct(admin, data)

    const unknownSupplier = await view('nobody', 'white-cement')
    const unknownProduct = await view('kivu-tiles', 'nothing-here')

    expect(unknownSupplier.status).toBe(404)
    expect(unknownProduct.status).toBe(404)
  })

  it('rejects a basic user on publish', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const forbidden = await publishProduct(id, basic)
    const unauthenticated = await publishProduct(id, '')

    expect(forbidden.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
  })
})

describe('product facets', () => {
  const facets = (query = '') =>
    app.request(`/catalogue/products/facets${query}`)

  const publishedWithSpecs = async (
    cookie: string,
    data: Seed,
    slug: string,
    specs: { attributeId: string; value: string }[],
    overrides: Record<string, unknown> = {},
  ): Promise<string> => {
    const id = await createProduct(cookie, data, { slug, ...overrides })
    await putSpecs(id, cookie, { specs })
    const res = await publishProduct(id, cookie)
    if (res.status !== 200) {
      throw new Error(`publish failed with status ${res.status}`)
    }
    return id
  }

  it('aggregates spec values across published products of visible suppliers', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    await publishedWithSpecs(admin, data, 'white-cement', [
      { attributeId: data.material, value: 'Wood' },
      { attributeId: data.width, value: '120' },
    ])
    await publishedWithSpecs(admin, data, 'grey-cement', [
      { attributeId: data.material, value: 'Wood' },
    ])

    const draft = await createProduct(admin, data, { slug: 'blue-cement' })
    await putSpecs(draft, admin, {
      specs: [{ attributeId: data.material, value: 'Steel' }],
    })

    await publishedWithSpecs(
      admin,
      data,
      'hidden-cement',
      [{ attributeId: data.material, value: 'Marble' }],
      { supplierId: data.otherSupplierId },
    )

    const res = await facets()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      price: null,
      suppliers: [{ slug: 'kivu-tiles', name: 'Kivu Tiles', count: 2 }],
      attributes: [
        {
          slug: 'material',
          name: 'Material',
          unit: null,
          values: [{ value: 'Wood', count: 2 }],
        },
        {
          slug: 'width',
          name: 'Width',
          unit: 'cm',
          values: [{ value: '120', count: 1 }],
        },
      ],
    })
  })

  it('lists supplier counts and price bounds over published products', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await showSupplier(data.otherSupplierId)

    const first = await publishedWithSpecs(admin, data, 'white-cement', [])
    await putVariants(first, admin, { variants: [{ price: 30 }] })
    const second = await publishedWithSpecs(admin, data, 'grey-cement', [])
    await putVariants(second, admin, { variants: [{ price: 9.5 }] })
    await publishedWithSpecs(admin, data, 'stone-slab', [], {
      supplierId: data.otherSupplierId,
    })

    const draft = await createProduct(admin, data, { slug: 'blue-cement' })
    await putVariants(draft, admin, { variants: [{ price: 999 }] })

    const res = await facets()
    const body = (await res.json()) as {
      price: { min: number; max: number } | null
      suppliers: { slug: string; name: string; count: number }[]
    }

    expect(body.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 2 },
      { slug: 'lake-stone', name: 'Lake Stone', count: 1 },
    ])
    expect(body.price).toEqual({ min: 9.5, max: 30 })
  })

  const scopedSeed = async (admin: string): Promise<Seed> => {
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await showSupplier(data.otherSupplierId)

    const wood = await publishedWithSpecs(admin, data, 'wood-tile', [
      { attributeId: data.material, value: 'Wood' },
      { attributeId: data.width, value: '120' },
    ])
    await putVariants(wood, admin, { variants: [{ price: 30 }] })

    const steel = await publishedWithSpecs(admin, data, 'steel-tile', [
      { attributeId: data.material, value: 'Steel' },
    ])
    await putVariants(steel, admin, { variants: [{ price: 10 }] })

    const stone = await publishedWithSpecs(
      admin,
      data,
      'stone-slab',
      [{ attributeId: data.material, value: 'Wood' }],
      { supplierId: data.otherSupplierId, categoryId: data.tiles },
    )
    await putVariants(stone, admin, { variants: [{ price: 50 }] })

    return data
  }

  it('keeps sibling values visible when filtering by a spec', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?spec.material=Wood')
    const body = (await res.json()) as {
      price: { min: number; max: number } | null
      suppliers: { slug: string; count: number }[]
      attributes: {
        slug: string
        values: { value: string; count: number }[]
      }[]
    }

    expect(body.attributes).toEqual([
      {
        slug: 'material',
        name: 'Material',
        unit: null,
        values: [
          { value: 'Wood', count: 2 },
          { value: 'Steel', count: 1 },
        ],
      },
      {
        slug: 'width',
        name: 'Width',
        unit: 'cm',
        values: [{ value: '120', count: 1 }],
      },
    ])
    expect(body.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 1 },
      { slug: 'lake-stone', name: 'Lake Stone', count: 1 },
    ])
    expect(body.price).toEqual({ min: 30, max: 50 })
  })

  it('combines repeated values of one attribute with OR on the list', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const both = (await (
      await browse('?spec.material=Wood&spec.material=Steel')
    ).json()) as Page
    const crossed = (await (
      await browse('?spec.material=Wood&spec.material=Steel&spec.width=120')
    ).json()) as Page

    expect(both.items.map((row) => row.slug).sort()).toEqual([
      'steel-tile',
      'stone-slab',
      'wood-tile',
    ])
    expect(crossed.items).toMatchObject([{ slug: 'wood-tile' }])
  })

  it('scopes facets to the union of repeated values of one attribute', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?spec.material=Wood&spec.material=Steel')
    const body = (await res.json()) as {
      price: { min: number; max: number } | null
      suppliers: { slug: string; name: string; count: number }[]
      attributes: {
        slug: string
        values: { value: string; count: number }[]
      }[]
    }

    expect(body.attributes).toEqual([
      {
        slug: 'material',
        name: 'Material',
        unit: null,
        values: [
          { value: 'Wood', count: 2 },
          { value: 'Steel', count: 1 },
        ],
      },
      {
        slug: 'width',
        name: 'Width',
        unit: 'cm',
        values: [{ value: '120', count: 1 }],
      },
    ])
    expect(body.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 2 },
      { slug: 'lake-stone', name: 'Lake Stone', count: 1 },
    ])
    expect(body.price).toEqual({ min: 10, max: 50 })
  })

  it('keeps all suppliers listed when filtering by supplier', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?supplier=kivu-tiles')
    const body = (await res.json()) as {
      price: { min: number; max: number } | null
      suppliers: { slug: string; count: number }[]
      attributes: {
        slug: string
        values: { value: string; count: number }[]
      }[]
    }

    expect(body.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 2 },
      { slug: 'lake-stone', name: 'Lake Stone', count: 1 },
    ])
    expect(body.attributes).toEqual([
      {
        slug: 'material',
        name: 'Material',
        unit: null,
        values: [
          { value: 'Steel', count: 1 },
          { value: 'Wood', count: 1 },
        ],
      },
      {
        slug: 'width',
        name: 'Width',
        unit: 'cm',
        values: [{ value: '120', count: 1 }],
      },
    ])
    expect(body.price).toEqual({ min: 10, max: 30 })
  })

  it('scopes facets to the category subtree', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const subtree = await facets('?category=tiles')
    const leaf = await facets('?category=floor-tiles')

    const subtreeBody = (await subtree.json()) as {
      suppliers: { slug: string; count: number }[]
    }
    const leafBody = (await leaf.json()) as {
      suppliers: { slug: string; name: string; count: number }[]
      attributes: { slug: string; values: { value: string }[] }[]
    }

    expect(subtreeBody.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 2 },
      { slug: 'lake-stone', name: 'Lake Stone', count: 1 },
    ])
    expect(leafBody.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 2 },
    ])
    expect(leafBody.attributes).toEqual([
      {
        slug: 'material',
        name: 'Material',
        unit: null,
        values: [
          { value: 'Steel', count: 1 },
          { value: 'Wood', count: 1 },
        ],
      },
      {
        slug: 'width',
        name: 'Width',
        unit: 'cm',
        values: [{ value: '120', count: 1 }],
      },
    ])
  })

  it('combines supplier and spec filters with each dimension excluding its own', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?supplier=kivu-tiles&spec.material=Wood')
    const body = (await res.json()) as {
      price: { min: number; max: number } | null
      suppliers: { slug: string; count: number }[]
      attributes: {
        slug: string
        values: { value: string; count: number }[]
      }[]
    }

    expect(body.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 1 },
      { slug: 'lake-stone', name: 'Lake Stone', count: 1 },
    ])
    expect(body.attributes).toEqual([
      {
        slug: 'material',
        name: 'Material',
        unit: null,
        values: [
          { value: 'Steel', count: 1 },
          { value: 'Wood', count: 1 },
        ],
      },
      {
        slug: 'width',
        name: 'Width',
        unit: 'cm',
        values: [{ value: '120', count: 1 }],
      },
    ])
    expect(body.price).toEqual({ min: 30, max: 30 })
  })

  it('returns empty facets for an unknown filter value', async () => {
    const admin = await loginAs(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?category=no-such-category')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      price: null,
      suppliers: [],
      attributes: [],
    })
  })

  it('orders values by count descending then alphabetically', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    const values = ['Steel', 'Steel', 'Zinc', 'Aluminium']
    for (const [index, value] of values.entries()) {
      await publishedWithSpecs(admin, data, `tile-${index}`, [
        { attributeId: data.material, value },
      ])
    }

    const res = await facets()
    const body = (await res.json()) as {
      attributes: { values: { value: string; count: number }[] }[]
    }

    expect(body.attributes[0]?.values).toEqual([
      { value: 'Steel', count: 2 },
      { value: 'Aluminium', count: 1 },
      { value: 'Zinc', count: 1 },
    ])
  })
})

describe('delete a product', () => {
  it('removes the product and everything it owns, keeping media', async () => {
    const admin = await loginAs(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const mediaId = await createReadyMedia(admin)

    const optionsRes = await putOptions(id, admin, {
      options: [{ name: 'Color', values: ['Red'] }],
    })
    const detail = await detailOf(optionsRes)
    const redId = detail.options[0]?.values[0]?.id as string
    await putVariants(id, admin, {
      variants: [{ price: 8, optionValueIds: [redId] }],
    })
    await putSpecs(id, admin, {
      specs: [{ attributeId: data.material, value: 'Ceramic' }],
    })
    await putMedia(id, admin, { mediaIds: [mediaId] })

    const mediaBefore = (await (await getProduct(id, admin)).json()) as Detail
    const res = await deleteProduct(id, admin)

    expect(res.status).toBe(204)
    expect(await db.select().from(products)).toHaveLength(0)
    expect(await db.select().from(productOptions)).toHaveLength(0)
    expect(await db.select().from(productOptionValues)).toHaveLength(0)
    expect(await db.select().from(productVariants)).toHaveLength(0)
    expect(await db.select().from(variantOptionValues)).toHaveLength(0)
    expect(await db.select().from(productSpecs)).toHaveLength(0)
    expect(await db.select().from(productMedia)).toHaveLength(0)

    expect(await db.select().from(media)).toHaveLength(1)
    const fetched = await fetch(mediaBefore.media[0]?.url as string)
    expect(fetched.status).toBe(200)
  })

  it('returns 404 for an unknown product and 403 for a basic user', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const unknown = await deleteProduct(crypto.randomUUID(), admin)
    const forbidden = await deleteProduct(id, basic)

    expect(unknown.status).toBe(404)
    expect(forbidden.status).toBe(403)
    expect(await db.select().from(products)).toHaveLength(1)
  })
})
