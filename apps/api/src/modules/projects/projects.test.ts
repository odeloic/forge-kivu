import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { client, db } from '../../db'
import {
  jsonRequest,
  loginAs,
  loginAsAdmin,
  resetDatabase,
} from '../../test/helpers'
import { createReadyMedia, ensurePublicBucket } from '../../test/media'
import { ROLES } from '@forge-kivu/types'
import { listItemsForProjects } from './projects.service'
import { projectItems, projectPhases, projects } from './projects.tables'

const OWNER = { email: 'owner@example.com', password: 'correct horse' }
const OTHER = { email: 'other@example.com', password: 'correct horse' }
const UPLOADER = { email: 'uploader@example.com', password: 'correct horse' }
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

const listProjects = (cookie?: string, query = '') =>
  authGet(`/projects${query}`, cookie)

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

const putPhase = (id: string, phase: string, cookie: string, body: unknown) =>
  app.request(`/projects/${id}/phases/${phase}`, write('PUT', cookie, body))

const deletePhase = (id: string, phase: string, cookie: string) =>
  app.request(`/projects/${id}/phases/${phase}`, write('DELETE', cookie))

const jsonOf = async <T>(res: Response): Promise<T> => (await res.json()) as T

const storedProject = async (id: string) => {
  const [row] = await db.select().from(projects).where(eq(projects.id, id))
  if (!row) throw new Error(`project ${id} is not stored`)
  return row
}

const afterHostClockPasses = async (at: Date): Promise<void> => {
  const wait = at.getTime() + 1 - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

const countingQueries = async <T>(
  run: () => T | Promise<T>,
): Promise<{ result: Awaited<T>; queries: number }> => {
  const spy = vi.spyOn(client, 'unsafe')
  try {
    const result = await run()
    return { result, queries: spy.mock.calls.length }
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

type CatalogueSeed = {
  productId: string
  variantId: string
  supplierId: string
  categoryId: string
}

const seededProduct = async (
  admin: string,
  slug: string,
  publish: boolean,
  uploader?: string,
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

  if (uploader) {
    const mediaId = await createReadyMedia(uploader)
    const attached = await app.request(
      `/admin/products/${productId}/media`,
      write('PUT', admin, { mediaIds: [mediaId] }),
    )
    if (attached.status !== 200) {
      throw new Error(`set media failed with status ${attached.status}`)
    }
  }

  if (publish) {
    const published = await app.request(
      `/admin/products/${productId}/publish`,
      write('POST', admin),
    )
    if (published.status !== 200) {
      throw new Error(`publish failed with status ${published.status}`)
    }
  }

  return { productId, variantId, supplierId, categoryId }
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

beforeAll(async () => {
  await ensurePublicBucket()
})

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
    const admin = await loginAsAdmin(ADMIN)
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

  it('accepts a fractional quantity and rejects zero and sub-cent values', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const fractional = await putItem(id, variantId, owner, { quantity: 12.5 })
    const tooSmall = await putItem(id, variantId, owner, { quantity: 0.001 })
    const zero = await putItem(id, variantId, owner, { quantity: 0 })

    expect(fractional.status).toBe(200)
    expect((await fractional.json()) as ProjectResponse).toMatchObject({
      quantity: 12.5,
      unit: { name: 'Piece', symbol: 'pc' },
    })
    expect(tooSmall.status).toBe(400)
    expect(zero.status).toBe(400)

    const rows = await db
      .select()
      .from(projectItems)
      .where(eq(projectItems.projectId, id))
    expect(rows[0]?.quantity).toBe(12.5)
  })

  it('includes item variant and product data in the project detail', async () => {
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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

  it('hides another user project behind a 404', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const other = await loginAs(OTHER)

    const res = await putItem(id, variantId, other, { quantity: 1 })

    expect(res.status).toBe(404)
  })

  it('removes an item', async () => {
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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
    const admin = await loginAsAdmin(ADMIN)
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

describe('list projects with counts, filters and sorting', () => {
  it('returns an itemCount on every row, zero when there are no items', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const first = await seededProduct(admin, 'cement-tile', true)
    const second = await seededProduct(admin, 'steel-bar', true)
    const owner = await loginAs(OWNER)
    const stocked = await createProject(owner, { name: 'Stocked' })
    const empty = await createProject(owner, { name: 'Empty' })
    await putItem(stocked, first.variantId, owner, { quantity: 2 })
    await putItem(stocked, second.variantId, owner, { quantity: 4 })

    const res = await listProjects(owner)

    expect(res.status).toBe(200)
    const rows = await jsonOf<{ id: string; itemCount: number }[]>(res)
    const counts = new Map(rows.map((row) => [row.id, row.itemCount]))
    expect(counts.get(stocked)).toBe(2)
    expect(counts.get(empty)).toBe(0)
    expect(rows.every((row) => 'itemCount' in row)).toBe(true)
  })

  it('counts only the caller own items', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const mine = await createProject(owner)
    await putItem(mine, variantId, owner, { quantity: 3 })
    const other = await loginAs(OTHER)
    const theirs = await createProject(other, { name: 'Theirs' })
    await putItem(theirs, variantId, other, { quantity: 7 })

    const rows = await jsonOf<{ id: string; itemCount: number }[]>(
      await listProjects(owner),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: mine, itemCount: 1 })
  })

  it('filters by projectType and rejects an unknown value', async () => {
    const owner = await loginAs(OWNER)
    const shop = await createProject(owner, {
      name: 'Shop',
      projectType: 'commercial',
    })
    await createProject(owner, { name: 'House' })

    const filtered = await listProjects(owner, '?projectType=commercial')
    const bad = await listProjects(owner, '?projectType=castle')

    const rows = await jsonOf<{ id: string }[]>(filtered)
    expect(rows.map((row) => row.id)).toEqual([shop])
    expect(bad.status).toBe(400)
  })

  it('filters by phase and excludes projects with no phase', async () => {
    const owner = await loginAs(OWNER)
    const roofing = await createProject(owner, {
      name: 'Roofing',
      phase: 'roofing',
    })
    await createProject(owner, { name: 'Foundation', phase: 'foundation' })
    await createProject(owner, { name: 'Unphased' })

    const rows = await jsonOf<{ id: string }[]>(
      await listProjects(owner, '?phase=roofing'),
    )

    expect(rows.map((row) => row.id)).toEqual([roofing])
  })

  it('sorts by updatedAt by default and by createdAt on request', async () => {
    const owner = await loginAs(OWNER)
    const older = await createProject(owner, { name: 'Older' })
    const newer = await createProject(owner, { name: 'Newer' })
    await afterHostClockPasses((await storedProject(newer)).updatedAt)
    await patchProject(older, owner, { name: 'Older, touched' })

    const byUpdated = await jsonOf<{ id: string }[]>(await listProjects(owner))
    const byCreated = await jsonOf<{ id: string }[]>(
      await listProjects(owner, '?sort=createdAt'),
    )
    const bad = await listProjects(owner, '?sort=name')

    expect(byUpdated.map((row) => row.id)).toEqual([older, newer])
    expect(byCreated.map((row) => row.id)).toEqual([newer, older])
    expect(bad.status).toBe(400)
  })

  it('counts items in one query however many projects there are', async () => {
    const owner = await loginAs(OWNER)
    await createProject(owner, { name: 'One' })
    await createProject(owner, { name: 'Two' })

    const small = await countingQueries(() => listProjects(owner))

    for (let index = 0; index < 8; index += 1) {
      await createProject(owner, { name: `Extra ${index}` })
    }

    const large = await countingQueries(() => listProjects(owner))

    expect((await jsonOf<{ id: string }[]>(small.result)).length).toBe(2)
    expect((await jsonOf<{ id: string }[]>(large.result)).length).toBe(10)
    expect(large.queries).toBe(small.queries)
  })
})

describe('phase completion', () => {
  it('records a completion and updates the same row on repeat', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const first = await putPhase(id, 'foundation', owner, {
      completedOn: '2026-04-18',
    })
    const second = await putPhase(id, 'foundation', owner, {
      completedOn: '2026-05-02',
    })

    expect(first.status).toBe(200)
    expect(await jsonOf(first)).toEqual({
      phase: 'foundation',
      completedOn: '2026-04-18',
    })
    expect(second.status).toBe(200)

    const rows = await db
      .select()
      .from(projectPhases)
      .where(eq(projectPhases.projectId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.completedOn).toBe('2026-05-02')
  })

  it('rejects a phase outside the enum and a malformed date', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const badPhase = await putPhase(id, 'orbit', owner, {
      completedOn: '2026-04-18',
    })
    const badDate = await putPhase(id, 'foundation', owner, {
      completedOn: 'yesterday',
    })
    const missingDate = await putPhase(id, 'foundation', owner, {})

    expect(badPhase.status).toBe(400)
    expect(badDate.status).toBe(400)
    expect(missingDate.status).toBe(400)
  })

  it('hides another user project behind a 404', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putPhase(id, 'foundation', owner, { completedOn: '2026-04-18' })
    const other = await loginAs(OTHER)

    const written = await putPhase(id, 'structure', other, {
      completedOn: '2026-04-18',
    })
    const cleared = await deletePhase(id, 'foundation', other)

    expect(written.status).toBe(404)
    expect(cleared.status).toBe(404)
    expect(
      await db
        .select()
        .from(projectPhases)
        .where(eq(projectPhases.projectId, id)),
    ).toHaveLength(1)
  })

  it('rejects an anonymous caller', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const written = await app.request(
      `/projects/${id}/phases/foundation`,
      write('PUT', '', { completedOn: '2026-04-18' }),
    )
    const cleared = await app.request(
      `/projects/${id}/phases/foundation`,
      write('DELETE', ''),
    )

    expect(written.status).toBe(401)
    expect(cleared.status).toBe(401)
  })

  it('returns phases in the enum declared order, not by completedOn', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putPhase(id, 'roofing', owner, { completedOn: '2026-01-05' })
    await putPhase(id, 'foundation', owner, { completedOn: '2026-09-30' })
    await putPhase(id, 'structure', owner, { completedOn: '2026-03-11' })

    const body = await jsonOf<{
      phases: { phase: string; completedOn: string }[]
    }>(await getProject(id, owner))

    expect(body.phases).toEqual([
      { phase: 'foundation', completedOn: '2026-09-30' },
      { phase: 'structure', completedOn: '2026-03-11' },
      { phase: 'roofing', completedOn: '2026-01-05' },
    ])
  })

  it('returns an empty phases list on an untouched project', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const body = await jsonOf<{ phases: unknown[] }>(
      await getProject(id, owner),
    )

    expect(body.phases).toEqual([])
  })

  it('clears a phase and returns 404 on a second delete', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putPhase(id, 'foundation', owner, { completedOn: '2026-04-18' })

    const cleared = await deletePhase(id, 'foundation', owner)
    const again = await deletePhase(id, 'foundation', owner)

    expect(cleared.status).toBe(204)
    expect(again.status).toBe(404)
    expect(
      await db
        .select()
        .from(projectPhases)
        .where(eq(projectPhases.projectId, id)),
    ).toEqual([])
  })

  it('deletes phase rows with the project', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putPhase(id, 'foundation', owner, { completedOn: '2026-04-18' })

    const res = await deleteProject(id, owner)

    expect(res.status).toBe(204)
    expect(
      await db
        .select()
        .from(projectPhases)
        .where(eq(projectPhases.projectId, id)),
    ).toEqual([])
  })

  it('keeps phase completion separate from the current phase column', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner, { phase: 'structure' })

    await putPhase(id, 'foundation', owner, { completedOn: '2026-04-18' })
    const body = await jsonOf<{ phase: string; phases: unknown[] }>(
      await getProject(id, owner),
    )

    expect(body.phase).toBe('structure')
    expect(body.phases).toHaveLength(1)
  })
})

describe('enriched project items', () => {
  it('carries category, supplier and imageUrl on every item', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs(UPLOADER)
    const seed = await seededProduct(admin, 'cement-tile', true, uploader)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, seed.variantId, owner, { quantity: 2 })

    const body = await jsonOf<{
      items: {
        category: { id: string; name: string; slug: string }
        supplier: { id: string; name: string; slug: string }
        imageUrl: string | null
      }[]
    }>(await getProject(id, owner))

    expect(body.items[0]).toMatchObject({
      category: {
        id: seed.categoryId,
        name: 'Category cement-tile',
        slug: 'category-cement-tile',
      },
      supplier: {
        id: seed.supplierId,
        name: 'Supplier cement-tile',
        slug: 'supplier-cement-tile',
      },
    })
    expect(body.items[0]?.imageUrl).toMatch(/^https?:\/\//)
  })

  it('returns a null imageUrl for a product with no media', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 1 })

    const body = await jsonOf<{ items: Record<string, unknown>[] }>(
      await getProject(id, owner),
    )

    expect(body.items[0]).toHaveProperty('imageUrl')
    expect(body.items[0]?.imageUrl).toBeNull()
  })

  it('keeps category and supplier on an item retired after it was added', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs(UPLOADER)
    const seed = await seededProduct(admin, 'cement-tile', true, uploader)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, seed.variantId, owner, { quantity: 2 })

    const retired = await app.request(
      `/admin/products/${seed.productId}/unpublish`,
      write('POST', admin),
    )
    const body = await jsonOf<{
      items: {
        product: { status: string }
        category: { name: string }
        supplier: { name: string }
        imageUrl: string | null
      }[]
    }>(await getProject(id, owner))

    expect(retired.status).toBe(200)
    expect(body.items).toHaveLength(1)
    expect(body.items[0]).toMatchObject({
      product: { status: 'not_available' },
      category: { name: 'Category cement-tile' },
      supplier: { name: 'Supplier cement-tile' },
    })
    expect(body.items[0]?.imageUrl).toMatch(/^https?:\/\//)
  })

  it('resolves items in one round trip however many there are', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const first = await seededProduct(admin, 'cement-tile', true)
    const second = await seededProduct(admin, 'steel-bar', true)
    const third = await seededProduct(admin, 'roof-sheet', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, first.variantId, owner, { quantity: 1 })

    const one = await countingQueries(() => getProject(id, owner))

    await putItem(id, second.variantId, owner, { quantity: 1 })
    await putItem(id, third.variantId, owner, { quantity: 1 })

    const three = await countingQueries(() => getProject(id, owner))

    expect((await jsonOf<{ items: unknown[] }>(one.result)).items).toHaveLength(
      1,
    )
    expect(
      (await jsonOf<{ items: unknown[] }>(three.result)).items,
    ).toHaveLength(3)
    expect(three.queries).toBe(one.queries)
  })
})

describe('latest BOQ on the project list', () => {
  const generateBoq = (projectId: string, cookie: string) =>
    app.request(`/projects/${projectId}/boqs`, write('POST', cookie))

  it('returns the latest revision per project and null without one', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const withBoq = await createProject(owner, { name: 'With BOQ' })
    const withoutBoq = await createProject(owner, { name: 'Without BOQ' })
    await putItem(withBoq, variantId, owner, { quantity: 2 })
    const generated = await generateBoq(withBoq, owner)

    const rows = await jsonOf<
      {
        id: string
        latestBoq: {
          revision: number
          createdAt: string
          lineCount: number
          total: number
          stale: boolean
        } | null
      }[]
    >(await listProjects(owner))
    const byId = new Map(rows.map((row) => [row.id, row.latestBoq]))

    expect(generated.status).toBe(201)
    expect(byId.get(withBoq)).toMatchObject({
      revision: 1,
      lineCount: 1,
      total: 28.5,
      stale: false,
    })
    expect(byId.get(withBoq)?.createdAt).toBeTruthy()
    expect(byId.get(withoutBoq)).toBeNull()
  })

  it('reports the highest revision when a project has several', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 2 })
    await generateBoq(id, owner)
    await generateBoq(id, owner)

    const rows = await jsonOf<
      { id: string; latestBoq: { revision: number } | null }[]
    >(await listProjects(owner))

    expect(rows[0]?.latestBoq?.revision).toBe(2)
  })

  it('flips stale to true when an item is added without a new revision', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const first = await seededProduct(admin, 'cement-tile', true)
    const second = await seededProduct(admin, 'steel-bar', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, first.variantId, owner, { quantity: 2 })
    await generateBoq(id, owner)

    const fresh = await jsonOf<
      { latestBoq: { revision: number; stale: boolean } | null }[]
    >(await listProjects(owner))
    await putItem(id, second.variantId, owner, { quantity: 1 })
    const stale = await jsonOf<
      { latestBoq: { revision: number; stale: boolean } | null }[]
    >(await listProjects(owner))

    expect(fresh[0]?.latestBoq).toMatchObject({ revision: 1, stale: false })
    expect(stale[0]?.latestBoq).toMatchObject({ revision: 1, stale: true })
  })

  it('never exposes another user BOQ on the list', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const mine = await createProject(owner)
    await putItem(mine, variantId, owner, { quantity: 2 })
    const other = await loginAs(OTHER)
    const theirs = await createProject(other, { name: 'Theirs' })
    await putItem(theirs, variantId, other, { quantity: 3 })
    await generateBoq(theirs, other)

    const rows = await jsonOf<{ id: string; latestBoq: unknown }[]>(
      await listProjects(owner),
    )

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: mine, latestBoq: null })
  })

  it('composes latestBoq on the detail and flags it stale after a change', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    await putItem(id, variantId, owner, { quantity: 2 })

    type Detail = { latestBoq: { revision: number; stale: boolean } | null }
    const detailOf = async () => jsonOf<Detail>(await getProject(id, owner))

    expect((await detailOf()).latestBoq).toBeNull()

    await generateBoq(id, owner)
    expect((await detailOf()).latestBoq).toMatchObject({
      revision: 1,
      stale: false,
    })

    const spaceId = await createdId(
      await app.request(
        `/projects/${id}/spaces`,
        jsonRequest({ name: 'Kitchen' }, owner),
      ),
      'project space create',
    )
    await app.request(
      `/projects/${id}/spaces/${spaceId}`,
      write('PATCH', owner, { name: 'Pantry' }),
    )
    expect((await detailOf()).latestBoq).toMatchObject({ stale: false })

    await putItem(id, variantId, owner, { quantity: 3 })
    expect((await detailOf()).latestBoq).toMatchObject({
      revision: 1,
      stale: true,
    })
  })

  it('summarises the whole list in a fixed number of queries', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const first = await createProject(owner, { name: 'One' })
    await putItem(first, variantId, owner, { quantity: 1 })
    await generateBoq(first, owner)

    const small = await countingQueries(() => listProjects(owner))

    for (let index = 0; index < 4; index += 1) {
      const extra = await createProject(owner, { name: `Extra ${index}` })
      await putItem(extra, variantId, owner, { quantity: index + 1 })
      await generateBoq(extra, owner)
    }

    const large = await countingQueries(() => listProjects(owner))

    expect((await jsonOf<unknown[]>(small.result)).length).toBe(1)
    expect((await jsonOf<unknown[]>(large.result)).length).toBe(5)
    expect(large.queries).toBe(small.queries)
  })
})

describe('batch item reader for other modules', () => {
  it('returns an empty map for no ids without touching the database', async () => {
    const { result, queries } = await countingQueries(() =>
      listItemsForProjects([]),
    )

    expect(result.size).toBe(0)
    expect(queries).toBe(0)
  })

  it('groups enriched items by project and omits projects with none', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const first = await seededProduct(admin, 'cement-tile', true)
    const second = await seededProduct(admin, 'steel-bar', true)
    const owner = await loginAs(OWNER)
    const stocked = await createProject(owner, { name: 'Stocked' })
    const empty = await createProject(owner, { name: 'Empty' })
    await putItem(stocked, first.variantId, owner, { quantity: 2 })
    await putItem(stocked, second.variantId, owner, { quantity: 5 })

    const byProject = await listItemsForProjects([stocked, empty])

    expect([...byProject.keys()]).toEqual([stocked])
    const items = byProject.get(stocked) ?? []
    expect(items).toHaveLength(2)
    expect(
      items.map(({ variantId, quantity, price }) => ({
        variantId,
        quantity,
        price,
      })),
    ).toEqual(
      expect.arrayContaining([
        { variantId: first.variantId, quantity: 2, price: 14.25 },
        { variantId: second.variantId, quantity: 5, price: 14.25 },
      ]),
    )
    expect(items[0]).toMatchObject({
      category: { slug: expect.stringContaining('category-') },
      supplier: { slug: expect.stringContaining('supplier-') },
      product: { status: 'published' },
    })
  })

  it('omits an id that owns nothing and one that does not exist', async () => {
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)

    const byProject = await listItemsForProjects([
      id,
      '00000000-0000-4000-8000-000000000000',
    ])

    expect(byProject.size).toBe(0)
  })

  it('reads any number of projects in a fixed number of queries', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const first = await seededProduct(admin, 'cement-tile', true)
    const second = await seededProduct(admin, 'steel-bar', true)
    const owner = await loginAs(OWNER)
    const ids: string[] = []
    for (let index = 0; index < 5; index += 1) {
      const id = await createProject(owner, { name: `Project ${index}` })
      await putItem(id, first.variantId, owner, { quantity: index + 1 })
      await putItem(id, second.variantId, owner, { quantity: index + 2 })
      ids.push(id)
    }

    const one = await countingQueries(() =>
      listItemsForProjects(ids.slice(0, 1)),
    )
    const five = await countingQueries(() => listItemsForProjects(ids))

    expect(one.result.size).toBe(1)
    expect(five.result.size).toBe(5)
    expect([...five.result.values()].every((items) => items.length === 2)).toBe(
      true,
    )
    expect(five.queries).toBe(one.queries)
  })
})

describe('project spaces', () => {
  const postSpace = (id: string, cookie: string, body: unknown) =>
    app.request(`/projects/${id}/spaces`, jsonRequest(body, cookie))

  const patchSpace = (
    id: string,
    spaceId: string,
    cookie: string,
    body: unknown,
  ) =>
    app.request(
      `/projects/${id}/spaces/${spaceId}`,
      write('PATCH', cookie, body),
    )

  const deleteSpace = (id: string, spaceId: string, cookie: string) =>
    app.request(`/projects/${id}/spaces/${spaceId}`, write('DELETE', cookie))

  const canonicalSpace = async (admin: string, slug: string): Promise<string> =>
    createdId(
      await app.request(
        '/admin/spaces',
        jsonRequest({ name: `Space ${slug}`, slug }, admin),
      ),
      'space create',
    )

  type SpaceResponse = {
    id: string
    projectId: string
    spaceId: string | null
    name: string
    sortOrder: number
  }

  type ItemResponse = {
    id: string
    variantId: string
    quantity: number
    space: { id: string; name: string } | null
  }

  it('creates a named space linked to a canonical one and refuses a case-insensitive duplicate', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const bathroom = await canonicalSpace(admin, 'bathroom')
    const owner = await loginAs(OWNER)
    const other = await loginAs(OTHER)
    const id = await createProject(owner)

    const created = await postSpace(id, owner, {
      name: 'Master bathroom',
      spaceId: bathroom,
    })
    const duplicate = await postSpace(id, owner, { name: 'master BATHROOM' })
    const foreign = await postSpace(id, other, { name: 'Guest bathroom' })
    const unknownCanonical = await postSpace(id, owner, {
      name: 'Kitchen',
      spaceId: '00000000-0000-4000-8000-000000000000',
    })

    expect(created.status).toBe(201)
    expect((await created.json()) as SpaceResponse).toMatchObject({
      projectId: id,
      spaceId: bathroom,
      name: 'Master bathroom',
      sortOrder: 0,
    })
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toMatchObject({
      error: { code: 'PROJECT_SPACE_DUPLICATE' },
    })
    expect(foreign.status).toBe(404)
    expect(unknownCanonical.status).toBe(404)

    const detail = await jsonOf<{ spaces: SpaceResponse[] }>(
      await getProject(id, owner),
    )
    expect(detail.spaces.map((space) => space.name)).toEqual([
      'Master bathroom',
    ])
  })

  it('renames a space, unlinks its canonical space and hides other owners', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const bathroom = await canonicalSpace(admin, 'bathroom')
    const owner = await loginAs(OWNER)
    const other = await loginAs(OTHER)
    const id = await createProject(owner)
    const spaceId = await createdId(
      await postSpace(id, owner, { name: 'Bath', spaceId: bathroom }),
      'space create',
    )

    const renamed = await patchSpace(id, spaceId, owner, {
      name: 'Ensuite',
      spaceId: null,
    })
    const foreign = await patchSpace(id, spaceId, other, { name: 'Hijacked' })

    expect(renamed.status).toBe(200)
    expect((await renamed.json()) as SpaceResponse).toMatchObject({
      name: 'Ensuite',
      spaceId: null,
    })
    expect(foreign.status).toBe(404)
  })

  it('keeps one row per variant and space, updating in place', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const spaceId = await createdId(
      await postSpace(id, owner, { name: 'Kitchen' }),
      'space create',
    )

    const unassigned = await putItem(id, variantId, owner, { quantity: 2 })
    const assigned = await putItem(id, variantId, owner, {
      quantity: 3,
      spaceId,
    })
    const updatedUnassigned = await putItem(id, variantId, owner, {
      quantity: 4,
    })
    const updatedAssigned = await putItem(id, variantId, owner, {
      quantity: 5,
      spaceId,
    })

    expect(unassigned.status).toBe(200)
    expect(assigned.status).toBe(200)
    expect(updatedUnassigned.status).toBe(200)
    expect(updatedAssigned.status).toBe(200)
    expect((await assigned.json()) as ItemResponse).toMatchObject({
      quantity: 3,
      space: { id: spaceId, name: 'Kitchen' },
    })

    const detail = await jsonOf<{ items: ItemResponse[] }>(
      await getProject(id, owner),
    )
    expect(detail.items).toHaveLength(2)
    expect(
      detail.items.map((item) => [item.space?.id ?? null, item.quantity]),
    ).toEqual(
      expect.arrayContaining([
        [null, 4],
        [spaceId, 5],
      ]),
    )
    expect(detail.items.every((item) => typeof item.id === 'string')).toBe(true)
  })

  it('rejects a space that belongs to another project', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const mine = await createProject(owner)
    const theirs = await createProject(owner, { name: 'Other' })
    const spaceId = await createdId(
      await postSpace(theirs, owner, { name: 'Kitchen' }),
      'space create',
    )

    const res = await putItem(mine, variantId, owner, { quantity: 1, spaceId })

    expect(res.status).toBe(404)
  })

  it('unassigns items when their space is deleted', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const spaceId = await createdId(
      await postSpace(id, owner, { name: 'Kitchen' }),
      'space create',
    )
    await putItem(id, variantId, owner, { quantity: 3, spaceId })

    const removed = await deleteSpace(id, spaceId, owner)
    const detail = await jsonOf<{ items: ItemResponse[]; spaces: unknown[] }>(
      await getProject(id, owner),
    )

    expect(removed.status).toBe(204)
    expect(detail.spaces).toEqual([])
    expect(detail.items).toMatchObject([
      { variantId, quantity: 3, space: null },
    ])
  })

  it('removes only the addressed row on delete', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cement-tile', true)
    const owner = await loginAs(OWNER)
    const id = await createProject(owner)
    const spaceId = await createdId(
      await postSpace(id, owner, { name: 'Kitchen' }),
      'space create',
    )
    await putItem(id, variantId, owner, { quantity: 2 })
    await putItem(id, variantId, owner, { quantity: 3, spaceId })

    const unassigned = await deleteItem(id, variantId, owner)
    const afterFirst = await jsonOf<{ items: ItemResponse[] }>(
      await getProject(id, owner),
    )
    const assigned = await app.request(
      `/projects/${id}/items/${variantId}?spaceId=${spaceId}`,
      write('DELETE', owner),
    )
    const afterSecond = await jsonOf<{ items: ItemResponse[] }>(
      await getProject(id, owner),
    )

    expect(unassigned.status).toBe(204)
    expect(afterFirst.items).toMatchObject([{ space: { id: spaceId } }])
    expect(assigned.status).toBe(204)
    expect(afterSecond.items).toEqual([])
  })
})
