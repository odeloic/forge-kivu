import { and, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
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
import {
  arrangeLines,
  type BoqLineView,
  boqViewQuerySchema,
  PRODUCT_STATUSES,
  ROLES,
} from '@forge-kivu/types'
import { users } from '../auth/auth.tables'
import {
  productOptionValues,
  products,
  productVariants,
} from '../catalogue/catalogue.tables'
import { projectItems } from '../projects/projects.tables'
import { suppliers } from '../suppliers/suppliers.tables'
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
    unit: string
    sortOrder: number
    current: { status: string; imageUrl: string | null } | null
    supplierName: string
    categoryName: string
    categoryRootName: string
    spaceName: string | null
    options: { name: string; type: string; value: string; hex: string | null }[]
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

beforeAll(async () => {
  await ensurePublicBucket()
})

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
        unit: 'pc',
        spaceId: null,
        spaceName: null,
        supplierName: 'Supplier cement-tile',
        categoryName: 'Category cement-tile',
        categoryRootName: 'Category cement-tile',
        options: [],
        sortOrder: 0,
        current: { status: PRODUCT_STATUSES.PUBLISHED, imageUrl: null },
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
      'name,sku,supplier,category,space,unit,options,unitPrice,quantity,lineTotal',
      ...rows.map(
        (row) =>
          `${row.name},${row.sku},${row.supplierName},${row.categoryName},,${row.unit},,${row.unitPrice.toFixed(2)},${row.quantity},${(row.unitPrice * row.quantity).toFixed(2)}`,
      ),
      '',
    ].join('\n')
    expect(await res.text()).toBe(expected)
  })

  it('rounds a fractional quantity to the cent everywhere', async () => {
    const admin = await loginAsAdmin(ADMIN)
    const { variantId } = await seededProduct(admin, 'cable-drum', 1234.56)
    const owner = await loginAs(OWNER)
    const projectId = await createProject(owner)
    await putItem(projectId, variantId, owner, 12.5)
    const boq = await generated({
      admin,
      owner,
      projectId,
      productId: '',
      variantId,
    })

    const csv = await exportBoq(boq.id, 'csv', owner)
    const xlsx = await exportBoq(boq.id, 'xlsx', owner)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await xlsx.arrayBuffer())
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error('workbook has no sheet')

    expect(boq.items[0]).toMatchObject({ quantity: 12.5, unit: 'pc' })
    expect(boq.total).toBe(15432)
    expect(await csv.text()).toContain(
      'Product cable-drum,cable-drum-1,Supplier cable-drum,Category cable-drum,,pc,,1234.56,12.5,15432.00',
    )
    expect(sheet.getCell('I8').value).toBe(12.5)
    expect(sheet.getCell('J8').value).toBe(15432)
    expect(sheet.getCell('J9').value).toBe(15432)
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
    expect(sheet.getRow(7).values).toEqual([
      undefined,
      'Name',
      'SKU',
      'Supplier',
      'Category',
      'Space',
      'Unit',
      'Options',
      'Unit price',
      'Quantity',
      'Line total',
    ])
    expect(sheet.getCell('A8').value).toBe('Product cement-tile')
    expect(sheet.getCell('C8').value).toBe('Supplier cement-tile')
    expect(sheet.getCell('D8').value).toBe('Category cement-tile')
    expect(sheet.getCell('F8').value).toBe('pc')
    expect(sheet.getCell('H8').value).toBe(14.25)
    expect(sheet.getCell('I8').value).toBe(3)
    expect(sheet.getCell('A9').value).toBe('Total')
    expect(sheet.getCell('J9').value).toBe(42.75)
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
      { status: PRODUCT_STATUSES.PUBLISHED, imageUrl: null },
      { status: PRODUCT_STATUSES.PUBLISHED, imageUrl: null },
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

describe('spaces on boq lines', () => {
  const createSpace = async (
    projectId: string,
    cookie: string,
    name: string,
  ): Promise<string> => {
    const res = await app.request(
      `/projects/${projectId}/spaces`,
      jsonRequest({ name }, cookie),
    )
    return createdId(res, 'space create')
  }

  const moveItem = async (
    fixture: Fixture,
    spaceId: string | null,
  ): Promise<void> => {
    const res = await app.request(
      `/projects/${fixture.projectId}/items/${fixture.variantId}`,
      {
        ...write('PUT', fixture.owner),
        body: JSON.stringify({ quantity: 3, spaceId }),
      },
    )
    if (res.status !== 200) {
      throw new Error(`put item failed with status ${res.status}`)
    }
    const unassigned = await app.request(
      `/projects/${fixture.projectId}/items/${fixture.variantId}`,
      write('DELETE', fixture.owner),
    )
    if (unassigned.status !== 204) {
      throw new Error(`delete item failed with status ${unassigned.status}`)
    }
  }

  it('goes stale when an item moves into a space but not when the space is renamed', async () => {
    const fixture = await projectWithItem()
    await generated(fixture)
    const spaceId = await createSpace(
      fixture.projectId,
      fixture.owner,
      'Kitchen',
    )

    const fresh = await summaryOf(fixture.projectId)
    await moveItem(fixture, spaceId)
    const moved = await summaryOf(fixture.projectId)
    await generated(fixture)
    const regenerated = await summaryOf(fixture.projectId)

    const renamed = await app.request(
      `/projects/${fixture.projectId}/spaces/${spaceId}`,
      {
        ...write('PUT', fixture.owner),
        method: 'PATCH',
        body: JSON.stringify({ name: 'Pantry' }),
      },
    )
    expect(renamed.status).toBe(200)
    const afterRename = await summaryOf(fixture.projectId)

    expect(fresh?.stale).toBe(false)
    expect(moved?.stale).toBe(true)
    expect(regenerated?.stale).toBe(false)
    expect(afterRename?.stale).toBe(false)
  })

  it('freezes the space name and keeps it after the space is deleted', async () => {
    const fixture = await projectWithItem()
    const spaceId = await createSpace(
      fixture.projectId,
      fixture.owner,
      'Kitchen',
    )
    await moveItem(fixture, spaceId)
    const boq = await generated(fixture)

    const removed = await app.request(
      `/projects/${fixture.projectId}/spaces/${spaceId}`,
      write('DELETE', fixture.owner),
    )
    expect(removed.status).toBe(204)

    const read = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    expect(read.items[0]).toMatchObject({
      spaceId,
      spaceName: 'Kitchen',
      quantity: 3,
    })
    const [row] = await db
      .select()
      .from(boqItems)
      .where(eq(boqItems.boqId, boq.id))
    expect(row?.spaceName).toBe('Kitchen')
  })
})

describe('frozen revisions', () => {
  type Rich = Fixture & {
    supplierId: string
    rootId: string
    leafId: string
    optionValueId: string
    variantImageUrl: string
    coverUrl: string
    plainVariantId: string
  }

  const richFixture = async (): Promise<Rich> => {
    const admin = await loginAsAdmin(ADMIN)
    const uploader = await loginAs({
      email: 'uploader@example.com',
      password: 'correct horse',
    })
    const supplierId = await createdId(
      await app.request(
        '/admin/suppliers',
        jsonRequest({ name: 'Kivu Roofing', slug: 'kivu-roofing' }, admin),
      ),
      'supplier create',
    )
    const rootId = await createdId(
      await app.request(
        '/admin/categories',
        jsonRequest({ name: 'Roofing', slug: 'roofing' }, admin),
      ),
      'root create',
    )
    const leafId = await createdId(
      await app.request(
        '/admin/categories',
        jsonRequest(
          { name: 'Metal Sheets', slug: 'metal-sheets', parentId: rootId },
          admin,
        ),
      ),
      'leaf create',
    )
    const productId = await createdId(
      await app.request(
        '/admin/products',
        jsonRequest(
          {
            supplierId,
            categoryId: leafId,
            name: 'Corrugated Sheet',
            slug: 'corrugated-sheet',
          },
          admin,
        ),
      ),
      'product create',
    )
    const withOptions = await app.request(
      `/admin/products/${productId}/options`,
      {
        ...write('PUT', admin),
        body: JSON.stringify({
          options: [
            {
              name: 'Colour',
              type: 'color',
              values: [{ value: 'Forest Green', hex: '#2e5e3a' }],
            },
            { name: 'Width', values: [{ value: '200 mm' }] },
          ],
        }),
      },
    )
    if (withOptions.status !== 200) {
      throw new Error(`set options failed with status ${withOptions.status}`)
    }
    const optionRows = (await withOptions.json()) as {
      options: { name: string; values: { id: string }[] }[]
    }
    const valueIds = optionRows.options.map((option) => {
      const id = option.values[0]?.id
      if (!id) throw new Error('option has no value')
      return id
    })
    const image = await createReadyMedia(uploader)
    const cover = await createReadyMedia(uploader)
    const varied = await app.request(`/admin/products/${productId}/variants`, {
      ...write('PUT', admin),
      body: JSON.stringify({
        variants: [
          {
            sku: 'RFS-GRN',
            price: 20.5,
            imageMediaId: image,
            optionValueIds: valueIds,
          },
        ],
      }),
    })
    if (varied.status !== 200) {
      throw new Error(`set variants failed with status ${varied.status}`)
    }
    const detail = (await varied.json()) as {
      variants: { id: string; imageUrl: string }[]
    }
    const variant = detail.variants[0]
    if (!variant) throw new Error('set variants returned no variant')
    const withMedia = await app.request(`/admin/products/${productId}/media`, {
      ...write('PUT', admin),
      body: JSON.stringify({ mediaIds: [cover] }),
    })
    if (withMedia.status !== 200) {
      throw new Error(`set media failed with status ${withMedia.status}`)
    }
    const coverUrl = ((await withMedia.json()) as { media: { url: string }[] })
      .media[0]?.url
    if (!coverUrl) throw new Error('cover has no url')
    const published = await app.request(
      `/admin/products/${productId}/publish`,
      write('POST', admin),
    )
    if (published.status !== 200) {
      throw new Error(`publish failed with status ${published.status}`)
    }

    const plain = await seededProduct(admin, 'plain-sheet', 5)
    const owner = await loginAs(OWNER)
    const projectId = await createProject(owner)
    await putItem(projectId, variant.id, owner, 2)
    await putItem(projectId, plain.variantId, owner, 1)

    return {
      admin,
      owner,
      projectId,
      productId,
      variantId: variant.id,
      supplierId,
      rootId,
      leafId,
      optionValueId: valueIds[0] as string,
      variantImageUrl: variant.imageUrl,
      coverUrl,
      plainVariantId: plain.variantId,
    }
  }

  const lineOf = (boq: BoqResponse, variantId: string | null) =>
    boq.items.find((item) => item.variantId === variantId)

  it('freezes supplier, categories and typed options on every line', async () => {
    const fixture = await richFixture()

    const boq = await generated(fixture)

    expect(lineOf(boq, fixture.variantId)).toMatchObject({
      name: 'Corrugated Sheet (Forest Green / 200 mm)',
      supplierName: 'Kivu Roofing',
      categoryName: 'Metal Sheets',
      categoryRootName: 'Roofing',
      unit: 'pc',
      options: [
        {
          name: 'Colour',
          type: 'color',
          value: 'Forest Green',
          hex: '#2e5e3a',
        },
        { name: 'Width', type: 'text', value: '200 mm', hex: null },
      ],
      current: {
        status: PRODUCT_STATUSES.PUBLISHED,
        imageUrl: fixture.variantImageUrl,
      },
    })
    expect(lineOf(boq, fixture.plainVariantId)).toMatchObject({
      categoryName: 'Category plain-sheet',
      categoryRootName: 'Category plain-sheet',
      options: [],
      current: { status: PRODUCT_STATUSES.PUBLISHED, imageUrl: null },
    })
  })

  it('keeps the frozen line while the catalogue moves on', async () => {
    const fixture = await richFixture()
    const boq = await generated(fixture)
    const otherRoot = await createdId(
      await app.request(
        '/admin/categories',
        jsonRequest({ name: 'Cladding', slug: 'cladding' }, fixture.admin),
      ),
      'category create',
    )

    await db
      .update(suppliers)
      .set({ name: 'Renamed Roofing' })
      .where(eq(suppliers.id, fixture.supplierId))
    await db
      .update(products)
      .set({ categoryId: otherRoot })
      .where(eq(products.id, fixture.productId))
    await db
      .update(productOptionValues)
      .set({ value: 'Moss Green', hex: '#004400' })
      .where(eq(productOptionValues.id, fixture.optionValueId))

    const read = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse
    const frozen = lineOf(read, fixture.variantId)

    expect(frozen).toMatchObject({
      supplierName: 'Kivu Roofing',
      categoryName: 'Metal Sheets',
      categoryRootName: 'Roofing',
      options: [
        { name: 'Colour', value: 'Forest Green', hex: '#2e5e3a' },
        { name: 'Width', value: '200 mm' },
      ],
    })

    await db
      .delete(projectItems)
      .where(eq(projectItems.variantId, fixture.variantId))
    await db
      .delete(productVariants)
      .where(eq(productVariants.id, fixture.variantId))

    const afterDelete = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse
    const orphan = afterDelete.items.find(
      (item) => item.name === 'Corrugated Sheet (Forest Green / 200 mm)',
    )

    expect(orphan).toMatchObject({
      variantId: null,
      current: null,
      supplierName: 'Kivu Roofing',
      categoryName: 'Metal Sheets',
      categoryRootName: 'Roofing',
      unitPrice: 20.5,
      quantity: 2,
      options: [{ value: 'Forest Green', hex: '#2e5e3a' }, { value: '200 mm' }],
    })
  })

  it('resolves the gallery image live and drops it for withdrawn lines', async () => {
    const fixture = await richFixture()
    const boq = await generated(fixture)

    await db
      .update(productVariants)
      .set({ imageMediaId: null })
      .where(eq(productVariants.id, fixture.variantId))
    const coverFallback = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    const withdrawn = await app.request(
      `/admin/products/${fixture.productId}/unpublish`,
      write('POST', fixture.admin),
    )
    expect(withdrawn.status).toBe(200)
    const retired = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse

    expect(lineOf(coverFallback, fixture.variantId)?.current).toEqual({
      status: PRODUCT_STATUSES.PUBLISHED,
      imageUrl: fixture.coverUrl,
    })
    expect(lineOf(retired, fixture.variantId)?.current).toEqual({
      status: PRODUCT_STATUSES.NOT_AVAILABLE,
      imageUrl: fixture.coverUrl,
    })
  })

  it('exports the frozen columns in order', async () => {
    const fixture = await richFixture()
    const boq = await generated(fixture)

    const csv = await (await exportBoq(boq.id, 'csv', fixture.owner)).text()
    const xlsx = await exportBoq(boq.id, 'xlsx', fixture.owner)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await xlsx.arrayBuffer())
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error('workbook has no sheet')

    expect(csv.split('\n')[0]).toBe(
      'name,sku,supplier,category,space,unit,options,unitPrice,quantity,lineTotal',
    )
    expect(csv).toContain(
      'Corrugated Sheet (Forest Green / 200 mm),RFS-GRN,Kivu Roofing,Metal Sheets,,pc,Colour: Forest Green; Width: 200 mm,20.50,2,41.00',
    )
    const row = [8, 9].find(
      (index) =>
        sheet.getCell(`A${index}`).value ===
        'Corrugated Sheet (Forest Green / 200 mm)',
    )
    expect(sheet.getRow(row ?? 8).values).toEqual([
      undefined,
      'Corrugated Sheet (Forest Green / 200 mm)',
      'RFS-GRN',
      'Kivu Roofing',
      'Metal Sheets',
      '',
      'pc',
      'Colour: Forest Green; Width: 200 mm',
      20.5,
      2,
      41,
    ])
  })
})

describe('export mirrors the view', () => {
  type Rows = Fixture & { spaceId: string; greenId: string; plainId: string }

  const viewFixture = async (): Promise<Rows> => {
    const admin = await loginAsAdmin(ADMIN)
    const green = await seededProduct(admin, 'green-sheet', 20.5)
    const plain = await seededProduct(admin, 'plain-sheet', 5)
    const red = await seededProduct(admin, 'red-sheet', 30)
    const owner = await loginAs(OWNER)
    const projectId = await createProject(owner)
    const spaceId = await createdId(
      await app.request(
        `/projects/${projectId}/spaces`,
        jsonRequest({ name: 'Kitchen' }, owner),
      ),
      'space create',
    )
    const inSpace = await app.request(
      `/projects/${projectId}/items/${green.variantId}`,
      {
        ...write('PUT', owner),
        body: JSON.stringify({ quantity: 2, spaceId }),
      },
    )
    if (inSpace.status !== 200) throw new Error('put item failed')
    await putItem(projectId, plain.variantId, owner, 1)
    await putItem(projectId, red.variantId, owner, 1)
    return {
      admin,
      owner,
      projectId,
      productId: green.productId,
      variantId: green.variantId,
      spaceId,
      greenId: green.variantId,
      plainId: plain.variantId,
    }
  }

  const exportWith = (id: string, cookie: string, query: string) =>
    authGet(`/boqs/${id}/export?${query}`, cookie)

  const sheetOf = async (res: Response): Promise<ExcelJS.Worksheet> => {
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(await res.arrayBuffer())
    const sheet = workbook.worksheets[0]
    if (!sheet) throw new Error('workbook has no sheet')
    return sheet
  }

  const columnA = (sheet: ExcelJS.Worksheet, from: number): unknown[] => {
    const values: unknown[] = []
    for (let row = from; row <= sheet.rowCount; row++) {
      values.push(sheet.getCell(`A${row}`).value)
    }
    return values
  }

  it('re-adds locked columns and rejects unknown ones', async () => {
    const fixture = await viewFixture()
    const boq = await generated(fixture)

    const narrowed = await exportWith(
      boq.id,
      fixture.owner,
      'format=csv&columns=sku,quantity',
    )
    const bogus = await exportWith(
      boq.id,
      fixture.owner,
      'format=csv&columns=bogus',
    )

    expect(narrowed.status).toBe(200)
    expect((await narrowed.text()).split('\n')[0]).toBe(
      'name,sku,quantity,lineTotal',
    )
    expect(bogus.status).toBe(400)
  })

  it('produces the same csv with and without default view params', async () => {
    const fixture = await viewFixture()
    const boq = await generated(fixture)

    const bare = await (await exportBoq(boq.id, 'csv', fixture.owner)).text()
    const explicit = await (
      await exportWith(
        boq.id,
        fixture.owner,
        'format=csv&columns=name,sku,supplier,category,space,unit,options,unitPrice,quantity,lineTotal&sort=sortOrder:asc',
      )
    ).text()

    expect(explicit).toBe(bare)
    expect(bare.split('\n')[0]).toBe(
      'name,sku,supplier,category,space,unit,options,unitPrice,quantity,lineTotal',
    )
  })

  it('groups by space in csv and xlsx with unassigned last', async () => {
    const fixture = await viewFixture()
    const boq = await generated(fixture)

    const csv = await (
      await exportWith(
        boq.id,
        fixture.owner,
        'format=csv&groupBy=space&columns=name&sort=name:asc',
      )
    ).text()
    const sheet = await sheetOf(
      await exportWith(
        boq.id,
        fixture.owner,
        'format=xlsx&groupBy=space&columns=name&sort=name:asc',
      ),
    )

    expect(csv.split('\n').slice(0, 4)).toEqual([
      'group,name,lineTotal',
      'Kitchen,Product green-sheet,41.00',
      'Unassigned,Product plain-sheet,5.00',
      'Unassigned,Product red-sheet,30.00',
    ])
    expect(columnA(sheet, 7)).toEqual([
      'Name',
      'Kitchen',
      'Product green-sheet',
      'Subtotal',
      'Unassigned',
      'Product plain-sheet',
      'Product red-sheet',
      'Subtotal',
      'Total',
    ])
    expect(sheet.getCell('B10').value).toBe(41)
    expect(sheet.getCell('B14').value).toBe(35)
    expect(sheet.getCell('B15').value).toBe(76)
    expect(sheet.getRow(8).font?.bold).toBe(true)
  })

  it('orders lines identically in csv, xlsx and arrangeLines', async () => {
    const fixture = await viewFixture()
    const boq = await generated(fixture)
    const query = 'sort=unitPrice:desc&columns=name'

    const csv = await (
      await exportWith(boq.id, fixture.owner, `format=csv&${query}`)
    ).text()
    const sheet = await sheetOf(
      await exportWith(boq.id, fixture.owner, `format=xlsx&${query}`),
    )
    const detail = (await (
      await getBoq(boq.id, fixture.owner)
    ).json()) as BoqResponse & { items: BoqLineView[] }
    const arranged = arrangeLines(
      detail.items,
      boqViewQuerySchema.parse({ sort: 'unitPrice:desc' }),
    )

    const expected = [
      'Product red-sheet',
      'Product green-sheet',
      'Product plain-sheet',
    ]
    expect(
      csv
        .split('\n')
        .slice(1, 4)
        .map((row) => row.split(',')[0]),
    ).toEqual(expected)
    expect(columnA(sheet, 8).slice(0, 3)).toEqual(expected)
    expect(arranged[0]?.lines.map((row) => row.name)).toEqual(expected)
  })

  it('groups by the frozen colour option', async () => {
    const fixture = await viewFixture()
    const productId = await createdId(
      await app.request(
        '/admin/products',
        jsonRequest(
          {
            supplierId: await createdId(
              await app.request(
                '/admin/suppliers',
                jsonRequest(
                  { name: 'Tint Co', slug: 'tint-co' },
                  fixture.admin,
                ),
              ),
              'supplier create',
            ),
            categoryId: await createdId(
              await app.request(
                '/admin/categories',
                jsonRequest({ name: 'Tints', slug: 'tints' }, fixture.admin),
              ),
              'category create',
            ),
            name: 'Tinted sheet',
            slug: 'tinted-sheet',
          },
          fixture.admin,
        ),
      ),
      'product create',
    )
    const coloured = await app.request(`/admin/products/${productId}/options`, {
      ...write('PUT', fixture.admin),
      body: JSON.stringify({
        options: [
          {
            name: 'Colour',
            type: 'color',
            values: [{ value: 'Green', hex: '#2e5e3a' }],
          },
        ],
      }),
    })
    expect(coloured.status).toBe(200)
    const valueId = (
      (await coloured.json()) as {
        options: { values: { id: string }[] }[]
      }
    ).options[0]?.values[0]?.id
    const varied = await app.request(`/admin/products/${productId}/variants`, {
      ...write('PUT', fixture.admin),
      body: JSON.stringify({
        variants: [{ sku: 'GRN', price: 20.5, optionValueIds: [valueId] }],
      }),
    })
    expect(varied.status).toBe(200)
    const published = await app.request(
      `/admin/products/${productId}/publish`,
      write('POST', fixture.admin),
    )
    expect(published.status).toBe(200)
    const variantId = ((await varied.json()) as { variants: { id: string }[] })
      .variants[0]?.id as string
    await putItem(fixture.projectId, variantId, fixture.owner, 2)
    const boq = await generated(fixture)

    const csv = await (
      await exportWith(
        boq.id,
        fixture.owner,
        'format=csv&groupBy=color&columns=name&sort=name:asc',
      )
    ).text()

    expect(csv.split('\n').slice(0, 5)).toEqual([
      'group,name,lineTotal',
      'Green,Tinted sheet (Green),41.00',
      'No colour,Product green-sheet,41.00',
      'No colour,Product plain-sheet,5.00',
      'No colour,Product red-sheet,30.00',
    ])
  })
})
