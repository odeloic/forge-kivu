import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import { jsonRequest, loginAs, resetDatabase } from '../../test/helpers'
import { ROLES } from '../auth/auth.service'
import { projectItems, projects } from './projects.tables'

const OWNER = { email: 'owner@example.com', password: 'correct horse' }
const OTHER = { email: 'other@example.com', password: 'correct horse' }
const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

type ProjectResponse = Record<string, unknown> & { id: string }

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

const postProject = (cookie: string, body: unknown) =>
  app.request('/projects', jsonRequest(body, cookie))

const listProjects = (cookie?: string) => authGet('/projects', cookie)

const getProject = (id: string, cookie?: string) =>
  authGet(`/projects/${id}`, cookie)

const patchProject = (id: string, cookie: string, body: unknown) =>
  app.request(`/projects/${id}`, write('PATCH', cookie, body))

const deleteProject = (id: string, cookie: string) =>
  app.request(`/projects/${id}`, write('DELETE', cookie))

const putItem = (
  id: string,
  variantId: string,
  cookie: string,
  body: unknown,
) =>
  app.request(`/projects/${id}/items/${variantId}`, write('PUT', cookie, body))

const deleteItem = (id: string, variantId: string, cookie: string) =>
  app.request(`/projects/${id}/items/${variantId}`, write('DELETE', cookie))

const createdId = async (res: Response, what: string): Promise<string> => {
  if (res.status !== 201) {
    throw new Error(`${what} failed with status ${res.status}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

type CatalogueSeed = { productId: string; variantId: string }

const seededProduct = async (
  admin: string,
  slug: string,
  publish: boolean,
): Promise<CatalogueSeed> => {
  const supplierId = await createdId(
    await app.request(
      '/admin/suppliers',
      jsonRequest(
        { name: `Supplier ${slug}`, slug: `supplier-${slug}` },
        admin,
      ),
    ),
    'supplier create',
  )
  const categoryId = await createdId(
    await app.request(
      '/admin/categories',
      jsonRequest(
        { name: `Category ${slug}`, slug: `category-${slug}` },
        admin,
      ),
    ),
    'category create',
  )
  const productId = await createdId(
    await app.request(
      '/admin/products',
      jsonRequest(
        { supplierId, categoryId, name: `Product ${slug}`, slug },
        admin,
      ),
    ),
    'product create',
  )

  const varied = await app.request(
    `/admin/products/${productId}/variants`,
    write('PUT', admin, { variants: [{ sku: `${slug}-1`, price: 14.25 }] }),
  )
  if (varied.status !== 200) {
    throw new Error(`set variants failed with status ${varied.status}`)
  }
  const detail = (await varied.json()) as { variants: { id: string }[] }
  const variantId = detail.variants[0]?.id
  if (!variantId) throw new Error('set variants returned no variant')

  if (publish) {
    const published = await app.request(
      `/admin/products/${productId}/publish`,
      write('POST', admin),
    )
    if (published.status !== 200) {
      throw new Error(`publish failed with status ${published.status}`)
    }
  }

  return { productId, variantId }
}

const projectBody = (overrides: Record<string, unknown> = {}) => ({
  name: 'Lakeside House',
  projectType: 'residential_house',
  ...overrides,
})

const createProject = async (
  cookie: string,
  overrides: Record<string, unknown> = {},
): Promise<string> => {
  const res = await postProject(cookie, projectBody(overrides))
  if (res.status !== 201) {
    throw new Error(`project create failed with status ${res.status}`)
  }
  const json = (await res.json()) as ProjectResponse
  return json.id
}

beforeEach(async () => {
  await resetDatabase()
})

describe('create a project', () => {
  it('creates a project owned by the caller', async () => {
    const owner = await loginAs(OWNER)

    const res = await postProject(
      owner,
      projectBody({
        workType: 'new_construction',
        phase: 'foundation',
        clientName: 'Ada',
        location: 'Rubavu',
        description: 'Two-storey family house',
        startDate: '2026-09-01',
        endDate: '2027-06-30',
        budget: 25000000,
      }),
    )

    expect(res.status).toBe(201)
    const body = (await res.json()) as ProjectResponse
    expect(body).toMatchObject({
      name: 'Lakeside House',
      projectType: 'residential_house',
      workType: 'new_construction',
      phase: 'foundation',
      clientName: 'Ada',
      location: 'Rubavu',
      startDate: '2026-09-01',
      endDate: '2027-06-30',
      budget: 25000000,
    })

    const [row] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, body.id))
    expect(row).toBeDefined()
    expect(row?.ownerId).toBeTruthy()
  })

  it('rejects a missing projectType', async () => {
    const owner = await loginAs(OWNER)

    const res = await postProject(owner, { name: 'No Type' })

    expect(res.status).toBe(400)
  })

  it('rejects values outside the enums', async () => {
    const owner = await loginAs(OWNER)

    const badType = await postProject(
      owner,
      projectBody({ projectType: 'castle' }),
    )
    const badWork = await postProject(
      owner,
      projectBody({ workType: 'demolition' }),
    )
    const badPhase = await postProject(owner, projectBody({ phase: 'orbit' }))

    expect(badType.status).toBe(400)
    expect(badWork.status).toBe(400)
    expect(badPhase.status).toBe(400)
  })

  it('rejects an anonymous caller', async () => {
    const res = await app.request('/projects', jsonRequest(projectBody()))

    expect(res.status).toBe(401)
  })
})

describe('read projects', () => {
  it('returns the budget as stored with no comparison field', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner, { budget: 1500000.5 })

    const res = await getProject(id, owner)

    expect(res.status).toBe(200)
    const body = (await res.json()) as ProjectResponse
    expect(body.budget).toBe(1500000.5)
    const keys = Object.keys(body).join()
    expect(keys).not.toMatch(/comparison|remaining|over|under/i)
  })

  it('lists only the caller projects', async () => {
    const owner = await loginAs(OWNER)
    await createProject(owner)
    await createProject(owner, { name: 'Shop Fit-out' })
    const other = await loginAs(OTHER)

    const mine = await listProjects(owner)
    const theirs = await listProjects(other)

    expect(((await mine.json()) as ProjectResponse[]).length).toBe(2)
    expect((await theirs.json()) as ProjectResponse[]).toEqual([])
  })

  it('hides another user project behind a 404', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const other = await loginAs(OTHER)

    const res = await getProject(id, other)

    expect(res.status).toBe(404)
  })

  it('rejects an anonymous read with 401', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const list = await listProjects()
    const detail = await getProject(id)

    expect(list.status).toBe(401)
    expect(detail.status).toBe(401)
  })
})

describe('update a project', () => {
  it('patches fields and clears nullable ones', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner, { clientName: 'Ada' })

    const res = await patchProject(id, owner, {
      name: 'Lakeside Villa',
      phase: 'roofing',
      clientName: null,
    })

    expect(res.status).toBe(200)
    expect((await res.json()) as ProjectResponse).toMatchObject({
      name: 'Lakeside Villa',
      phase: 'roofing',
      clientName: null,
    })
  })

  it('rejects an empty name', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const res = await patchProject(id, owner, { name: '' })

    expect(res.status).toBe(400)
  })

  it('hides another user project behind a 404', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const other = await loginAs(OTHER)

    const res = await patchProject(id, other, { name: 'Hijacked' })

    expect(res.status).toBe(404)
  })
})

describe('delete a project', () => {
  it('removes the row', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const res = await deleteProject(id, owner)

    expect(res.status).toBe(204)
    const rows = await db.select().from(projects).where(eq(projects.id, id))
    expect(rows).toEqual([])
  })

  it('hides another user project behind a 404', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const other = await loginAs(OTHER)

    const res = await deleteProject(id, other)

    expect(res.status).toBe(404)
    expect(
      await db.select().from(projects).where(eq(projects.id, id)),
    ).toHaveLength(1)
  })
})

describe('manage project items', () => {
  it('upserts the same row on repeated PUT', async () => {
    const admin = await loginAs(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const first = await putItem(id, variantId, owner, { quantity: 3 })
    const second = await putItem(id, variantId, owner, { quantity: 5 })

    expect(first.status).toBe(200)
    expect((await first.json()) as ProjectResponse).toMatchObject({
      variantId,
      quantity: 3,
    })
    expect(second.status).toBe(200)

    const rows = await db
      .select()
      .from(projectItems)
      .where(eq(projectItems.projectId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.quantity).toBe(5)
  })

  it('includes item variant and product data in the project detail', async () => {
    const admin = await loginAs(ADMIN)
    const { productId, variantId } = await seededProduct(
      admin,
      'cement-tile',
      true,
    )
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 2 })

    const before = await getProject(id, owner)
    const retired = await app.request(
      `/admin/products/${productId}/unpublish`,
      write('POST', admin),
    )
    const after = await getProject(id, owner)

    expect(retired.status).toBe(200)
    expect((await before.json()) as ProjectResponse).toMatchObject({
      items: [
        {
          variantId,
          quantity: 2,
          sku: 'cement-tile-1',
          price: 14.25,
          product: {
            id: productId,
            name: 'Product cement-tile',
            status: 'published',
          },
        },
      ],
    })
    expect((await after.json()) as ProjectResponse).toMatchObject({
      items: [{ variantId, product: { status: 'not_available' } }],
    })
  })

  it('rejects a variant of a draft product', async () => {
    const admin = await loginAs(ADMIN)
    const { variantId } = await seededProduct(admin, 'draft-tile', false)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const res = await putItem(id, variantId, owner, { quantity: 1 })

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'PRODUCT_NOT_PUBLISHED' },
    })
  })

  it('returns 404 for an unknown variant', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const res = await putItem(
      id,
      '00000000-0000-4000-8000-000000000000',
      owner,
      { quantity: 1 },
    )

    expect(res.status).toBe(404)
  })

  it('rejects a quantity below 1', async () => {
    const admin = await loginAs(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const zero = await putItem(id, variantId, owner, { quantity: 0 })
    const fraction = await putItem(id, variantId, owner, { quantity: 1.5 })

    expect(zero.status).toBe(400)
    expect(fraction.status).toBe(400)
  })

  it('hides another user project behind a 404', async () => {
    const admin = await loginAs(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const other = await loginAs(OTHER)

    const res = await putItem(id, variantId, other, { quantity: 1 })

    expect(res.status).toBe(404)
  })

  it('removes an item', async () => {
    const admin = await loginAs(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 2 })

    const removed = await deleteItem(id, variantId, owner)
    const again = await deleteItem(id, variantId, owner)

    expect(removed.status).toBe(204)
    expect(again.status).toBe(404)
    expect(
      await db
        .select()
        .from(projectItems)
        .where(eq(projectItems.projectId, id)),
    ).toEqual([])
  })

  it('deletes item rows with the project', async () => {
    const admin = await loginAs(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 2 })

    const res = await deleteProject(id, owner)

    expect(res.status).toBe(204)
    expect(
      await db
        .select()
        .from(projectItems)
        .where(eq(projectItems.projectId, id)),
    ).toEqual([])
  })

  it('blocks catalogue variant deletion while an item exists', async () => {
    const admin = await loginAs(ADMIN)
    const { productId, variantId } = await seededProduct(
      admin,
      'cement-tile',
      true,
    )
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 2 })

    const replaced = await app.request(
      `/admin/products/${productId}/variants`,
      write('PUT', admin, { variants: [{ sku: 'new-1' }] }),
    )
    const removedProduct = await app.request(
      `/admin/products/${productId}`,
      write('DELETE', admin),
    )

    expect(replaced.status).toBe(409)
    expect(await replaced.json()).toMatchObject({
      error: { code: 'VARIANT_IN_USE' },
    })
    expect(removedProduct.status).toBe(409)

    await deleteItem(id, variantId, owner)
    const retried = await app.request(
      `/admin/products/${productId}`,
      write('DELETE', admin),
    )
    expect(retried.status).toBe(204)
  })
})
