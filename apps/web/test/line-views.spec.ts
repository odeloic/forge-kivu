import { describe, expect, it } from 'vitest'

import type { BoqItem, ProjectItem } from '@forge-kivu/api-client'
import {
  BOQ_COLUMNS,
  BOQ_DEFAULT_SORT,
  BOQ_DEFAULT_VIEW,
} from '@forge-kivu/types'

import { nextBoqQuery, parseBoqView } from '../app/composables/useBoqView'
import {
  isPriced,
  isUnpriced,
  isWithdrawn,
  matchesSearch,
  toLineView,
} from '../app/utils/lines'

const VARIANT = '33333333-3333-4333-8333-333333333333'
const KITCHEN = '11111111-1111-4111-8111-111111111111'

const projectItem = (overrides: Partial<ProjectItem> = {}): ProjectItem => ({
  id: 'item-1',
  variantId: VARIANT,
  quantity: 2,
  space: null,
  sku: 'CRS-25',
  price: 16800,
  unit: { id: 'u', name: 'Piece', symbol: 'pc' },
  label: '2.5 m',
  options: [],
  product: { id: 'p', name: 'Corrugated sheet', status: 'published' },
  category: { id: 'c', name: 'Metal Sheets', slug: 'metal-sheets' },
  categoryRoot: { id: 'r', name: 'Roofing', slug: 'roofing' },
  supplier: { id: 's', name: 'Kivu Roofing', slug: 'kivu-roofing' },
  imageUrl: 'https://cdn.example/sheet.jpg',
  ...overrides,
})

const boqItem = (overrides: Partial<BoqItem> = {}): BoqItem => ({
  id: 'line-1',
  boqId: 'boq-1',
  variantId: VARIANT,
  name: 'Corrugated sheet (2.5 m)',
  sku: 'CRS-25',
  unitPrice: 16800,
  quantity: 2,
  unit: 'pc',
  spaceId: KITCHEN,
  spaceName: 'Kitchen',
  supplierName: 'Kivu Roofing',
  categoryName: 'Metal Sheets',
  categoryRootName: 'Roofing',
  options: [],
  sortOrder: 4,
  current: { status: 'published', imageUrl: 'https://cdn.example/sheet.jpg' },
  ...overrides,
})

describe('toLineView of a project item', () => {
  it('keys on the variant alone without a space and zeroes an unpriced line', () => {
    const line = toLineView(projectItem({ price: null }), 3)

    expect(line.key).toBe(`${VARIANT}:`)
    expect(line.unitPrice).toBe(0)
    expect(line.price).toBeNull()
    expect(line.sortOrder).toBe(3)
    expect(line.caption).toBe('CRS-25 · 2.5 m')
    expect(line.withdrawn).toBe(false)
  })

  it('keys on variant and space when placed', () => {
    const line = toLineView(
      projectItem({ space: { id: KITCHEN, name: 'Kitchen' } }),
      0,
    )

    expect(line.key).toBe(`${VARIANT}:${KITCHEN}`)
    expect(line.spaceName).toBe('Kitchen')
  })

  it('flags a product that is no longer published', () => {
    const line = toLineView(
      projectItem({ product: { id: 'p', name: 'X', status: 'not_available' } }),
      0,
    )

    expect(line.withdrawn).toBe(true)
  })
})

describe('toLineView of a frozen line', () => {
  it('is withdrawn without an image when the variant is gone', () => {
    const line = toLineView(boqItem({ current: null, variantId: null }))

    expect(line.key).toBe('line-1')
    expect(line.withdrawn).toBe(true)
    expect(line.imageUrl).toBeNull()
    expect(line.price).toBe(16800)
    expect(line.sortOrder).toBe(4)
  })

  it('carries the live image while the variant is published', () => {
    const line = toLineView(boqItem())

    expect(line.withdrawn).toBe(false)
    expect(line.imageUrl).toBe('https://cdn.example/sheet.jpg')
  })
})

describe('show predicates', () => {
  it('counts a withdrawn priced line as priced and no longer available', () => {
    const line = toLineView(
      projectItem({ product: { id: 'p', name: 'X', status: 'draft' } }),
      0,
    )

    expect(isPriced(line)).toBe(true)
    expect(isWithdrawn(line)).toBe(true)
    expect(isUnpriced(line)).toBe(false)
  })

  it('counts an unpriced published line as unpriced only', () => {
    const line = toLineView(projectItem({ price: null }), 0)

    expect(isUnpriced(line)).toBe(true)
    expect(isPriced(line)).toBe(false)
    expect(isWithdrawn(line)).toBe(false)
  })

  it('searches the name and the caption', () => {
    const line = toLineView(projectItem(), 0)

    expect(matchesSearch(line, 'crs')).toBe(true)
    expect(matchesSearch(line, '2.5')).toBe(true)
    expect(matchesSearch(line, 'gutter')).toBe(false)
  })
})

describe('useBoqView query writer', () => {
  const base = { tab: 'boq', revision: 'x' }

  it('adds a non-default key and keeps tab and revision', () => {
    expect(nextBoqQuery(base, { groupBy: 'space' })).toEqual({
      ...base,
      groupBy: 'space',
    })
  })

  it('drops a key written back at its default', () => {
    expect(
      nextBoqQuery({ ...base, columns: 'sku' }, { columns: [...BOQ_COLUMNS] }),
    ).toEqual(base)
    expect(
      nextBoqQuery({ ...base, sort: 'name:desc' }, { sort: BOQ_DEFAULT_SORT }),
    ).toEqual(base)
    expect(nextBoqQuery({ ...base, view: 'boq' }, { view: 'gallery' })).toEqual(
      base,
    )
  })

  it('falls back to the default view on a bad key', () => {
    expect(parseBoqView({ columns: 'bogus' })).toEqual(BOQ_DEFAULT_VIEW)
    expect(parseBoqView({ view: 'nope' }).view).toBe('gallery')
  })
})
