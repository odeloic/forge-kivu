import { and, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { app } from '../../app'
import { client, db } from '../../db'
import {
  jsonRequest,
  loginAs,
  loginAsAdmin,
  resetDatabase,
} from '../../test/helpers'
import { PRODUCT_STATUSES, ROLES } from '@forge-kivu/types'
import { users } from '../auth/auth.tables'
import { productVariants } from '../catalogue/catalogue.tables'
import { projectItems } from '../projects/projects.tables'
import {
  boqSummaries,
  getOwned,
  listForProject,
  type BoqProjectSummary,
} from './boq.service'
import { boqItems } from './boq.tables'

const OWNER = { email: 'owner@example.com', password: 'correct horse' }
const OTHER = { email: 'other@example.com', password: 'correct horse' }
const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

type BoqResponse = Record<string, unknown> & {
  id: string
  revision: number
  total: number
  items: {
    variantId: string | null
    name: string
    sku: string | null
    unitPrice: number
    quantity: number
    sortOrder: number
    current: { status: string } | null
  }[]
}

type BoqSummaryResponse = {
  id: string
  projectId: string
  revision: number
  createdAt: string
  lineCount: number
  total: number
}

const countQueries = async (run: () => Promise<unknown>): Promise<number> => {
  const spy = vi.spyOn(client, 'unsafe')
  try {
    await run()
    return spy.mock.calls.length
  } finally {
    spy.mockRestore()
  }
}

const userId = async (email: string): Promise<string> => {
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
  if (!row) throw new Error(`no user ${email}`)
  return row.id
}

const write = (method: 'POST' | 'PUT' | 'DELETE', cookie?: string) => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  },
})

const authGet = (path: string, cookie?: string) =>
  app.request(path, cookie ? { headers: { cookie } } : undefined)

const postBoq = (projectId: string, cookie?: string) =>
  app.request(`/projects/${projectId}/boqs`, write('POST', cookie))

const listBoqs = (projectId: string, cookie?: string) =>
  authGet(`/projects/${projectId}/boqs`, cookie)

const getBoq = (id: string, cookie?: string) => authGet(`/boqs/${id}`, cookie)

const exportBoq = (id: string, format: string, cookie?: string) =>
  authGet(`/boqs/${id}/export?format=${format}`, cookie)

const createdId = async (res: Response, what: string): Promise<string> => {
  if (res.status !== 201) {
    throw new Error(`${what} failed with status ${res.status}`)
  }
  const json = (await res.json()) as { id: string }
  return json.id
}

const seededProduct = async (
  admin: string,
  slug: string,
  price: number | null = 14.25,
): Promise<{ productId: string; variantId: string }> => {
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

  const varied = await app.request(`/admin/products/${productId}/variants`, {
    ...write('PUT', admin),
    body: JSON.stringify({
      variants: [{ sku: `${slug}-1`, ...(price === null ? {} : { price }) }],
    }),
  })
  if (varied.status !== 200) {
    throw new Error(`set variants failed with status ${varied.status}`)
  }
  const detail = (await varied.json()) as { variants: { id: string }[] }
  const variantId = detail.variants[0]?.id
  if (!variantId) throw new Error('set variants returned no variant')

  const published = await app.request(
    `/admin/products/${productId}/publish`,
    write('POST', admin),
  )
  if (published.status !== 200) {
    throw new Error(`publish failed with status ${published.status}`)
  }

  return { productId, variantId }
}

const createProject = async (cookie: string): Promise<string> => {
  const res = await app.request(
    '/projects',
    jsonRequest(
      {
        name: 'Lakeside House',
        projectType: 'residential_house',
        clientName: 'Ada',
      },
      cookie,
    ),
  )
  return createdId(res, 'project create')
}

const putItem = async (
  projectId: string,
  variantId: string,
  cookie: string,
  quantity: number,
): Promise<void> => {
  const res = await app.request(`/projects/${projectId}/items/${variantId}`, {
    ...write('PUT', cookie),
    body: JSON.stringify({ quantity }),
  })
  if (res.status !== 200) {
    throw new Error(`put item failed with status ${res.status}`)
  }
}

type Fixture = {
  admin: string
  owner: string
  projectId: string
  productId: string
  variantId: string
}

const projectWithItem = async (): Promise<Fixture> => {
  const admin = await loginAsAdmin(ADMIN)
  const { productId, variantId } = await seededProduct(admin, 'cement-tile')
  const owner = await loginAs(OWNER)
  const projectId = await createProject(owner)
  await putItem(projectId, variantId, owner, 3)
  return { admin, owner, projectId, productId, variantId }
}

const generated = async (fixture: Fixture): Promise<BoqResponse> => {
  const res = await postBoq(fixture.projectId, fixture.owner)
  if (res.status !== 201) {
    throw new Error(`generate failed with status ${res.status}`)
  }
  return (await res.json()) as BoqResponse
}

beforeEach(async () => {
  await resetDatabase()
})

describe('generate a boq', () => {
  it('assigns sequential revisions per project', async () => {
    const fixture = await projectWithItem()

    const first = await postBoq(fixture.projectId, fixture.owner)
    const second = await postBoq(fixture.projectId, fixture.owner)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(((await first.json()) as BoqResponse).revision).toBe(1)
    expect(((await second.json()) as BoqResponse).revision).toBe(2)
  })

  it('freezes item data against catalogue changes', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    await db
      .update(productVariants)
      .set({ price: 99.99 })
      .where(eq(productVariants.id, fixture.variantId))

    const read = await getBoq(boq.id, fixture.owner)
    const project = await authGet(
      `/projects/${fixture.projectId}`,
      fixture.owner,
    )

    expect(read.status).toBe(200)
    const frozen = (await read.json()) as BoqResponse
    expect(frozen.items).toEqual([
      {
        id: expect.any(String),
        boqId: boq.id,
        variantId: fixture.variantId,
        name: 'Product cement-tile',
        sku: 'cement-tile-1',
        unitPrice: 14.25,
        quantity: 3,
        sortOrder: 0,
        current: { status: PRODUCT_STATUSES.PUBLISHED },
      },
    ])
    expect(frozen.total).toBe(42.75)
    expect((await project.json()) as Record<string, unknown>).toMatchObject({
      items: [{ price: 99.99 }],
    })
  })

  it('returns 422 for a project with no items', async () => {
    const owner = await loginAs(OWNER)
    const projectId = await createProject(owner)

    const res = await postBoq(projectId, owner)

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      error: { code: 'BOQ_NOT_GENERATABLE' },
    })
  })

  it('returns 422 for an unpriced variant', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'bare-tile', null)
    const owner = await loginAs(OWNER)
    const projectId = await createProject(owner)
    await putItem(projectId, variantId, owner, 1)

    const res = await postBoq(projectId, owner)

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      error: { code: 'BOQ_NOT_GENERATABLE' },
    })
  })

  it('returns 422 for an item whose product is retired', async () => {
    const fixture = await projectWithItem()
    const retired = await app.request(
      `/admin/products/${fixture.productId}/unpublish`,
      write('POST', fixture.admin),
    )
    expect(retired.status).toBe(200)

    const res = await postBoq(fixture.projectId, fixture.owner)

    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      error: { code: 'BOQ_NOT_GENERATABLE' },
    })
  })

  it('gives concurrent calls distinct revisions', async () => {
    const fixture = await projectWithItem()

    const [first, second] = await Promise.all([
      postBoq(fixture.projectId, fixture.owner),
      postBoq(fixture.projectId, fixture.owner),
    ])

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    const revisions = [
      ((await first.json()) as BoqResponse).revision,
      ((await second.json()) as BoqResponse).revision,
    ].sort()
    expect(revisions).toEqual([1, 2])
  })
})

describe('read boqs', () => {
  it('lists revisions newest first', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)
    await generated(fixture)

    const res = await listBoqs(fixture.projectId, fixture.owner)

    expect(res.status).toBe(200)
    const rows = (await res.json()) as BoqResponse[]
    expect(rows.map((row) => row.revision)).toEqual([2, 1])
  })

  it('hides another user project behind a 404', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)
    const other = await loginAs(OTHER)

    const generate = await postBoq(fixture.projectId, other)
    const list = await listBoqs(fixture.projectId, other)
    const read = await getBoq(boq.id, other)

    expect(generate.status).toBe(404)
    expect(list.status).toBe(404)
    expect(read.status).toBe(404)
  })

  it('rejects anonymous callers with 401', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    expect((await postBoq(fixture.projectId)).status).toBe(401)
    expect((await listBoqs(fixture.projectId)).status).toBe(401)
    expect((await getBoq(boq.id)).status).toBe(401)
  })
})

describe('export a boq', () => {
  it('downloads csv rows matching boq_items', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    const res = await exportBoq(boq.id, 'csv', fixture.owner)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain(
      'lakeside-house-boq-r1.csv',
    )

    const rows = await db
      .select()
      .from(boqItems)
      .where(eq(boqItems.boqId, boq.id))
    const expected = [
      'name,sku,unitPrice,quantity',
      ...rows.map(
        (row) =>
          `${row.name},${row.sku},${row.unitPrice.toFixed(2)},${row.quantity}`,
      ),
      '',
    ].join('\n')
    expect(await res.text()).toBe(expected)
  })

  it('downloads an xlsx with header block, items, and total', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    const res = await exportBoq(boq.id, 'xlsx', fixture.owner)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('spreadsheetml')

    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await res.arrayBuffer())
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error('workbook has no sheet')

    expect(sheet.getCell('A1').value).toBe('Project')
    expect(sheet.getCell('B1').value).toBe('Lakeside House')
    expect(sheet.getCell('B2').value).toBe('Ada')
    expect(sheet.getCell('B3').value).toBe(1)
    expect(sheet.getCell('B5').value).toBe('RWF')
    expect(sheet.getCell('A7').value).toBe('Name')
    expect(sheet.getCell('A8').value).toBe('Product cement-tile')
    expect(sheet.getCell('C8').value).toBe(14.25)
    expect(sheet.getCell('D8').value).toBe(3)
    expect(sheet.getCell('A9').value).toBe('Total')
    expect(sheet.getCell('E9').value).toBe(42.75)
  })

  it('rejects an unknown format with 400', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    const res = await exportBoq(boq.id, 'pdf', fixture.owner)

    expect(res.status).toBe(400)
  })

  it('returns 404 after the project is deleted', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    const removed = await app.request(
      `/projects/${fixture.projectId}`,
      write('DELETE', fixture.owner),
    )
    expect(removed.status).toBe(204)

    const res = await exportBoq(boq.id, 'csv', fixture.owner)
    expect(res.status).toBe(404)
  })
})

const dropItem = async (
  projectId: string,
  variantId: string,
): Promise<void> => {
  await db
    .delete(projectItems)
    .where(
      and(
        eq(projectItems.projectId, projectId),
        eq(projectItems.variantId, variantId),
      ),
    )
}

const summaryOf = async (
  projectId: string,
): Promise<BoqProjectSummary | undefined> =>
  (await boqSummaries([projectId])).get(projectId)

describe('revision summaries', () => {
  it('returns lineCount and total on every row, newest first', async () => {
    const fixture = await projectWithItem()
    const extra = await seededProduct(fixture.admin, 'steel-bar', 8.5)
    await generated(fixture)
    await putItem(fixture.projectId, extra.variantId, fixture.owner, 2)
    await generated(fixture)

    const res = await listBoqs(fixture.projectId, fixture.owner)

    expect(res.status).toBe(200)
    const rows = (await res.json()) as BoqSummaryResponse[]
    expect(rows.map((row) => [row.revision, row.lineCount, row.total])).toEqual(
      [
        [2, 2, 59.75],
        [1, 1, 42.75],
      ],
    )
  })

  it('matches the detail total to the cent', async () => {
    const fixture = await projectWithItem()
    const extra = await seededProduct(fixture.admin, 'sand-bag', 3.33)
    await putItem(fixture.projectId, extra.variantId, fixture.owner, 7)
    const boq = await generated(fixture)

    const rows = (await (
      await listBoqs(fixture.projectId, fixture.owner)
    ).json()) as BoqSummaryResponse[]
    const detail = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    expect(rows[0]?.total).toBe(detail.total)
    expect(rows[0]?.lineCount).toBe(detail.items.length)
  })

  it('aggregates three revisions in one query', async () => {
    const fixture = await projectWithItem()
    const owner = await userId(OWNER.email)
    await generated(fixture)

    const one = await countQueries(() =>
      listForProject(fixture.projectId, owner),
    )
    await generated(fixture)
    await generated(fixture)
    const three = await countQueries(() =>
      listForProject(fixture.projectId, owner),
    )

    expect(one).toBe(2)
    expect(three).toBe(2)
  })

  it('returns an empty list for a project with no revisions', async () => {
    const owner = await loginAs(OWNER)
    const projectId = await createProject(owner)

    const res = await listBoqs(projectId, owner)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })
})

describe('cross-project summaries', () => {
  it('returns the latest revision per project', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)
    await putItem(fixture.projectId, fixture.variantId, fixture.owner, 4)
    await generated(fixture)

    const summary = await summaryOf(fixture.projectId)

    expect(summary).toMatchObject({
      projectId: fixture.projectId,
      revision: 2,
      lineCount: 1,
      total: 57,
      stale: false,
    })
  })

  it('does not scale its query count with the project count', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)
    const projectIds = [fixture.projectId]

    const forOne = await countQueries(() => boqSummaries(projectIds))

    for (let index = 0; index < 4; index++) {
      const projectId = await createProject(fixture.owner)
      await putItem(projectId, fixture.variantId, fixture.owner, index + 1)
      const res = await postBoq(projectId, fixture.owner)
      expect(res.status).toBe(201)
      projectIds.push(projectId)
    }

    const forFive = await countQueries(() => boqSummaries(projectIds))
    const summaries = await boqSummaries(projectIds)

    expect(summaries.size).toBe(5)
    expect(forFive).toBe(forOne)
  })

  it('reports untouched items as fresh', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)

    expect((await summaryOf(fixture.projectId))?.stale).toBe(false)
  })

  it('flips on a quantity change and back again', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)

    await putItem(fixture.projectId, fixture.variantId, fixture.owner, 5)
    const changed = await summaryOf(fixture.projectId)

    await putItem(fixture.projectId, fixture.variantId, fixture.owner, 3)
    const restored = await summaryOf(fixture.projectId)

    expect(changed?.stale).toBe(true)
    expect(restored?.stale).toBe(false)
  })

  it('is stale when one item replaces another at the same count', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)
    const extra = await seededProduct(fixture.admin, 'clay-brick', 14.25)

    await putItem(fixture.projectId, extra.variantId, fixture.owner, 3)
    await dropItem(fixture.projectId, fixture.variantId)

    const summary = await summaryOf(fixture.projectId)

    expect(summary?.lineCount).toBe(1)
    expect(summary?.stale).toBe(true)
  })

  it('is stale when the variant is repriced in the catalogue', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)

    await db
      .update(productVariants)
      .set({ price: 99.99 })
      .where(eq(productVariants.id, fixture.variantId))

    expect((await summaryOf(fixture.projectId))?.stale).toBe(true)
  })

  it('is stale when the variant loses its price', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)

    await db
      .update(productVariants)
      .set({ price: null })
      .where(eq(productVariants.id, fixture.variantId))

    expect((await summaryOf(fixture.projectId))?.stale).toBe(true)
  })

  it('separates a null price from a zero price', async () => {
    const fixture = await projectWithItem()
    await db
      .update(productVariants)
      .set({ price: 0 })
      .where(eq(productVariants.id, fixture.variantId))
    await generated(fixture)

    const priced = await summaryOf(fixture.projectId)

    await db
      .update(productVariants)
      .set({ price: null })
      .where(eq(productVariants.id, fixture.variantId))

    const unpriced = await summaryOf(fixture.projectId)

    expect(priced?.stale).toBe(false)
    expect(unpriced?.stale).toBe(true)
  })

  it('omits a project with no revisions', async () => {
    const fixture = await projectWithItem()
    const bare = await createProject(fixture.owner)
    await generated(fixture)

    const summaries = await boqSummaries([fixture.projectId, bare])

    expect(summaries.has(fixture.projectId)).toBe(true)
    expect(summaries.has(bare)).toBe(false)
  })

  it('returns an empty map for no ids without hitting the database', async () => {
    const queries = await countQueries(() => boqSummaries([]))

    expect(queries).toBe(0)
    expect((await boqSummaries([])).size).toBe(0)
  })
})

describe('current product status per line', () => {
  it('reports the status of every line whose variant still exists', async () => {
    const fixture = await projectWithItem()
    const extra = await seededProduct(fixture.admin, 'roof-sheet', 21)
    await putItem(fixture.projectId, extra.variantId, fixture.owner, 1)
    const boq = await generated(fixture)

    const read = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    expect(read.items.map((item) => item.current)).toEqual([
      { status: PRODUCT_STATUSES.PUBLISHED },
      { status: PRODUCT_STATUSES.PUBLISHED },
    ])
  })

  it('follows a withdrawal without moving the frozen values', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    const withdrawn = await app.request(
      `/admin/products/${fixture.productId}/unpublish`,
      write('POST', fixture.admin),
    )
    expect(withdrawn.status).toBe(200)

    const read = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    expect(read.items[0]).toMatchObject({
      variantId: fixture.variantId,
      name: 'Product cement-tile',
      sku: 'cement-tile-1',
      unitPrice: 14.25,
      quantity: 3,
      current: { status: PRODUCT_STATUSES.NOT_AVAILABLE },
    })
    expect(read.total).toBe(42.75)
  })

  it('keeps a deleted variant line on its frozen values', async () => {
    const fixture = await projectWithItem()
    const boq = await generated(fixture)

    await dropItem(fixture.projectId, fixture.variantId)
    await db
      .delete(productVariants)
      .where(eq(productVariants.id, fixture.variantId))

    const read = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    expect(read.items[0]).toMatchObject({
      variantId: null,
      current: null,
      name: 'Product cement-tile',
      sku: 'cement-tile-1',
      unitPrice: 14.25,
      quantity: 3,
    })
  })

  it('resolves a whole revision in one variant lookup', async () => {
    const fixture = await projectWithItem()
    const owner = await userId(OWNER.email)
    const single = await generated(fixture)

    const forOne = await countQueries(() => getOwned(single.id, owner))

    for (const slug of ['pipe-a', 'pipe-b']) {
      const extra = await seededProduct(fixture.admin, slug, 5)
      await putItem(fixture.projectId, extra.variantId, fixture.owner, 1)
    }
    const many = await generated(fixture)
    const forThree = await countQueries(() => getOwned(many.id, owner))

    expect((await getOwned(many.id, owner))?.items).toHaveLength(3)
    expect(forThree).toBe(forOne)
  })
})
