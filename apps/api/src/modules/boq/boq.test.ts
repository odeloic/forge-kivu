import { eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'
import { beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import {
  jsonRequest,
  loginAs,
  loginAsAdmin,
  resetDatabase,
} from '../../test/helpers'
import { ROLES } from '@forge-kivu/types'
import { productVariants } from '../catalogue/catalogue.tables'
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
  }[]
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
