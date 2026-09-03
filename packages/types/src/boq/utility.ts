import { ATTRIBUTE_VALUE_TYPES } from '../taxonomy'
import { calculateLineTotalCents, sumLineTotals } from '../money'
import {
  type BoqGroup,
  type BoqLineView,
  type BoqSort,
  type BoqSortField,
  type BoqViewQuery,
} from '../boq'

export type BoqLineGroup<T extends BoqLineView> = {
  key: string
  label: string
  lines: T[]
  subtotal: number
}

export const serialiseBoqView = (
  view: Partial<BoqViewQuery>,
): Record<string, string> => {
  const params: Record<string, string> = {}
  if (view.view) params.view = view.view
  if (view.columns) params.columns = view.columns.join(',')
  if (view.groupBy) params.groupBy = view.groupBy
  if (view.sort) params.sort = `${view.sort.field}:${view.sort.direction}`
  return params
}

export const colorOption = (line: BoqLineView) =>
  line.options.find((option) => option.type === ATTRIBUTE_VALUE_TYPES.COLOR) ??
  null

export const groupKey = (line: BoqLineView, groupBy: BoqGroup): string => {
  switch (groupBy) {
    case 'space':
      return line.spaceName ?? ''
    case 'supplier':
      return line.supplierName
    case 'category':
      return line.categoryName
    case 'color':
      return colorOption(line)?.value ?? ''
  }
}

export const groupLabel = (key: string, groupBy: BoqGroup): string => {
  if (key !== '') return key
  return groupBy === 'color' ? 'No colour' : 'Unassigned'
}

const sortValue = (line: BoqLineView, field: BoqSortField): string | number => {
  switch (field) {
    case 'sortOrder':
      return line.sortOrder
    case 'name':
      return line.name
    case 'supplier':
      return line.supplierName
    case 'category':
      return line.categoryName
    case 'space':
      return line.spaceName ?? ''
    case 'unitPrice':
      return line.unitPrice
    case 'quantity':
      return line.quantity
    case 'lineTotal':
      return calculateLineTotalCents(line.unitPrice, line.quantity)
  }
}

const compareValues = (a: string | number, b: string | number): number => {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

export const compareLines =
  (sort: BoqSort) =>
  (a: BoqLineView, b: BoqLineView): number => {
    const order = compareValues(
      sortValue(a, sort.field),
      sortValue(b, sort.field),
    )
    const directed = sort.direction === 'desc' ? -order : order
    return directed !== 0 ? directed : a.sortOrder - b.sortOrder
  }

const compareGroupKeys = (a: string, b: string): number => {
  if (a === b) return 0
  if (a === '') return 1
  if (b === '') return -1
  return a.localeCompare(b)
}

export const arrangeLines = <T extends BoqLineView>(
  lines: readonly T[],
  view: Pick<BoqViewQuery, 'groupBy' | 'sort'>,
): BoqLineGroup<T>[] => {
  const compare = compareLines(view.sort)
  const groups = new Map<string, T[]>()

  for (const line of lines) {
    const key = view.groupBy ? groupKey(line, view.groupBy) : ''
    const bucket = groups.get(key) ?? []
    bucket.push(line)
    groups.set(key, bucket)
  }

  const keys = [...groups.keys()].sort(compareGroupKeys)

  return keys.map((key) => {
    const bucket = [...(groups.get(key) ?? [])].sort(compare)
    return {
      key,
      label: view.groupBy ? groupLabel(key, view.groupBy) : '',
      lines: bucket,
      subtotal: sumLineTotals(bucket),
    }
  })
}
