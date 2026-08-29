import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
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
import { supplierGalleryItems, suppliers } from './suppliers.tables'

const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

const BASIC = { email: 'ada@example.com', password: 'correct horse' }

const UPLOADER = { email: 'uploader@example.com', password: 'correct horse' }

const createSupplier = (
  cookie: string,
  body: unknown = { name: 'Kivu Coffee', slug: 'kivu-coffee' },
) => app.request('/admin/suppliers', jsonRequest(body, cookie))

const listSuppliers = () => app.request('/suppliers')

const listAllSuppliers = (cookie?: string) =>
  app.request('/admin/suppliers', cookie ? { headers: { cookie } } : undefined)

const getSupplier = (slug: string) => app.request(`/suppliers/${slug}`)

const patchSupplier = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/suppliers/${id}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })

const deleteSupplier = (id: string, cookie: string) =>
  app.request(`/admin/suppliers/${id}`, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
  })

const getSupplierById = (id: string, cookie: string) =>
  app.request(`/admin/suppliers/${id}`, { headers: { cookie } })

const addGalleryItem = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/suppliers/${id}/gallery`, jsonRequest(body, cookie))

const patchGalleryItem = (
  id: string,
  itemId: string,
  cookie: string,
  body: unknown,
) =>
  app.request(`/admin/suppliers/${id}/gallery/${itemId}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })

const deleteGalleryItem = (id: string, itemId: string, cookie: string) =>
  app.request(`/admin/suppliers/${id}/gallery/${itemId}`, {
    method: 'DELETE',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
  })

const reorderGallery = (id: string, cookie: string, itemIds: string[]) =>
  app.request(`/admin/suppliers/${id}/gallery/order`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify({ itemIds }),
  })

type GalleryItemBody = {
  id: string
  mediaId: string
  imageUrl: string
  caption: string | null
  altText: string
  linkUrl: string | null
  displayOrder: number
}

const galleryOf = async (id: string, cookie: string) => {
  const res = await getSupplierById(id, cookie)
  const json = (await res.json()) as { gallery: GalleryItemBody[] }
  return json.gallery
}

const createdId = async (cookie: string, body?: unknown): Promise<string> => {
  const res = await createSupplier(cookie, body)
  if (res.status !== 201) {
    throw new Error(`create failed with status ${res.status}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

const show = (slug: string) =>
  db.update(suppliers).set({ visible: true }).where(eq(suppliers.slug, slug))

const createCategory = async (cookie: string): Promise<string> => {
  const res = await app.request(
    '/admin/categories',
    jsonRequest({ name: 'Tiles', slug: 'tiles' }, cookie),
  )
  const json = (await res.json()) as { id: string }
  return json.id
}

const createProduct = (
  cookie: string,
  supplierId: string,
  categoryId: string,
  slug: string,
) =>
  app.request(
    '/admin/products',
    jsonRequest({ supplierId, categoryId, name: slug, slug }, cookie),
  )

beforeAll(async () => {
  await ensurePublicBucket()
})

beforeEach(async () => {
  await resetDatabase()
})

describe('create a supplier', () => {
  it('lets an admin create a hidden supplier', async () => {
    const admin = await loginAsAdmin(ADMIN)

    const res = await createSupplier(admin, {
      name: 'Kivu Coffee',
      slug: 'kivu-coffee',
      description: 'Beans from the lake',
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      id: expect.any(String),
      name: 'Kivu Coffee',
      slug: 'kivu-coffee',
      description: 'Beans from the lake',
      logoMediaId: null,
      visible: false,
    })

    const rows = await db.select().from(suppliers)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ slug: 'kivu-coffee', visible: false })
  })

  it('rejects a slug that is already used', async () => {
    const admin = await loginAsAdmin(ADMIN)
    await createSupplier(admin)

    const res = await createSupplier(admin, {
      name: 'Another Roaster',
      slug: 'kivu-coffee',
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'SLUG_TAKEN' } })
    expect(await db.select().from(suppliers)).toHaveLength(1)
  })

  it('rejects an invalid slug', async () => {
    const admin = await loginAsAdmin(ADMIN)

    const res = await createSupplier(admin, {
      name: 'Kivu Coffee',
      slug: 'Kivu Coffee!',
    })

    expect(res.status).toBe(400)
    expect(await db.select().from(suppliers)).toHaveLength(0)
  })

  it('rejects a logo that is not ready', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const pending = await createPendingMedia(await loginAs(UPLOADER))

    const res = await createSupplier(admin, {
      name: 'Kivu Coffee',
      slug: 'kivu-coffee',
      logoMediaId: pending,
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
    expect(await db.select().from(suppliers)).toHaveLength(0)
  })

  it('rejects a workshop session and an anonymous request', async () => {
    const basic = await loginAs(BASIC)

    const workshop = await createSupplier(basic)
    const unauthenticated = await createSupplier('')

    expect(workshop.status).toBe(401)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(suppliers)).toHaveLength(0)
  })
})

describe('list suppliers as admin', () => {
  it('includes hidden suppliers', async () => {
    const admin = await loginAsAdmin(ADMIN)
    await createSupplier(admin)

    const res = await listAllSuppliers(admin)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject([
      { slug: 'kivu-coffee', visible: false },
    ])
  })

  it('counts each supplier products', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const kivu = await createdId(admin)
    const lake = await createdId(admin, {
      name: 'Lake Stone',
      slug: 'lake-stone',
    })
    const categoryId = await createCategory(admin)
    await createProduct(admin, kivu, categoryId, 'white-tile')
    await createProduct(admin, kivu, categoryId, 'grey-tile')

    const res = await listAllSuppliers(admin)

    expect(await res.json()).toMatchObject([
      { id: kivu, productCount: 2 },
      { id: lake, productCount: 0 },
    ])
  })

  it('rejects a workshop session and an anonymous request', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    await createSupplier(admin)

    const workshop = await listAllSuppliers(basic)
    const unauthenticated = await listAllSuppliers()

    expect(workshop.status).toBe(401)
    expect(unauthenticated.status).toBe(401)
  })

  it('guards every path under the admin namespace', async () => {
    const basic = await loginAs(BASIC)

    const unauthenticated = await app.request('/admin/not-a-route')
    const workshop = await app.request('/admin/not-a-route', {
      headers: { cookie: basic },
    })

    expect(unauthenticated.status).toBe(401)
    expect(workshop.status).toBe(401)
  })
})

describe('public reads', () => {
  it('lists visible suppliers only', async () => {
    const admin = await loginAsAdmin(ADMIN)
    await createSupplier(admin)
    await createSupplier(admin, { name: 'Lake Tea', slug: 'lake-tea' })
    await show('lake-tea')

    const res = await listSuppliers()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject([{ slug: 'lake-tea' }])
  })

  it('returns 404 for a hidden supplier and the row once visible', async () => {
    const admin = await loginAsAdmin(ADMIN)
    await createSupplier(admin)

    const hidden = await getSupplier('kivu-coffee')
    await show('kivu-coffee')
    const visible = await getSupplier('kivu-coffee')

    expect(hidden.status).toBe(404)
    expect(await hidden.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
    expect(visible.status).toBe(200)
    expect(await visible.json()).toMatchObject({ slug: 'kivu-coffee' })
  })

  it('returns 404 for a slug that does not exist', async () => {
    const res = await getSupplier('nobody')

    expect(res.status).toBe(404)
  })

  it('serves a logo url that loads, and null without a logo', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const mediaId = await createReadyMedia(await loginAs(UPLOADER))

    await createSupplier(admin, {
      name: 'Kivu Coffee',
      slug: 'kivu-coffee',
      logoMediaId: mediaId,
    })
    await createSupplier(admin, { name: 'Lake Tea', slug: 'lake-tea' })
    await show('kivu-coffee')
    await show('lake-tea')

    const withLogo = (await (await getSupplier('kivu-coffee')).json()) as {
      logoUrl: string | null
    }
    const withoutLogo = (await (await getSupplier('lake-tea')).json()) as {
      logoUrl: string | null
    }

    expect(withLogo.logoUrl).toContain(env.S3_BUCKET)
    expect(withoutLogo.logoUrl).toBeNull()

    const fetched = await fetch(withLogo.logoUrl as string)
    expect(fetched.status).toBe(200)
  })
})

describe('update a supplier', () => {
  it('toggles public visibility', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const shown = await patchSupplier(id, admin, { visible: true })
    const listedWhenVisible = await (await listSuppliers()).json()

    const hidden = await patchSupplier(id, admin, { visible: false })
    const listedWhenHidden = await (await listSuppliers()).json()

    expect(shown.status).toBe(200)
    expect(listedWhenVisible).toMatchObject([{ slug: 'kivu-coffee' }])
    expect(hidden.status).toBe(200)
    expect(listedWhenHidden).toEqual([])
  })

  it('edits the name, slug and description', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const res = await patchSupplier(id, admin, {
      name: 'Kivu Roasters',
      slug: 'kivu-roasters',
      description: null,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      name: 'Kivu Roasters',
      slug: 'kivu-roasters',
      description: null,
    })
  })

  it('rejects a slug that another supplier already uses', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)
    await createSupplier(admin, { name: 'Lake Tea', slug: 'lake-tea' })

    const res = await patchSupplier(id, admin, { slug: 'lake-tea' })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'SLUG_TAKEN' } })
  })

  it('rejects a logo that is not ready', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)
    const pending = await createPendingMedia(await loginAs(UPLOADER))

    const res = await patchSupplier(id, admin, { logoMediaId: pending })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
  })

  it('accepts a ready logo', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)
    const mediaId = await createReadyMedia(await loginAs(UPLOADER))

    const res = await patchSupplier(id, admin, { logoMediaId: mediaId })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      logoMediaId: mediaId,
      logoUrl: expect.stringContaining(env.S3_BUCKET),
    })
  })

  it('rejects an empty patch and an unknown supplier', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const empty = await patchSupplier(id, admin, {})
    const unknown = await patchSupplier(crypto.randomUUID(), admin, {
      visible: true,
    })

    expect(empty.status).toBe(400)
    expect(unknown.status).toBe(404)
  })

  it('rejects a workshop session and an anonymous request', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const id = await createdId(admin)

    const workshop = await patchSupplier(id, basic, { visible: true })
    const unauthenticated = await patchSupplier(id, '', { visible: true })

    expect(workshop.status).toBe(401)
    expect(unauthenticated.status).toBe(401)
    expect((await db.select().from(suppliers))[0]).toMatchObject({
      visible: false,
    })
  })
})

describe('delete a supplier', () => {
  it('removes the row', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const res = await deleteSupplier(id, admin)

    expect(res.status).toBe(204)
    expect(await db.select().from(suppliers)).toHaveLength(0)
  })

  it('returns 404 for an unknown supplier', async () => {
    const admin = await loginAsAdmin(ADMIN)

    const res = await deleteSupplier(crypto.randomUUID(), admin)

    expect(res.status).toBe(404)
  })

  it('rejects a workshop session and an anonymous request', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const basic = await loginAs(BASIC)
    const id = await createdId(admin)

    const workshop = await deleteSupplier(id, basic)
    const unauthenticated = await deleteSupplier(id, '')

    expect(workshop.status).toBe(401)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(suppliers)).toHaveLength(1)
  })
})

describe('supplier profile fields', () => {
  it('creates a supplier with every optional profile field', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs(UPLOADER)
    const featured = await createReadyMedia(uploader)

    const res = await createSupplier(admin, {
      name: 'Kivu Coffee',
      slug: 'kivu-coffee',
      email: ' hello@kivu.example ',
      phone: '+243 900 000 000',
      websiteUrl: 'https://kivu.example',
      address: '1 Lake Road, Goma',
      featuredMediaId: featured,
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      email: 'hello@kivu.example',
      phone: '+243 900 000 000',
      websiteUrl: 'https://kivu.example',
      address: '1 Lake Road, Goma',
      featuredMediaId: featured,
    })
  })

  it('defaults every optional profile field to null', async () => {
    const admin = await loginAsAdmin(ADMIN)

    const res = await createSupplier(admin)

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      email: null,
      phone: null,
      websiteUrl: null,
      address: null,
      featuredMediaId: null,
    })
  })

  it('updates and clears profile fields with null', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const updated = await patchSupplier(id, admin, {
      email: 'hello@kivu.example',
      phone: '+243 900 000 000',
      websiteUrl: 'https://kivu.example',
      address: '1 Lake Road, Goma',
    })
    const cleared = await patchSupplier(id, admin, {
      email: null,
      phone: null,
      websiteUrl: null,
      address: null,
    })

    expect(updated.status).toBe(200)
    expect(await updated.json()).toMatchObject({
      email: 'hello@kivu.example',
      phone: '+243 900 000 000',
      websiteUrl: 'https://kivu.example',
      address: '1 Lake Road, Goma',
    })
    expect(cleared.status).toBe(200)
    expect(await cleared.json()).toMatchObject({
      email: null,
      phone: null,
      websiteUrl: null,
      address: null,
    })
  })

  it('rejects a malformed email and a non-http url', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const email = await patchSupplier(id, admin, { email: 'not-an-email' })
    const url = await patchSupplier(id, admin, { websiteUrl: 'ftp://x' })
    const relative = await patchSupplier(id, admin, { websiteUrl: '/about' })

    expect(email.status).toBe(400)
    expect(url.status).toBe(400)
    expect(relative.status).toBe(400)
  })

  it('rejects an empty phone and empty gallery link url stays valid', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const res = await patchSupplier(id, admin, { phone: '   ' })

    expect(res.status).toBe(400)
  })

  it('rejects a featured image that is pending or unknown', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)
    const pending = await createPendingMedia(await loginAs(UPLOADER))

    const unknown = await patchSupplier(id, admin, {
      featuredMediaId: crypto.randomUUID(),
    })
    const notReady = await patchSupplier(id, admin, {
      featuredMediaId: pending,
    })

    expect(unknown.status).toBe(400)
    expect(await unknown.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
    expect(notReady.status).toBe(400)
  })

  it('resolves the featured image url and clears it with null', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs(UPLOADER)
    const featured = await createReadyMedia(uploader)
    const id = await createdId(admin)

    const updated = await patchSupplier(id, admin, {
      featuredMediaId: featured,
    })
    const detail = await getSupplierById(id, admin)
    const cleared = await patchSupplier(id, admin, { featuredMediaId: null })

    expect(updated.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      featuredMediaId: featured,
      featuredImageUrl: expect.stringContaining(env.S3_BUCKET),
    })
    expect(cleared.status).toBe(200)
    const afterClear = await getSupplierById(id, admin)
    expect(await afterClear.json()).toMatchObject({
      featuredMediaId: null,
      featuredImageUrl: null,
    })
  })
})

describe('supplier gallery', () => {
  const setup = async () => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs(UPLOADER)
    const id = await createdId(admin)
    return { admin, uploader, id }
  }

  it('adds an item and resolves its image url', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)

    const res = await addGalleryItem(id, admin, {
      mediaId,
      altText: 'Warehouse exterior',
      caption: 'Our Goma warehouse',
      linkUrl: 'https://kivu.example/tour',
    })

    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({
      id: expect.any(String),
      mediaId,
      imageUrl: expect.stringContaining(env.S3_BUCKET),
      caption: 'Our Goma warehouse',
      altText: 'Warehouse exterior',
      linkUrl: 'https://kivu.example/tour',
      displayOrder: 0,
    })
  })

  it('appends items in insertion order when no order is supplied', async () => {
    const { admin, uploader, id } = await setup()
    const first = await createReadyMedia(uploader)
    const second = await createReadyMedia(uploader)
    const third = await createReadyMedia(uploader)

    await addGalleryItem(id, admin, { mediaId: first, altText: 'one' })
    await addGalleryItem(id, admin, { mediaId: second, altText: 'two' })
    await addGalleryItem(id, admin, { mediaId: third, altText: 'three' })

    const gallery = await galleryOf(id, admin)

    expect(gallery.map((item) => item.mediaId)).toEqual([first, second, third])
    expect(gallery.map((item) => item.displayOrder)).toEqual([0, 1, 2])
  })

  it('honours an explicit display order and appends after the last item', async () => {
    const { admin, uploader, id } = await setup()
    const first = await createReadyMedia(uploader)
    const second = await createReadyMedia(uploader)

    await addGalleryItem(id, admin, {
      mediaId: first,
      altText: 'placed ahead',
      displayOrder: 10,
    })
    await addGalleryItem(id, admin, { mediaId: second, altText: 'appended' })

    const gallery = await galleryOf(id, admin)

    expect(gallery.map((item) => item.mediaId)).toEqual([first, second])
    expect(gallery.map((item) => item.displayOrder)).toEqual([10, 11])
  })

  it('breaks display order ties deterministically by creation order', async () => {
    const { admin, uploader, id } = await setup()
    const first = await createReadyMedia(uploader)
    const second = await createReadyMedia(uploader)

    await addGalleryItem(id, admin, {
      mediaId: first,
      altText: 'first',
      displayOrder: 3,
    })
    await addGalleryItem(id, admin, {
      mediaId: second,
      altText: 'second',
      displayOrder: 3,
    })

    const gallery = await galleryOf(id, admin)

    expect(gallery.map((item) => item.mediaId)).toEqual([first, second])
    expect(gallery.map((item) => item.displayOrder)).toEqual([3, 3])
  })

  it('rejects empty alt text, a malformed link, and media that is not ready', async () => {
    const { admin, uploader, id } = await setup()
    const ready = await createReadyMedia(uploader)
    const pending = await createPendingMedia(uploader)

    const emptyAlt = await addGalleryItem(id, admin, {
      mediaId: ready,
      altText: '   ',
    })
    const badLink = await addGalleryItem(id, admin, {
      mediaId: ready,
      altText: 'fine',
      linkUrl: 'not-a-url',
    })
    const notReady = await addGalleryItem(id, admin, {
      mediaId: pending,
      altText: 'fine',
    })
    const unknown = await addGalleryItem(id, admin, {
      mediaId: crypto.randomUUID(),
      altText: 'fine',
    })

    expect(emptyAlt.status).toBe(400)
    expect(badLink.status).toBe(400)
    expect(notReady.status).toBe(400)
    expect(await notReady.json()).toMatchObject({
      error: { code: 'MEDIA_NOT_READY' },
    })
    expect(unknown.status).toBe(400)
    expect(await db.select().from(supplierGalleryItems)).toHaveLength(0)
  })

  it('returns 404 when adding to an unknown supplier', async () => {
    const { admin, uploader } = await setup()
    const mediaId = await createReadyMedia(uploader)

    const res = await addGalleryItem(crypto.randomUUID(), admin, {
      mediaId,
      altText: 'fine',
    })

    expect(res.status).toBe(404)
  })

  it('prevents the same media twice in one gallery but allows it across suppliers', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)
    const other = await createdId(admin, {
      name: 'Lake Tea',
      slug: 'lake-tea',
    })

    await addGalleryItem(id, admin, { mediaId, altText: 'one' })

    const duplicate = await addGalleryItem(id, admin, {
      mediaId,
      altText: 'again',
    })
    const elsewhere = await addGalleryItem(other, admin, {
      mediaId,
      altText: 'shared',
    })

    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toMatchObject({
      error: { code: 'GALLERY_MEDIA_DUPLICATE' },
    })
    expect(elsewhere.status).toBe(201)
  })

  it('updates metadata and display order', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)
    const created = (await (
      await addGalleryItem(id, admin, { mediaId, altText: 'before' })
    ).json()) as GalleryItemBody

    const res = await patchGalleryItem(id, created.id, admin, {
      caption: 'New caption',
      altText: 'after',
      linkUrl: 'https://kivu.example/new',
      displayOrder: 5,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: created.id,
      caption: 'New caption',
      altText: 'after',
      linkUrl: 'https://kivu.example/new',
      displayOrder: 5,
    })

    const cleared = await patchGalleryItem(id, created.id, admin, {
      caption: null,
      linkUrl: null,
    })
    expect(await cleared.json()).toMatchObject({
      caption: null,
      linkUrl: null,
      altText: 'after',
    })
  })

  it('returns 404 when patching or deleting an item of another supplier', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)
    const created = (await (
      await addGalleryItem(id, admin, { mediaId, altText: 'mine' })
    ).json()) as GalleryItemBody
    const other = await createdId(admin, {
      name: 'Lake Tea',
      slug: 'lake-tea',
    })

    const patched = await patchGalleryItem(other, created.id, admin, {
      altText: 'stolen',
    })
    const deleted = await deleteGalleryItem(other, created.id, admin)

    expect(patched.status).toBe(404)
    expect(deleted.status).toBe(404)
    expect(await db.select().from(supplierGalleryItems)).toHaveLength(1)
  })

  it('reorders the complete gallery in one request', async () => {
    const { admin, uploader, id } = await setup()
    const ids: string[] = []
    for (const altText of ['one', 'two', 'three']) {
      const mediaId = await createReadyMedia(uploader)
      const created = (await (
        await addGalleryItem(id, admin, { mediaId, altText })
      ).json()) as GalleryItemBody
      ids.push(created.id)
    }

    const res = await reorderGallery(id, admin, [ids[2]!, ids[0]!, ids[1]!])

    expect(res.status).toBe(200)
    const gallery = (await res.json()) as GalleryItemBody[]
    expect(gallery.map((item) => item.id)).toEqual([ids[2], ids[0], ids[1]])
    expect(gallery.map((item) => item.displayOrder)).toEqual([0, 1, 2])

    const persisted = await galleryOf(id, admin)
    expect(persisted.map((item) => item.id)).toEqual([ids[2], ids[0], ids[1]])
  })

  it('rejects a reorder that does not match the current items', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)
    const created = (await (
      await addGalleryItem(id, admin, { mediaId, altText: 'one' })
    ).json()) as GalleryItemBody

    const missing = await reorderGallery(id, admin, [])
    const extra = await reorderGallery(id, admin, [
      created.id,
      crypto.randomUUID(),
    ])

    expect(missing.status).toBe(400)
    expect(extra.status).toBe(400)
    expect(await extra.json()).toMatchObject({
      error: { code: 'GALLERY_ORDER_MISMATCH' },
    })
    expect(await galleryOf(id, admin)).toHaveLength(1)
  })

  it('removes an item without deleting the underlying media', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)
    const created = (await (
      await addGalleryItem(id, admin, { mediaId, altText: 'gone' })
    ).json()) as GalleryItemBody

    const res = await deleteGalleryItem(id, created.id, admin)

    expect(res.status).toBe(204)
    expect(await db.select().from(supplierGalleryItems)).toHaveLength(0)
    expect(await db.select().from(media)).toHaveLength(1)
  })

  it('cascades gallery rows when the supplier is deleted but keeps the media', async () => {
    const { admin, uploader, id } = await setup()
    const mediaId = await createReadyMedia(uploader)
    await addGalleryItem(id, admin, { mediaId, altText: 'one' })

    const res = await deleteSupplier(id, admin)

    expect(res.status).toBe(204)
    expect(await db.select().from(supplierGalleryItems)).toHaveLength(0)
    expect(await db.select().from(media)).toHaveLength(1)
  })

  it('rejects gallery writes from a workshop session and an anonymous request', async () => {
    const { admin, uploader, id } = await setup()
    const basic = await loginAs(BASIC)
    const mediaId = await createReadyMedia(uploader)
    const created = (await (
      await addGalleryItem(id, admin, { mediaId, altText: 'one' })
    ).json()) as GalleryItemBody

    const workshopAdd = await addGalleryItem(id, basic, {
      mediaId,
      altText: 'x',
    })
    const anonymousAdd = await addGalleryItem(id, '', {
      mediaId,
      altText: 'x',
    })
    const workshopReorder = await reorderGallery(id, basic, [created.id])
    const anonymousDelete = await deleteGalleryItem(id, created.id, '')

    expect(workshopAdd.status).toBe(401)
    expect(anonymousAdd.status).toBe(401)
    expect(workshopReorder.status).toBe(401)
    expect(anonymousDelete.status).toBe(401)
    expect(await db.select().from(supplierGalleryItems)).toHaveLength(1)
  })
})

describe('supplier detail responses', () => {
  it('exposes contact details, featured image and gallery on the public detail', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs(UPLOADER)
    const featured = await createReadyMedia(uploader)
    const galleryMedia = await createReadyMedia(uploader)
    const id = await createdId(admin, {
      name: 'Kivu Coffee',
      slug: 'kivu-coffee',
      email: 'hello@kivu.example',
      phone: '+243 900 000 000',
      websiteUrl: 'https://kivu.example',
      address: '1 Lake Road, Goma',
      featuredMediaId: featured,
    })
    await addGalleryItem(id, admin, {
      mediaId: galleryMedia,
      altText: 'Warehouse exterior',
    })
    await show('kivu-coffee')

    const res = await getSupplier('kivu-coffee')

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      email: 'hello@kivu.example',
      phone: '+243 900 000 000',
      websiteUrl: 'https://kivu.example',
      address: '1 Lake Road, Goma',
      featuredMediaId: featured,
      featuredImageUrl: expect.stringContaining(env.S3_BUCKET),
      gallery: [
        {
          mediaId: galleryMedia,
          imageUrl: expect.stringContaining(env.S3_BUCKET),
          altText: 'Warehouse exterior',
          displayOrder: 0,
        },
      ],
    })
  })

  it('serves the admin detail with the gallery and 404s for unknown ids', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const id = await createdId(admin)

    const detail = await getSupplierById(id, admin)
    const unknown = await getSupplierById(crypto.randomUUID(), admin)
    const anonymous = await app.request(`/admin/suppliers/${id}`)

    expect(detail.status).toBe(200)
    expect(await detail.json()).toMatchObject({
      slug: 'kivu-coffee',
      gallery: [],
      featuredImageUrl: null,
    })
    expect(unknown.status).toBe(404)
    expect(anonymous.status).toBe(401)
  })
})
