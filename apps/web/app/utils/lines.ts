import type { BoqItem, ProjectItem } from '@forge-kivu/api-client'
import {
  type BoqColumn,
  type BoqGroup,
  type BoqLineView,
  type BoqOption,
  type BoqSortField,
  calculateLineTotal,
  groupLabel,
  PRODUCT_STATUSES,
  PROJECT_LIMITS,
} from '@forge-kivu/types'

export type LineView = BoqLineView & {
  key: string
  variantId: string | null
  spaceId: string | null
  caption: string | null
  categoryRootName: string
  price: number | null
  imageUrl: string | null
  withdrawn: boolean
}

export const LINE_SHOW = {
  ALL: 'all',
  PRICED: 'priced',
  UNPRICED: 'unpriced',
  WITHDRAWN: 'withdrawn',
} as const

export type LineShow = (typeof LINE_SHOW)[keyof typeof LINE_SHOW]

export const LINE_SHOW_VALUES = [
  LINE_SHOW.ALL,
  LINE_SHOW.PRICED,
  LINE_SHOW.UNPRICED,
  LINE_SHOW.WITHDRAWN,
] as const

export const isPriced = (line: LineView): boolean => line.price !== null

export const isUnpriced = (line: LineView): boolean => line.price === null

export const isWithdrawn = (line: LineView): boolean => line.withdrawn

export const showPredicate = (
  show: LineShow,
): ((line: LineView) => boolean) => {
  switch (show) {
    case LINE_SHOW.ALL:
      return () => true
    case LINE_SHOW.PRICED:
      return isPriced
    case LINE_SHOW.UNPRICED:
      return isUnpriced
    case LINE_SHOW.WITHDRAWN:
      return isWithdrawn
  }
}

export const workingLineKey = (
  variantId: string,
  spaceId: string | null,
): string => `${variantId}:${spaceId ?? ''}`

export function toLineView(item: ProjectItem, index: number): LineView
export function toLineView(item: BoqItem): LineView
export function toLineView(item: ProjectItem | BoqItem, index = 0): LineView {
  if ('product' in item) return fromProjectItem(item, index)
  return fromBoqItem(item)
}

const fromProjectItem = (item: ProjectItem, index: number): LineView => ({
  key: workingLineKey(item.variantId, item.space?.id ?? null),
  variantId: item.variantId,
  spaceId: item.space?.id ?? null,
  name: item.product.name,
  caption: [item.sku, item.label].filter(Boolean).join(' · ') || null,
  sku: item.sku,
  supplierName: item.supplier.name,
  categoryName: item.category.name,
  categoryRootName: item.categoryRoot.name,
  spaceName: item.space?.name ?? null,
  unit: item.unit.symbol,
  options: item.options as BoqOption[],
  unitPrice: item.price ?? 0,
  price: item.price,
  quantity: item.quantity,
  sortOrder: index,
  imageUrl: item.imageUrl,
  withdrawn: item.product.status !== PRODUCT_STATUSES.PUBLISHED,
})

const fromBoqItem = (item: BoqItem): LineView => ({
  key: item.id,
  variantId: item.variantId,
  spaceId: item.spaceId,
  name: item.name,
  caption: item.sku,
  sku: item.sku,
  supplierName: item.supplierName,
  categoryName: item.categoryName,
  categoryRootName: item.categoryRootName,
  spaceName: item.spaceName,
  unit: item.unit,
  options: item.options,
  unitPrice: item.unitPrice,
  price: item.unitPrice,
  quantity: item.quantity,
  sortOrder: item.sortOrder,
  imageUrl: item.current?.imageUrl ?? null,
  withdrawn:
    item.current === null || item.current.status !== PRODUCT_STATUSES.PUBLISHED,
})

export const matchesSearch = (line: LineView, term: string): boolean => {
  const needle = term.trim().toLowerCase()
  if (!needle) return true
  return [line.name, line.caption]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(needle))
}

export const PIECE_SYMBOL = 'pc'

export const BOQ_COLUMN_LABELS: Record<BoqColumn, string> = {
  name: 'Product · variant',
  sku: 'SKU',
  supplier: 'Supplier',
  category: 'Category',
  space: 'Space',
  unit: 'Unit',
  options: 'Options',
  unitPrice: 'Unit price',
  quantity: 'Qty',
  lineTotal: 'Line total',
}

export const BOQ_GROUP_LABELS: Record<BoqGroup, string> = {
  space: 'Space',
  supplier: 'Supplier',
  category: 'Category',
  color: 'Colour',
}

export const SORTABLE_COLUMNS: Partial<Record<BoqColumn, BoqSortField>> = {
  name: 'name',
  supplier: 'supplier',
  category: 'category',
  space: 'space',
  unitPrice: 'unitPrice',
  quantity: 'quantity',
  lineTotal: 'lineTotal',
}

export const unitSuffix = (unit: string): string =>
  unit === PIECE_SYMBOL || unit === '' ? '' : ` / ${unit}`

export const spaceLabelOf = (line: Pick<LineView, 'spaceName'>): string =>
  line.spaceName ?? groupLabel('', 'space')

export const lineTotalOf = (line: LineView): number =>
  line.price === null ? 0 : calculateLineTotal(line.price, line.quantity)

export const lineName = (line: LineView): string =>
  line.caption ? `${line.name} (${line.caption})` : line.name

export const quantityValid = (value: string): boolean => {
  const parsed = Number(value)
  return (
    value.trim() !== '' &&
    Number.isFinite(parsed) &&
    parsed >= 0.01 &&
    parsed <= PROJECT_LIMITS.quantity &&
    Math.round(parsed * 100) === parsed * 100
  )
}
