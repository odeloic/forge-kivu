import { describe, expect, it } from 'vitest'

import { BOQ_COLUMNS, type BoqLineView, boqViewQuerySchema } from '../boq'
import {
  arrangeLines,
  compareLines,
  groupedColumn,
  groupKey,
  groupLabel,
  serialiseBoqView,
  visibleColumns,
} from './utility'

const line = (
  overrides: Partial<BoqLineView> & { name: string; sortOrder: number },
): BoqLineView => ({
  sku: null,
  supplierName: 'Kivu Roofing',
  categoryName: 'Metal Sheets',
  spaceName: null,
  unit: 'pc',
  options: [],
  unitPrice: 10,
  quantity: 1,
  ...overrides,
})

const green = line({
  name: 'Sheet green',
  sortOrder: 0,
  spaceName: 'Kitchen',
  unitPrice: 20.5,
  quantity: 2,
  options: [{ name: 'Colour', type: 'color', value: 'Green', hex: '#2e5e3a' }],
})
const plain = line({ name: 'Plain sheet', sortOrder: 1, unitPrice: 5 })
const red = line({
  name: 'Sheet red',
  sortOrder: 2,
  spaceName: 'Bath',
  unitPrice: 30,
  supplierName: 'Acme',
  options: [{ name: 'Colour', type: 'color', value: 'Red', hex: '#ff0000' }],
})

describe('serialiseBoqView', () => {
  it('serialises a parsed export view', () => {
    const parsed = boqViewQuerySchema.parse({
      columns: 'sku',
      groupBy: 'color',
      sort: 'name:asc',
    })

    expect(serialiseBoqView(parsed)).toEqual({
      view: 'gallery',
      columns: 'name,sku,lineTotal',
      groupBy: 'color',
      sort: 'name:asc',
    })
  })
})

describe('arrangeLines', () => {
  it('keeps one unlabelled group when ungrouped', () => {
    const groups = arrangeLines(
      [red, green, plain],
      boqViewQuerySchema.parse({}),
    )

    expect(groups).toHaveLength(1)
    expect(groups[0]?.label).toBe('')
    expect(groups[0]?.lines.map((row) => row.name)).toEqual([
      'Sheet green',
      'Plain sheet',
      'Sheet red',
    ])
    expect(groups[0]?.subtotal).toBe(76)
  })

  it('groups by space with unassigned last and subtotals per group', () => {
    const groups = arrangeLines(
      [red, green, plain],
      boqViewQuerySchema.parse({ groupBy: 'space' }),
    )

    expect(groups.map((group) => [group.label, group.subtotal])).toEqual([
      ['Bath', 30],
      ['Kitchen', 41],
      ['No space', 5],
    ])
  })

  it('groups by the frozen colour option and puts lines without one last', () => {
    const groups = arrangeLines(
      [plain, red, green],
      boqViewQuerySchema.parse({ groupBy: 'color' }),
    )

    expect(groups.map((group) => group.label)).toEqual([
      'Green',
      'Red',
      'No colour',
    ])
    expect(groupKey(plain, 'color')).toBe('')
  })

  it('names an empty group after the dimension it is missing', () => {
    expect(groupLabel('', 'space')).toBe('No space')
    expect(groupLabel('', 'supplier')).toBe('No supplier')
    expect(groupLabel('', 'category')).toBe('No category')
    expect(groupLabel('', 'color')).toBe('No colour')
    expect(groupLabel('Kitchen', 'space')).toBe('Kitchen')
  })

  it('sorts inside each group with the shared comparator', () => {
    const view = boqViewQuerySchema.parse({ sort: 'unitPrice:desc' })
    const sorted = [green, plain, red].sort(compareLines(view.sort))
    const arranged = arrangeLines([green, plain, red], view)

    expect(sorted.map((row) => row.name)).toEqual([
      'Sheet red',
      'Sheet green',
      'Plain sheet',
    ])
    expect(arranged[0]?.lines).toEqual(sorted)
  })
})

describe('visibleColumns', () => {
  it('folds the grouped column out of the rows', () => {
    expect(
      visibleColumns({ columns: [...BOQ_COLUMNS], groupBy: 'space' }),
    ).toEqual(BOQ_COLUMNS.filter((column) => column !== 'space'))
    expect(groupedColumn('supplier')).toBe('supplier')
  })

  it('folds nothing for colour and no grouping', () => {
    expect(
      visibleColumns({ columns: [...BOQ_COLUMNS], groupBy: 'color' }),
    ).toEqual([...BOQ_COLUMNS])
    expect(groupedColumn('color')).toBeNull()
    expect(groupedColumn(null)).toBeNull()
  })

  it('keeps the locked columns in canonical order whatever the input', () => {
    expect(
      visibleColumns({ columns: ['quantity', 'sku'], groupBy: null }),
    ).toEqual(['name', 'sku', 'quantity', 'lineTotal'])
    expect(visibleColumns({ columns: [], groupBy: 'category' })).toEqual([
      'name',
      'lineTotal',
    ])
  })
})
