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
import { suppliers } from './suppliers.tables'

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
