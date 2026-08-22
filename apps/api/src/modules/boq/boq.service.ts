import { asc, desc, eq } from 'drizzle-orm'
import ExcelJS from 'exceljs'

import { db } from '../../db'
import { isUniqueViolation } from '../../db/errors'
import { AppError } from '../../lib/errors'
import { PRODUCT_STATUSES } from '../catalogue/catalogue.service'
import {
  findOwned as findOwnedProject,
  listItems,
  type Project,
  type ProjectItem,
} from '../projects/projects.service'
import { getSettings } from '../settings/settings.service'
import { EXPORT_FORMATS, type ExportFormat } from './boq.schemas'
import { boqItems, boqs } from './boq.tables'

export type Boq = typeof boqs.$inferSelect
export type BoqItem = typeof boqItems.$inferSelect
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

const lineTotalCents = (item: BoqItem): number =>
  Math.round(item.unitPrice * 100) * item.quantity

const totalOf = (items: BoqItem[]): number =>
  items.reduce((sum, item) => sum + lineTotalCents(item), 0) / 100

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

const loadItems = async (boqId: string): Promise<BoqItem[]> =>
  db
    .select()
    .from(boqItems)
    .where(eq(boqItems.boqId, boqId))
    .orderBy(asc(boqItems.sortOrder))

export const generate = async (
  projectId: string,
  ownerId: string,
): Promise<BoqDetail> => {
  const frozen = freezeItems(await listItems(projectId, ownerId))

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

        return { ...boq, items, total: totalOf(items) }
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
): Promise<Boq[]> => {
  await requireOwnedProject(projectId, ownerId)

  return db
    .select()
    .from(boqs)
    .where(eq(boqs.projectId, projectId))
    .orderBy(desc(boqs.revision))
}

export const getOwned = async (
  id: string,
  ownerId: string,
): Promise<BoqDetail | null> => {
  const found = await findOwnedBoq(id, ownerId)
  if (!found) return null

  const items = await loadItems(id)

  return { ...found.boq, items, total: totalOf(items) }
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

const buildCsv = (items: BoqItem[]): ArrayBuffer => {
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
  items: BoqItem[],
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
