import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import ExcelJS from 'exceljs'

import { db } from '../../db'
import { isUniqueViolation } from '../../db/errors'
import { AppError } from '../../lib/errors'
import {
  getVariantRefs,
  PRODUCT_STATUSES,
  type ProductStatus,
} from '../catalogue/catalogue.service'
import {
  findOwned as findOwnedProject,
  listItems,
  listItemsForProjects,
  type Project,
  type ProjectItem,
} from '../projects/projects.service'
import { getSettings } from '../settings/settings.service'
import { EXPORT_FORMATS, type ExportFormat } from './boq.schemas'
import { boqItems, boqs } from './boq.tables'

export type Boq = typeof boqs.$inferSelect
export type BoqItemRow = typeof boqItems.$inferSelect
export type BoqItem = BoqItemRow & { current: { status: ProductStatus } | null }
export type BoqSummary = Boq & { lineCount: number; total: number }
export type BoqProjectSummary = BoqSummary & { stale: boolean }
export type BoqDetail = Boq & { items: BoqItem[]; total: number }

export type ExportFile = {
  buffer: ArrayBuffer
  filename: string
  contentType: string
}

type FrozenItem = {
  variantId: string
  name: string
  sku: string | null
  unitPrice: number
  quantity: number
  sortOrder: number
}

const GENERATE_ATTEMPTS = 5

const CONTENT_TYPES = {
  [EXPORT_FORMATS.CSV]: 'text/csv; charset=utf-8',
  [EXPORT_FORMATS.XLSX]:
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const

const itemName = (item: ProjectItem): string =>
  item.label ? `${item.product.name} (${item.label})` : item.product.name

type Line = { unitPrice: number; quantity: number }

type ComparableLine = Line & { variantId: string | null }

const lineTotalCents = (line: Line): number =>
  Math.round(line.unitPrice * 100) * line.quantity

const totalOf = (lines: Line[]): number =>
  lines.reduce((sum, line) => sum + lineTotalCents(line), 0) / 100

const lineCents = sql`round(${boqItems.unitPrice} * 100) * ${boqItems.quantity}`

const lineKey = (line: {
  variantId: string | null
  quantity: number
  unitPrice: number | null
}): string =>
  `${line.variantId ?? ''}:${line.quantity}:${
    line.unitPrice === null ? '' : Math.round(line.unitPrice * 100)
  }`

const sameLines = (frozen: string[], current: string[]): boolean => {
  if (frozen.length !== current.length) return false
  const left = [...frozen].sort()
  const right = [...current].sort()
  return left.every((key, index) => key === right[index])
}

const freezeItems = (items: ProjectItem[]): FrozenItem[] => {
  if (items.length === 0) throw new AppError('BOQ_NOT_GENERATABLE')

  return items.map((item, index) => {
    if (
      item.product.status !== PRODUCT_STATUSES.PUBLISHED ||
      item.price === null
    ) {
      throw new AppError('BOQ_NOT_GENERATABLE')
    }
    return {
      variantId: item.variantId,
      name: itemName(item),
      sku: item.sku,
      unitPrice: item.price,
      quantity: item.quantity,
      sortOrder: index,
    }
  })
}

const requireOwnedProject = async (
  projectId: string,
  ownerId: string,
): Promise<Project> => {
  const project = await findOwnedProject(projectId, ownerId)
  if (!project) throw new AppError('NOT_FOUND')
  return project
}

const findOwnedBoq = async (
  id: string,
  ownerId: string,
): Promise<{ boq: Boq; project: Project } | null> => {
  const [boq] = await db.select().from(boqs).where(eq(boqs.id, id)).limit(1)
  if (!boq) return null

  const project = await findOwnedProject(boq.projectId, ownerId)
  if (!project) return null

  return { boq, project }
}

const withCurrent = (
  rows: BoqItemRow[],
  statuses: Map<string, ProductStatus>,
): BoqItem[] =>
  rows.map((row) => {
    const status =
      row.variantId === null ? undefined : statuses.get(row.variantId)
    return { ...row, current: status ? { status } : null }
  })

const loadItems = async (boqId: string): Promise<BoqItemRow[]> =>
  db
    .select()
    .from(boqItems)
    .where(eq(boqItems.boqId, boqId))
    .orderBy(asc(boqItems.sortOrder))

export const generate = async (
  projectId: string,
  ownerId: string,
): Promise<BoqDetail> => {
  const source = await listItems(projectId, ownerId)
  const frozen = freezeItems(source)
  const statuses = new Map(
    source.map((item) => [item.variantId, item.product.status]),
  )

  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        const [latest] = await tx
          .select({ revision: boqs.revision })
          .from(boqs)
          .where(eq(boqs.projectId, projectId))
          .orderBy(desc(boqs.revision))
          .limit(1)

        const [boq] = await tx
          .insert(boqs)
          .values({ projectId, revision: (latest?.revision ?? 0) + 1 })
          .returning()

        if (!boq) throw new Error('generate failed: insert returned no row')

        const items = await tx
          .insert(boqItems)
          .values(frozen.map((item) => ({ boqId: boq.id, ...item })))
          .returning()

        return {
          ...boq,
          items: withCurrent(items, statuses),
          total: totalOf(items),
        }
      })
    } catch (error) {
      if (attempt >= GENERATE_ATTEMPTS || !isUniqueViolation(error)) {
        throw error
      }
    }
  }
}

export const listForProject = async (
  projectId: string,
  ownerId: string,
): Promise<BoqSummary[]> => {
  await requireOwnedProject(projectId, ownerId)

  const rows = await db
    .select({
      id: boqs.id,
      projectId: boqs.projectId,
      revision: boqs.revision,
      createdAt: boqs.createdAt,
      lineCount: sql<number>`count(${boqItems.id})`.mapWith(Number),
      totalCents: sql<number>`coalesce(sum(${lineCents}), 0)`.mapWith(Number),
    })
    .from(boqs)
    .leftJoin(boqItems, eq(boqItems.boqId, boqs.id))
    .where(eq(boqs.projectId, projectId))
    .groupBy(boqs.id)
    .orderBy(desc(boqs.revision))

  return rows.map(({ totalCents, ...row }) => ({
    ...row,
    total: totalCents / 100,
  }))
}

export const boqSummaries = async (
  projectIds: string[],
): Promise<Map<string, BoqProjectSummary>> => {
  if (projectIds.length === 0) return new Map()

  const latest = db.$with('latest_boqs').as(
    db
      .selectDistinctOn([boqs.projectId], {
        id: boqs.id,
        projectId: boqs.projectId,
        revision: boqs.revision,
        createdAt: boqs.createdAt,
      })
      .from(boqs)
      .where(inArray(boqs.projectId, projectIds))
      .orderBy(boqs.projectId, desc(boqs.revision)),
  )

  const [frozenRows, currentItems] = await Promise.all([
    db
      .with(latest)
      .select({
        id: latest.id,
        projectId: latest.projectId,
        revision: latest.revision,
        createdAt: latest.createdAt,
        variantId: boqItems.variantId,
        unitPrice: boqItems.unitPrice,
        quantity: boqItems.quantity,
      })
      .from(latest)
      .leftJoin(boqItems, eq(boqItems.boqId, latest.id)),
    listItemsForProjects(projectIds),
  ])

  const frozen = new Map<string, { boq: Boq; lines: ComparableLine[] }>()
  for (const row of frozenRows) {
    const entry = frozen.get(row.projectId) ?? {
      boq: {
        id: row.id,
        projectId: row.projectId,
        revision: row.revision,
        createdAt: row.createdAt,
      },
      lines: [],
    }
    if (row.unitPrice !== null && row.quantity !== null) {
      entry.lines.push({
        variantId: row.variantId,
        unitPrice: row.unitPrice,
        quantity: row.quantity,
      })
    }
    frozen.set(row.projectId, entry)
  }

  const current = new Map<string, string[]>()
  for (const [projectId, items] of currentItems) {
    current.set(
      projectId,
      items.map((item) =>
        lineKey({
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: item.price,
        }),
      ),
    )
  }

  return new Map(
    [...frozen].map(([projectId, entry]) => [
      projectId,
      {
        ...entry.boq,
        lineCount: entry.lines.length,
        total: totalOf(entry.lines),
        stale: !sameLines(
          entry.lines.map(lineKey),
          current.get(projectId) ?? [],
        ),
      },
    ]),
  )
}

export const getOwned = async (
  id: string,
  ownerId: string,
): Promise<BoqDetail | null> => {
  const found = await findOwnedBoq(id, ownerId)
  if (!found) return null

  const rows = await loadItems(id)
  const refs = await getVariantRefs(
    rows.flatMap((row) => (row.variantId === null ? [] : [row.variantId])),
  )

  const statuses = new Map(
    [...refs].map(([variantId, ref]) => [variantId, ref.product.status]),
  )

  return {
    ...found.boq,
    items: withCurrent(rows, statuses),
    total: totalOf(rows),
  }
}

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

const csvValue = (value: string | number | null): string => {
  if (value === null) return ''
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

const buildCsv = (items: BoqItemRow[]): ArrayBuffer => {
  const lines = [
    'name,sku,unitPrice,quantity',
    ...items.map((item) =>
      [item.name, item.sku, item.unitPrice.toFixed(2), item.quantity]
        .map(csvValue)
        .join(','),
    ),
  ]
  return toArrayBuffer(new TextEncoder().encode(`${lines.join('\n')}\n`))
}

const buildXlsx = async (
  project: Project,
  boq: Boq,
  items: BoqItemRow[],
  currency: string,
): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`BOQ r${boq.revision}`)

  sheet.addRow(['Project', project.name])
  sheet.addRow(['Client', project.clientName ?? ''])
  sheet.addRow(['Revision', boq.revision])
  sheet.addRow(['Date', boq.createdAt.toISOString().slice(0, 10)])
  sheet.addRow(['Currency', currency])
  sheet.addRow([])
  sheet.addRow(['Name', 'SKU', 'Unit price', 'Quantity', 'Line total'])
  for (const item of items) {
    sheet.addRow([
      item.name,
      item.sku ?? '',
      item.unitPrice,
      item.quantity,
      lineTotalCents(item) / 100,
    ])
  }
  sheet.addRow(['Total', '', '', '', totalOf(items)])

  return toArrayBuffer(new Uint8Array(await workbook.xlsx.writeBuffer()))
}

const slugify = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const buildExport = async (
  id: string,
  ownerId: string,
  format: ExportFormat,
): Promise<ExportFile> => {
  const found = await findOwnedBoq(id, ownerId)
  if (!found) throw new AppError('NOT_FOUND')

  const items = await loadItems(id)
  const buffer =
    format === EXPORT_FORMATS.CSV
      ? buildCsv(items)
      : await buildXlsx(
          found.project,
          found.boq,
          items,
          (await getSettings()).currency,
        )

  const base = slugify(found.project.name) || 'project'

  return {
    buffer,
    filename: `${base}-boq-r${found.boq.revision}.${format}`,
    contentType: CONTENT_TYPES[format],
  }
}
