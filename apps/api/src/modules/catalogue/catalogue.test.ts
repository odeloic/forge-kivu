import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { client, db } from '../../db'
import { env } from '../../env'
import {
  jsonRequest,
  loginAs,
  loginAsAdmin,
  resetDatabase,
} from '../../test/helpers'
import {
  createPendingMedia,
  createReadyMedia,
  ensurePublicBucket,
} from '../../test/media'
import { ROLES } from '@forge-kivu/types'
import { media } from '../media/media.tables'
import { suppliers } from '../suppliers/suppliers.tables'
import { getVariantRef, getVariantRefs } from './catalogue.service'
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

const UPLOADER = { email: 'uploader@example.com', password: 'correct horse' }

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

const countQueries = async (run: () => Promise<unknown>): Promise<number> => {
  const spy = vi.spyOn(client, 'unsafe')
  try {
    await run()
    return spy.mock.calls.length
  } finally {
    spy.mockRestore()
  }
}

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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await createProduct(admin, data)

    const res = await deleteSupplier(data.supplierId, admin)

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: { code: 'SUPPLIER_IN_USE' },
    })
  })

  it('rejects a workshop session and an anonymous request', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)

    const workshop = await postProduct(basic, productBody(data))
    const unauthenticated = await postProduct('', productBody(data))

    expect(workshop.status).toBe(401)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(products)).toHaveLength(0)
  })
})

describe('read and update a product as admin', () => {
  it('lists drafts and filters by supplier and status', async () => {
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)

    const res = await getProduct(crypto.randomUUID(), admin)

    expect(res.status).toBe(404)
  })

  it('rejects a workshop session and an anonymous request', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const workshop = await getProduct(id, basic)
    const unauthenticated = await getProduct(id)

    expect(workshop.status).toBe(401)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const res = await putVariants(id, admin, { variants: [] })

    expect(res.status).toBe(400)
    expect(await db.select().from(productVariants)).toHaveLength(1)
  })

  it('prices a product that has no options through one variant', async () => {
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const pending = await createPendingMedia(await loginAs(UPLOADER))

    const res = await putVariants(id, admin, {
      variants: [{ price: 5, imageMediaId: pending }],
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
  })

  it('rejects a workshop session on both replace routes', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const options = await putOptions(id, basic, colorAndSize)
    const variants = await putVariants(id, basic, {
      variants: [{ price: 1 }],
    })
    const unauthenticated = await putOptions(id, '', colorAndSize)

    expect(options.status).toBe(401)
    expect(variants.status).toBe(401)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(productOptions)).toHaveLength(0)
  })
})

describe('specs and media', () => {
  it('returns spec names and units on the admin detail', async () => {
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const uploader = await loginAs(UPLOADER)
    const first = await createReadyMedia(uploader)
    const second = await createReadyMedia(uploader)

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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const uploader = await loginAs(UPLOADER)
    const ready = await createReadyMedia(uploader)
    const pending = await createPendingMedia(uploader)

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

  it('rejects a workshop session on both replace routes', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const specs = await putSpecs(id, basic, { specs: [] })
    const attached = await putMedia(id, basic, { mediaIds: [] })

    expect(specs.status).toBe(401)
    expect(attached.status).toBe(401)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await createProduct(admin, data)

    const list = await browse()
    const detail = await view('kivu-tiles', 'white-cement', admin)

    expect(await list.json()).toMatchObject({ items: [], total: 0 })
    expect(detail.status).toBe(404)
  })

  it('filters the public list by a price range across variants', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    const cheap = await createProduct(admin, data, { slug: 'cheap-tile' })
    await putVariants(cheap, admin, { variants: [{ price: 10 }] })
    await publishProduct(cheap, admin)

    const spread = await createProduct(admin, data, { slug: 'spread-tile' })
    const spreadOptions = await detailOf(
      await putOptions(spread, admin, {
        options: [{ name: 'Size', values: ['Small', 'Large'] }],
      }),
    )
    const sizeId = (value: string): string => {
      const found = spreadOptions.options[0]?.values.find(
        (row) => row.value === value,
      )
      if (!found) throw new Error(`option value ${value} not found`)
      return found.id
    }
    await putVariants(spread, admin, {
      variants: [
        { price: 5, optionValueIds: [sizeId('Small')] },
        { price: 80, optionValueIds: [sizeId('Large')] },
      ],
    })
    await publishProduct(spread, admin)

    const dear = await createProduct(admin, data, { slug: 'dear-tile' })
    await putVariants(dear, admin, { variants: [{ price: 200 }] })
    await publishProduct(dear, admin)

    const slugs = async (query: string) => {
      const body = (await (await browse(query)).json()) as {
        items: { slug: string }[]
      }
      return body.items.map((item) => item.slug).sort()
    }

    expect(await slugs('?priceMin=9&priceMax=100')).toEqual([
      'cheap-tile',
      'spread-tile',
    ])
    expect(await slugs('?priceMin=150')).toEqual(['dear-tile'])
    expect(await slugs('?priceMax=6')).toEqual(['spread-tile'])
    expect(await slugs('?priceMin=300')).toEqual([])
  })

  it('rejects a malformed price bound', async () => {
    const res = await browse('?priceMin=cheap')

    expect(res.status).toBe(400)
  })

  it('serves a published product to an anonymous caller', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    const id = await createProduct(admin, data)
    const mediaId = await createReadyMedia(await loginAs(UPLOADER))
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await publishedProduct(admin, data)

    const unknownSupplier = await view('nobody', 'white-cement')
    const unknownProduct = await view('kivu-tiles', 'nothing-here')

    expect(unknownSupplier.status).toBe(404)
    expect(unknownProduct.status).toBe(404)
  })

  it('rejects a workshop session on publish', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const workshop = await publishProduct(id, basic)
    const unauthenticated = await publishProduct(id, '')

    expect(workshop.status).toBe(401)
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
    const admin = await loginAsAdmin(ADMIN)
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
      categories: [{ slug: 'tiles', name: 'Tiles', count: 2 }],
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?category=no-such-category')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      price: null,
      categories: [],
      suppliers: [],
      attributes: [],
    })
  })

  it('rolls category counts up to the root and keeps siblings visible', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await scopedSeed(admin)
    const stone = await createdId(
      await app.request(
        '/admin/categories',
        jsonRequest({ name: 'Stone', slug: 'stone' }, admin),
      ),
      'category create',
    )
    await publishedWithSpecs(admin, data, 'granite-slab', [], {
      categoryId: stone,
    })

    const unfiltered = (await (await facets()).json()) as {
      categories: { slug: string; name: string; count: number }[]
    }

    expect(unfiltered.categories).toEqual([
      { slug: 'stone', name: 'Stone', count: 1 },
      { slug: 'tiles', name: 'Tiles', count: 3 },
    ])

    const scoped = (await (await facets('?category=stone')).json()) as {
      categories: { slug: string; count: number }[]
      suppliers: { slug: string }[]
    }

    expect(scoped.categories).toEqual([
      { slug: 'stone', name: 'Stone', count: 1 },
      { slug: 'tiles', name: 'Tiles', count: 3 },
    ])
    expect(scoped.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 1 },
    ])
  })

  it('keeps price bounds unscoped by the price filter itself', async () => {
    const admin = await loginAsAdmin(ADMIN)
    await scopedSeed(admin)

    const res = await facets('?priceMin=20&priceMax=40')
    const body = (await res.json()) as {
      price: { min: number; max: number } | null
    }

    expect(body.price).toEqual({ min: 10, max: 50 })
  })

  it('orders values by count descending then alphabetically', async () => {
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    const mediaId = await createReadyMedia(await loginAs(UPLOADER))

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

  it('returns 404 for an unknown product and 401 for a workshop session', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const data = await seed(admin)
    const id = await createProduct(admin, data)

    const unknown = await deleteProduct(crypto.randomUUID(), admin)
    const workshop = await deleteProduct(id, basic)

    expect(unknown.status).toBe(404)
    expect(workshop.status).toBe(401)
    expect(await db.select().from(products)).toHaveLength(1)
  })
})

describe('variant references', () => {
  const optionValueIdsOf = (detail: Detail): string[] =>
    detail.options[0]?.values.map((row) => row.id) ?? []

  const colouredProduct = async (
    admin: string,
    data: Seed,
    values: string[],
  ): Promise<Detail> => {
    const id = await createProduct(admin, data)
    const withOptions = await detailOf(
      await putOptions(id, admin, { options: [{ name: 'Color', values }] }),
    )
    return withOptions
  }

  it('enriches a variant with its supplier, category and image', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const uploader = await loginAs(UPLOADER)
    const cover = await createReadyMedia(uploader)
    const spare = await createReadyMedia(uploader)
    const ownImage = await createReadyMedia(uploader)

    const withOptions = await colouredProduct(admin, data, ['Charcoal', 'Sand'])
    const [charcoalValue, sandValue] = optionValueIdsOf(withOptions)
    const withVariants = await detailOf(
      await putVariants(withOptions.id, admin, {
        variants: [
          {
            sku: 'WC-CH',
            price: 12,
            imageMediaId: ownImage,
            optionValueIds: [charcoalValue],
          },
          { sku: 'WC-SA', price: 14, optionValueIds: [sandValue] },
        ],
      }),
    )
    const attached = await detailOf(
      await putMedia(withOptions.id, admin, { mediaIds: [cover, spare] }),
    )

    const [charcoal, sand] = withVariants.variants
    const refs = await getVariantRefs([
      charcoal?.id as string,
      sand?.id as string,
    ])

    expect(refs.get(charcoal?.id as string)).toMatchObject({
      id: charcoal?.id,
      sku: 'WC-CH',
      price: 12,
      label: 'Charcoal',
      product: {
        id: withOptions.id,
        name: 'White Cement Tile',
        status: 'draft',
      },
      supplier: { id: data.supplierId, name: 'Kivu Tiles', slug: 'kivu-tiles' },
      category: {
        id: data.floorTiles,
        name: 'Floor Tiles',
        slug: 'floor-tiles',
      },
      imageUrl: charcoal?.imageUrl,
    })
    expect(refs.get(sand?.id as string)?.imageUrl).toBe(attached.media[0]?.url)
  })

  it('falls back to the first product media and then to no image', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const uploader = await loginAs(UPLOADER)
    const first = await createReadyMedia(uploader)
    const second = await createReadyMedia(uploader)

    const id = await createProduct(admin, data)
    const bare = await detailOf(await getProduct(id, admin))
    const variantId = bare.variants[0]?.id as string

    const withoutMedia = await getVariantRef(variantId)
    const attached = await detailOf(
      await putMedia(id, admin, { mediaIds: [first, second] }),
    )
    const withMedia = await getVariantRef(variantId)
    const reordered = await detailOf(
      await putMedia(id, admin, { mediaIds: [second, first] }),
    )
    const afterReorder = await getVariantRef(variantId)

    expect(withoutMedia?.imageUrl).toBeNull()
    expect(withoutMedia?.label).toBeNull()
    expect(withMedia?.imageUrl).toBe(attached.media[0]?.url)
    expect(afterReorder?.imageUrl).toBe(reordered.media[0]?.url)
    expect(afterReorder?.imageUrl).not.toBe(withMedia?.imageUrl)
  })

  it('resolves a variant of a retired product with its status', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const id = await createProduct(admin, data)
    await publishProduct(id, admin)
    const retired = await detailOf(await unpublishProduct(id, admin))

    const ref = await getVariantRef(retired.variants[0]?.id as string)

    expect(ref).toMatchObject({
      product: { id, status: 'not_available' },
      supplier: { slug: 'kivu-tiles' },
      category: { slug: 'floor-tiles' },
    })
  })

  it('loads ten variants in the same number of queries as one', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    const withOptions = await colouredProduct(
      admin,
      data,
      Array.from({ length: 10 }, (_, index) => `Shade ${index}`),
    )
    const withVariants = await detailOf(
      await putVariants(withOptions.id, admin, {
        variants: optionValueIdsOf(withOptions).map((valueId, index) => ({
          sku: `WC-${index}`,
          price: index + 1,
          optionValueIds: [valueId],
        })),
      }),
    )
    const ids = withVariants.variants.map((row) => row.id)

    const one = await countQueries(() => getVariantRefs(ids.slice(0, 1)))
    const ten = await countQueries(() => getVariantRefs(ids))

    expect(ids).toHaveLength(10)
    expect(ten).toBe(one)
    expect(ten).toBeLessThan(10)
  })

  it('returns null for an unknown variant', async () => {
    expect(await getVariantRef(crypto.randomUUID())).toBeNull()
    expect(await getVariantRefs([])).toEqual(new Map())
  })
})

describe('text search on the public list', () => {
  const facets = (query = '') =>
    app.request(`/catalogue/products/facets${query}`)

  const published = async (
    admin: string,
    data: Seed,
    overrides: Record<string, unknown>,
  ): Promise<string> => {
    const id = await createProduct(admin, data, overrides)
    await publishProduct(id, admin)
    return id
  }

  const slugsFor = async (query: string): Promise<string[]> => {
    const body = (await (await browse(query)).json()) as Page
    return body.items.map((item) => item.slug).sort()
  }

  it('matches a product name in any case and narrows with the other filters', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await showSupplier(data.otherSupplierId)

    await published(admin, data, {})
    await published(admin, data, {
      slug: 'grey-cement',
      name: 'Grey CEMENT Slab',
      categoryId: data.tiles,
    })
    await published(admin, data, {
      slug: 'lake-cement',
      name: 'Lake Cement Block',
      supplierId: data.otherSupplierId,
    })
    await published(admin, data, {
      slug: 'sandstone',
      name: 'Sandstone Panel',
    })

    expect(await slugsFor('?q=cement')).toEqual([
      'grey-cement',
      'lake-cement',
      'white-cement',
    ])
    expect(await slugsFor('?q=CEMENT')).toEqual([
      'grey-cement',
      'lake-cement',
      'white-cement',
    ])
    expect(
      await slugsFor('?q=cement&supplier=kivu-tiles&category=floor-tiles'),
    ).toEqual(['white-cement'])
    expect(await slugsFor('?q=nothing-like-this')).toEqual([])
  })

  it('matches a variant sku', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    const id = await createProduct(admin, data, {
      slug: 'sandstone',
      name: 'Sandstone Panel',
    })
    await putVariants(id, admin, { variants: [{ sku: 'CEM-42', price: 3 }] })
    await publishProduct(id, admin)
    await published(admin, data, {})

    expect(await slugsFor('?q=cem-4')).toEqual(['sandstone'])
  })

  it('rejects an empty and an over-long search', async () => {
    const empty = await browse('?q=')
    const tooLong = await browse(`?q=${'a'.repeat(101)}`)
    const longest = await browse(`?q=${'a'.repeat(100)}`)

    expect(empty.status).toBe(400)
    expect(tooLong.status).toBe(400)
    expect(longest.status).toBe(200)
  })

  it('matches % and _ literally instead of as wildcards', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    await published(admin, data, {
      slug: 'percent-tile',
      name: 'Cement 50% Grey',
    })
    await published(admin, data, {
      slug: 'plain-tile',
      name: 'Cement 5012 Grey',
    })
    await published(admin, data, { slug: 'under-tile', name: 'Tile_A' })
    await published(admin, data, { slug: 'other-tile', name: 'TileXA' })

    expect(await slugsFor(`?q=${encodeURIComponent('50%')}`)).toEqual([
      'percent-tile',
    ])
    expect(await slugsFor(`?q=${encodeURIComponent('Tile_')}`)).toEqual([
      'under-tile',
    ])
    expect(await slugsFor(`?q=${encodeURIComponent('Tile')}`)).toEqual([
      'other-tile',
      'under-tile',
    ])
  })

  it('computes the facets over the searched set', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await showSupplier(data.otherSupplierId)

    const cement = await published(admin, data, {})
    await putSpecs(cement, admin, {
      specs: [{ attributeId: data.material, value: 'Ceramic' }],
    })
    const sandstone = await published(admin, data, {
      slug: 'sandstone',
      name: 'Sandstone Panel',
      supplierId: data.otherSupplierId,
    })
    await putSpecs(sandstone, admin, {
      specs: [{ attributeId: data.material, value: 'Stone' }],
    })

    const body = (await (await facets('?q=cement')).json()) as {
      suppliers: { slug: string; count: number }[]
      attributes: { slug: string; values: { value: string }[] }[]
    }

    expect(body.suppliers).toEqual([
      { slug: 'kivu-tiles', name: 'Kivu Tiles', count: 1 },
    ])
    expect(body.attributes).toMatchObject([
      { slug: 'material', values: [{ value: 'Ceramic', count: 1 }] },
    ])
  })
})

describe('the public variant list', () => {
  type VariantRow = {
    variantId: string
    sku: string | null
    price: number | null
    label: string | null
    product: { id: string; name: string; slug: string; status: string }
    supplier: { id: string; name: string; slug: string }
    category: { id: string; name: string; slug: string }
    imageUrl: string | null
  }

  type VariantPage = {
    items: VariantRow[]
    page: number
    pageSize: number
    total: number
  }

  const browseVariants = (query = '') =>
    app.request(`/catalogue/variants${query}`)

  const pageOf = async (query = ''): Promise<VariantPage> =>
    (await (await browseVariants(query)).json()) as VariantPage

  const withOptionValues = async (
    admin: string,
    data: Seed,
    values: string[],
    overrides: Record<string, unknown> = {},
  ): Promise<Detail> => {
    const id = await createProduct(admin, data, overrides)
    return detailOf(
      await putOptions(id, admin, { options: [{ name: 'Color', values }] }),
    )
  }

  it('serves one anonymous row per variant with its supplier, category and image', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    const cover = await createReadyMedia(await loginAs(UPLOADER))

    const withOptions = await withOptionValues(admin, data, [
      'Charcoal',
      'Sand',
      'Clay',
    ])
    const valueIds = withOptions.options[0]?.values.map((row) => row.id) ?? []
    await putVariants(withOptions.id, admin, {
      variants: valueIds.map((valueId, index) => ({
        sku: `WC-${index}`,
        price: index + 10,
        optionValueIds: [valueId],
      })),
    })
    const attached = await detailOf(
      await putMedia(withOptions.id, admin, { mediaIds: [cover] }),
    )
    await publishProduct(withOptions.id, admin)

    const slab = await createProduct(admin, data, {
      slug: 'cement-slab',
      name: 'Cement Slab',
      categoryId: data.tiles,
    })
    await putVariants(slab, admin, { variants: [{ sku: 'CS-1', price: 5 }] })
    await publishProduct(slab, admin)

    const res = await browseVariants('?q=cement')
    const body = (await res.json()) as VariantPage

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ page: 1, pageSize: 40, total: 4 })
    expect(
      body.items.filter((row) => row.product.id === withOptions.id),
    ).toHaveLength(3)
    expect(body.items.find((row) => row.sku === 'WC-0')).toEqual({
      variantId: attached.variants[0]?.id,
      sku: 'WC-0',
      price: 10,
      label: 'Charcoal',
      product: {
        id: withOptions.id,
        name: 'White Cement Tile',
        slug: 'white-cement',
        status: 'published',
      },
      supplier: { id: data.supplierId, name: 'Kivu Tiles', slug: 'kivu-tiles' },
      category: {
        id: data.floorTiles,
        name: 'Floor Tiles',
        slug: 'floor-tiles',
      },
      imageUrl: attached.media[0]?.url,
    })
    expect(body.items.find((row) => row.sku === 'CS-1')).toMatchObject({
      label: null,
      imageUrl: null,
      product: { slug: 'cement-slab' },
      category: { slug: 'tiles' },
    })
  })

  it('leaves out variants of draft, retired and hidden-supplier products', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    const live = await createProduct(admin, data)
    await putVariants(live, admin, { variants: [{ sku: 'LIVE-1' }] })
    await publishProduct(live, admin)

    const draft = await createProduct(admin, data, { slug: 'draft-tile' })
    await putVariants(draft, admin, { variants: [{ sku: 'DRAFT-1' }] })

    const retired = await createProduct(admin, data, { slug: 'retired-tile' })
    await putVariants(retired, admin, { variants: [{ sku: 'RETIRED-1' }] })
    await publishProduct(retired, admin)
    await unpublishProduct(retired, admin)

    const hidden = await createProduct(admin, data, {
      slug: 'hidden-tile',
      supplierId: data.otherSupplierId,
    })
    await putVariants(hidden, admin, { variants: [{ sku: 'HIDDEN-1' }] })
    await publishProduct(hidden, admin)

    const body = await pageOf()

    expect(body.items.map((row) => row.sku)).toEqual(['LIVE-1'])
    expect(body.total).toBe(1)
  })

  it('keeps a variant that has no price', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    const withOptions = await withOptionValues(admin, data, [
      'Charcoal',
      'Sand',
    ])
    const valueIds = withOptions.options[0]?.values.map((row) => row.id) ?? []
    await putVariants(withOptions.id, admin, {
      variants: [
        { sku: 'NO-PRICE', optionValueIds: [valueIds[0] as string] },
        { sku: 'PRICED', price: 9, optionValueIds: [valueIds[1] as string] },
      ],
    })
    await publishProduct(withOptions.id, admin)

    const body = await pageOf()

    expect(body.items).toMatchObject([
      { sku: 'NO-PRICE', price: null, label: 'Charcoal' },
      { sku: 'PRICED', price: 9, label: 'Sand' },
    ])
  })

  it('caps the page size, serves the next slice and rejects page zero', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)

    const values = Array.from({ length: 41 }, (_, index) => `Shade ${index}`)
    const withOptions = await withOptionValues(admin, data, values)
    const valueIds = withOptions.options[0]?.values.map((row) => row.id) ?? []
    await putVariants(withOptions.id, admin, {
      variants: valueIds.map((valueId, index) => ({
        sku: `WC-${index}`,
        optionValueIds: [valueId],
      })),
    })
    await publishProduct(withOptions.id, admin)

    const first = await pageOf()
    const second = await pageOf('?page=2')
    const zero = await browseVariants('?page=0')

    expect(first.items).toHaveLength(40)
    expect(first.pageSize).toBe(40)
    expect(first.total).toBe(41)
    expect(second.items).toHaveLength(1)
    expect(second.page).toBe(2)
    expect(second.total).toBe(41)
    expect(
      first.items
        .map((row) => row.variantId)
        .includes(second.items[0]?.variantId as string),
    ).toBe(false)
    expect(zero.status).toBe(400)
  })

  it('filters by category, supplier and a variant sku', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const data = await seed(admin)
    await showSupplier(data.supplierId)
    await showSupplier(data.otherSupplierId)

    const floor = await createProduct(admin, data)
    await putVariants(floor, admin, { variants: [{ sku: 'FLOOR-1' }] })
    await publishProduct(floor, admin)

    const wall = await createProduct(admin, data, {
      slug: 'wall-tile',
      name: 'Wall Tile',
      categoryId: data.tiles,
    })
    await putVariants(wall, admin, { variants: [{ sku: 'WALL-1' }] })
    await publishProduct(wall, admin)

    const lake = await createProduct(admin, data, {
      slug: 'lake-slab',
      name: 'Lake Slab',
      supplierId: data.otherSupplierId,
    })
    await putVariants(lake, admin, { variants: [{ sku: 'LAKE-1' }] })
    await publishProduct(lake, admin)

    const skusFor = async (query: string): Promise<string[]> =>
      (await pageOf(query)).items.map((row) => row.sku as string).sort()

    expect(await skusFor('?category=tiles')).toEqual([
      'FLOOR-1',
      'LAKE-1',
      'WALL-1',
    ])
    expect(await skusFor('?category=floor-tiles')).toEqual([
      'FLOOR-1',
      'LAKE-1',
    ])
    expect(await skusFor('?supplier=lake-stone')).toEqual(['LAKE-1'])
    expect(await skusFor('?q=wall-1')).toEqual(['WALL-1'])
    expect(await skusFor('?q=lake&supplier=lake-stone')).toEqual(['LAKE-1'])
    expect(await skusFor('?category=nothing-here')).toEqual([])
  })
})
