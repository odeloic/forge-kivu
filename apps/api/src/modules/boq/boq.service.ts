import { asc, desc, eq, inArray, sql } from 'drizzle-orm'
import ExcelJS from 'exceljs'

import {
  arrangeLines,
  calculateLineTotal,
  type BoqLineGroup,
  type BoqOption,
  sumLineTotals,
} from '@forge-kivu/types'

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
import {
  type BoqColumn,
  type BoqViewQuery,
  EXPORT_FORMATS,
  type ExportQuery,
} from './boq.schemas'
import { boqItems, boqs } from './boq.tables'

export type Boq = typeof boqs.$inferSelect
export type BoqItemRow = typeof boqItems.$inferSelect
export type BoqCurrent = { status: ProductStatus; imageUrl: string | null }
export type BoqItem = BoqItemRow & { current: BoqCurrent | null }
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
  unit: string
  spaceId: string | null
  spaceName: string | null
  supplierName: string
  categoryName: string
  categoryRootName: string
  options: BoqOption[]
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

type ComparableLine = Line & {
  variantId: string | null
  spaceId: string | null
}

const lineCents = sql`round(round(${boqItems.unitPrice} * 100) * ${boqItems.quantity})`

const lineKey = (line: {
  variantId: string | null
  spaceId: string | null
  quantity: number
  unitPrice: number | null
}): string =>
  `${line.variantId ?? ''}:${line.spaceId ?? ''}:${line.quantity}:${
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
      unit: item.unit.symbol,
      spaceId: item.space?.id ?? null,
      spaceName: item.space?.name ?? null,
      supplierName: item.supplier.name,
      categoryName: item.category.name,
      categoryRootName: item.categoryRoot.name,
      options: item.options,
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
  currents: Map<string, BoqCurrent>,
): BoqItem[] =>
  rows.map((row) => ({
    ...row,
    current:
      row.variantId === null ? null : (currents.get(row.variantId) ?? null),
  }))

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
  const currents = new Map<string, BoqCurrent>(
    source.map((item) => [
      item.variantId,
      { status: item.product.status, imageUrl: item.imageUrl },
    ]),
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
          items: withCurrent(items, currents),
          total: sumLineTotals(items),
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
        spaceId: boqItems.spaceId,
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
        spaceId: row.spaceId,
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
          spaceId: item.space?.id ?? null,
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
        total: sumLineTotals(entry.lines),
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

  const currents = new Map<string, BoqCurrent>(
    [...refs].map(([variantId, ref]) => [
      variantId,
      { status: ref.product.status, imageUrl: ref.imageUrl },
    ]),
  )

  return {
    ...found.boq,
    items: withCurrent(rows, currents),
    total: sumLineTotals(rows),
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

const optionsText = (options: BoqOption[]): string =>
  options.map((option) => `${option.name}: ${option.value}`).join('; ')

const COLUMN_LABELS: Record<BoqColumn, string> = {
  name: 'Name',
  sku: 'SKU',
  supplier: 'Supplier',
  category: 'Category',
  space: 'Space',
  unit: 'Unit',
  options: 'Options',
  unitPrice: 'Unit price',
  quantity: 'Quantity',
  lineTotal: 'Line total',
}

const csvCell = (
  item: BoqItemRow,
  column: BoqColumn,
): string | number | null => {
  switch (column) {
    case 'name':
      return item.name
    case 'sku':
      return item.sku
    case 'supplier':
      return item.supplierName
    case 'category':
      return item.categoryName
    case 'space':
      return item.spaceName
    case 'unit':
      return item.unit
    case 'options':
      return optionsText(item.options)
    case 'unitPrice':
      return item.unitPrice.toFixed(2)
    case 'quantity':
      return item.quantity
    case 'lineTotal':
      return calculateLineTotal(item.unitPrice, item.quantity).toFixed(2)
  }
}

const xlsxCell = (item: BoqItemRow, column: BoqColumn): string | number => {
  switch (column) {
    case 'sku':
      return item.sku ?? ''
    case 'space':
      return item.spaceName ?? ''
    case 'unitPrice':
      return item.unitPrice
    case 'quantity':
      return item.quantity
    case 'lineTotal':
      return calculateLineTotal(item.unitPrice, item.quantity)
    default:
      return csvCell(item, column) ?? ''
  }
}

const buildCsv = (items: BoqItemRow[], view: BoqViewQuery): ArrayBuffer => {
  const groups = arrangeLines(items, view)
  const header = [...(view.groupBy ? ['group'] : []), ...view.columns]
  const lines = [
    header.join(','),
    ...groups.flatMap((group) =>
      group.lines.map((item) =>
        [
          ...(view.groupBy ? [group.label] : []),
          ...view.columns.map((column) => csvCell(item, column)),
        ]
          .map(csvValue)
          .join(','),
      ),
    ),
  ]
  return toArrayBuffer(new TextEncoder().encode(`${lines.join('\n')}\n`))
}

const amountRow = (
  label: string,
  amount: number,
  columns: BoqColumn[],
): (string | number)[] => [label, ...columns.slice(1, -1).map(() => ''), amount]

const buildXlsx = async (
  project: Project,
  boq: Boq,
  items: BoqItemRow[],
  currency: string,
  view: BoqViewQuery,
): Promise<ArrayBuffer> => {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(`BOQ r${boq.revision}`)
  const groups: BoqLineGroup<BoqItemRow>[] = arrangeLines(items, view)

  sheet.addRow(['Project', project.name])
  sheet.addRow(['Client', project.clientName ?? ''])
  sheet.addRow(['Revision', boq.revision])
  sheet.addRow(['Date', boq.createdAt.toISOString().slice(0, 10)])
  sheet.addRow(['Currency', currency])
  sheet.addRow([])
  sheet.addRow(view.columns.map((column) => COLUMN_LABELS[column]))
  for (const group of groups) {
    if (view.groupBy) {
      sheet.addRow([group.label]).font = { bold: true }
    }
    for (const item of group.lines) {
      sheet.addRow(view.columns.map((column) => xlsxCell(item, column)))
    }
    if (view.groupBy) {
      sheet.addRow(amountRow('Subtotal', group.subtotal, view.columns))
    }
  }
  sheet.addRow(amountRow('Total', sumLineTotals(items), view.columns))

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
  { format, ...view }: ExportQuery,
): Promise<ExportFile> => {
  const found = await findOwnedBoq(id, ownerId)
  if (!found) throw new AppError('NOT_FOUND')

  const items = await loadItems(id)
  const buffer =
    format === EXPORT_FORMATS.CSV
      ? buildCsv(items, view)
      : await buildXlsx(
          found.project,
          found.boq,
          items,
          (await getSettings()).currency,
          view,
        )

  const base = slugify(found.project.name) || 'project'

  return {
    buffer,
    filename: `${base}-boq-r${found.boq.revision}.${format}`,
    contentType: CONTENT_TYPES[format],
  }
}
