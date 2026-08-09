import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import { jsonRequest, loginAs, resetDatabase } from '../../test/helpers'
import { ROLES } from '../auth/auth.service'
import { categories, specAttributes } from './taxonomy.tables'

const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

const BASIC = { email: 'ada@example.com', password: 'correct horse' }

const writeRequest = (
  method: 'PATCH' | 'DELETE',
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

const postCategory = (cookie: string, body: unknown) =>
  app.request('/admin/categories', jsonRequest(body, cookie))

const patchCategory = (id: string, cookie: string, body: unknown) =>
  app.request(`/admin/categories/${id}`, writeRequest('PATCH', cookie, body))

const deleteCategory = (id: string, cookie: string) =>
  app.request(`/admin/categories/${id}`, writeRequest('DELETE', cookie))

const listCategories = () => app.request('/categories')

const postAttribute = (cookie: string, body: unknown) =>
  app.request('/admin/spec-attributes', jsonRequest(body, cookie))

const patchAttribute = (id: string, cookie: string, body: unknown) =>
  app.request(
    `/admin/spec-attributes/${id}`,
    writeRequest('PATCH', cookie, body),
  )

const deleteAttribute = (id: string, cookie: string) =>
  app.request(`/admin/spec-attributes/${id}`, writeRequest('DELETE', cookie))

const listAttributes = () => app.request('/spec-attributes')

const createdCategoryId = async (
  cookie: string,
  body: unknown,
): Promise<string> => {
  const res = await postCategory(cookie, body)
  if (res.status !== 201) {
    throw new Error(`category create failed with status ${res.status}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

const createdAttributeId = async (
  cookie: string,
  body: unknown,
): Promise<string> => {
  const res = await postAttribute(cookie, body)
  if (res.status !== 201) {
    throw new Error(`attribute create failed with status ${res.status}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

beforeEach(async () => {
  await resetDatabase()
})

describe('create a category', () => {
  it('nests a child under its parent in the public tree', async () => {
    const admin = await loginAs(ADMIN)
    const tiles = await createdCategoryId(admin, {
      name: 'Tiles',
      slug: 'tiles',
    })
    await postCategory(admin, {
      name: 'Floor Tiles',
      slug: 'floor-tiles',
      parentId: tiles,
      sortOrder: 2,
    })
    await postCategory(admin, {
      name: 'Wall Tiles',
      slug: 'wall-tiles',
      parentId: tiles,
      sortOrder: 1,
    })

    const res = await listCategories()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject([
      {
        id: tiles,
        name: 'Tiles',
        slug: 'tiles',
        parentId: null,
        sortOrder: 0,
        children: [
          { slug: 'wall-tiles', parentId: tiles, sortOrder: 1, children: [] },
          { slug: 'floor-tiles', parentId: tiles, sortOrder: 2, children: [] },
        ],
      },
    ])
  })

  it('rejects a slug that is already used', async () => {
    const admin = await loginAs(ADMIN)
    await postCategory(admin, { name: 'Tiles', slug: 'tiles' })

    const res = await postCategory(admin, { name: 'Roof Tiles', slug: 'tiles' })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'SLUG_TAKEN' } })
    expect(await db.select().from(categories)).toHaveLength(1)
  })

  it('rejects a parent that does not exist', async () => {
    const admin = await loginAs(ADMIN)

    const res = await postCategory(admin, {
      name: 'Floor Tiles',
      slug: 'floor-tiles',
      parentId: crypto.randomUUID(),
    })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'PARENT_NOT_FOUND' },
    })
    expect(await db.select().from(categories)).toHaveLength(0)
  })

  it('rejects an invalid slug', async () => {
    const admin = await loginAs(ADMIN)

    const res = await postCategory(admin, { name: 'Tiles', slug: 'Tiles!' })

    expect(res.status).toBe(400)
    expect(await db.select().from(categories)).toHaveLength(0)
  })

  it('rejects a basic user and an anonymous request', async () => {
    const basic = await loginAs(BASIC)
    const body = { name: 'Tiles', slug: 'tiles' }

    const forbidden = await postCategory(basic, body)
    const unauthenticated = await postCategory('', body)

    expect(forbidden.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(categories)).toHaveLength(0)
  })
})

describe('read the category tree', () => {
  it('serves an empty tree to an anonymous caller', async () => {
    const res = await listCategories()

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('orders top level categories by sort order', async () => {
    const admin = await loginAs(ADMIN)
    await postCategory(admin, { name: 'Paint', slug: 'paint', sortOrder: 5 })
    await postCategory(admin, { name: 'Tiles', slug: 'tiles', sortOrder: 1 })

    const res = await listCategories()

    expect(await res.json()).toMatchObject([
      { slug: 'tiles', children: [] },
      { slug: 'paint', children: [] },
    ])
  })
})

describe('update a category', () => {
  it('edits the name, slug and sort order', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })

    const res = await patchCategory(id, admin, {
      name: 'Tiling',
      slug: 'tiling',
      sortOrder: 3,
    })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      name: 'Tiling',
      slug: 'tiling',
      sortOrder: 3,
    })
  })

  it('moves a category to the top level', async () => {
    const admin = await loginAs(ADMIN)
    const tiles = await createdCategoryId(admin, {
      name: 'Tiles',
      slug: 'tiles',
    })
    const floor = await createdCategoryId(admin, {
      name: 'Floor Tiles',
      slug: 'floor-tiles',
      parentId: tiles,
    })

    const res = await patchCategory(floor, admin, { parentId: null })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ parentId: null })
    expect(await (await listCategories()).json()).toMatchObject([
      { slug: 'floor-tiles', children: [] },
      { slug: 'tiles', children: [] },
    ])
  })

  it('rejects moving a category under its own descendant', async () => {
    const admin = await loginAs(ADMIN)
    const tiles = await createdCategoryId(admin, {
      name: 'Tiles',
      slug: 'tiles',
    })
    const floor = await createdCategoryId(admin, {
      name: 'Floor Tiles',
      slug: 'floor-tiles',
      parentId: tiles,
    })

    const res = await patchCategory(tiles, admin, { parentId: floor })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'PARENT_CYCLE' } })
    const [row] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, tiles))
    expect(row).toMatchObject({ parentId: null })
  })

  it('rejects a category as its own parent', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })

    const res = await patchCategory(id, admin, { parentId: id })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: { code: 'PARENT_CYCLE' } })
  })

  it('rejects a slug another category already uses', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })
    await postCategory(admin, { name: 'Paint', slug: 'paint' })

    const res = await patchCategory(id, admin, { slug: 'paint' })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'SLUG_TAKEN' } })
  })

  it('rejects an empty patch and an unknown category', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })

    const empty = await patchCategory(id, admin, {})
    const unknown = await patchCategory(crypto.randomUUID(), admin, {
      name: 'Paint',
    })

    expect(empty.status).toBe(400)
    expect(unknown.status).toBe(404)
  })

  it('rejects a basic user and an anonymous request', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })

    const forbidden = await patchCategory(id, basic, { name: 'Paint' })
    const unauthenticated = await patchCategory(id, '', { name: 'Paint' })

    expect(forbidden.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
  })
})

describe('delete a category', () => {
  it('removes a leaf category', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })

    const res = await deleteCategory(id, admin)

    expect(res.status).toBe(204)
    expect(await db.select().from(categories)).toHaveLength(0)
  })

  it('refuses a category that still has children', async () => {
    const admin = await loginAs(ADMIN)
    const tiles = await createdCategoryId(admin, {
      name: 'Tiles',
      slug: 'tiles',
    })
    await postCategory(admin, {
      name: 'Floor Tiles',
      slug: 'floor-tiles',
      parentId: tiles,
    })

    const res = await deleteCategory(tiles, admin)

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({
      error: { code: 'CATEGORY_IN_USE' },
    })
    expect(await db.select().from(categories)).toHaveLength(2)
  })

  it('returns 404 for an unknown category', async () => {
    const admin = await loginAs(ADMIN)

    const res = await deleteCategory(crypto.randomUUID(), admin)

    expect(res.status).toBe(404)
  })

  it('rejects a basic user and an anonymous request', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const id = await createdCategoryId(admin, { name: 'Tiles', slug: 'tiles' })

    const forbidden = await deleteCategory(id, basic)
    const unauthenticated = await deleteCategory(id, '')

    expect(forbidden.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(categories)).toHaveLength(1)
  })
})

describe('spec attributes', () => {
  it('lists what an admin created to an anonymous caller', async () => {
    const admin = await loginAs(ADMIN)
    await postAttribute(admin, { name: 'Material', slug: 'material' })
    await postAttribute(admin, { name: 'Width', slug: 'width', unit: 'cm' })

    const res = await listAttributes()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject([
      { name: 'Material', slug: 'material', unit: null },
      { name: 'Width', slug: 'width', unit: 'cm' },
    ])
  })

  it('rejects a name that differs only by case', async () => {
    const admin = await loginAs(ADMIN)
    await postAttribute(admin, { name: 'Material', slug: 'material' })

    const res = await postAttribute(admin, {
      name: 'material',
      slug: 'material-two',
    })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'NAME_TAKEN' } })
    expect(await db.select().from(specAttributes)).toHaveLength(1)
  })

  it('rejects a slug that is already used', async () => {
    const admin = await loginAs(ADMIN)
    await postAttribute(admin, { name: 'Material', slug: 'material' })

    const res = await postAttribute(admin, { name: 'Finish', slug: 'material' })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'SLUG_TAKEN' } })
  })

  it('edits the name and clears the unit', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdAttributeId(admin, {
      name: 'Width',
      slug: 'width',
      unit: 'cm',
    })

    const res = await patchAttribute(id, admin, { name: 'Breadth', unit: null })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ name: 'Breadth', unit: null })
  })

  it('rejects an update to a name another attribute already uses', async () => {
    const admin = await loginAs(ADMIN)
    await postAttribute(admin, { name: 'Material', slug: 'material' })
    const id = await createdAttributeId(admin, { name: 'Width', slug: 'width' })

    const res = await patchAttribute(id, admin, { name: 'MATERIAL' })

    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: { code: 'NAME_TAKEN' } })
  })

  it('removes an attribute and 404s on an unknown one', async () => {
    const admin = await loginAs(ADMIN)
    const id = await createdAttributeId(admin, {
      name: 'Material',
      slug: 'material',
    })

    const removed = await deleteAttribute(id, admin)
    const unknown = await deleteAttribute(crypto.randomUUID(), admin)

    expect(removed.status).toBe(204)
    expect(unknown.status).toBe(404)
    expect(await db.select().from(specAttributes)).toHaveLength(0)
  })

  it('rejects a basic user and an anonymous request on writes', async () => {
    const admin = await loginAs(ADMIN)
    const basic = await loginAs(BASIC)
    const id = await createdAttributeId(admin, {
      name: 'Material',
      slug: 'material',
    })

    const created = await postAttribute(basic, { name: 'Grip', slug: 'grip' })
    const patched = await patchAttribute(id, basic, { name: 'Finish' })
    const removed = await deleteAttribute(id, basic)
    const unauthenticated = await postAttribute('', {
      name: 'Grip',
      slug: 'grip',
    })

    expect(created.status).toBe(403)
    expect(patched.status).toBe(403)
    expect(removed.status).toBe(403)
    expect(unauthenticated.status).toBe(401)
    expect(await db.select().from(specAttributes)).toHaveLength(1)
  })
})
