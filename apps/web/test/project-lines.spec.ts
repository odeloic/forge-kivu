import { describe, expect, it } from 'vitest'

import { diffLines, lineKey, type ProjectLine } from '../app/utils/projects'

const KITCHEN = '11111111-1111-4111-8111-111111111111'
const LIVING = '22222222-2222-4222-8222-222222222222'
const SHEET = '33333333-3333-4333-8333-333333333333'

const line = (
  spaceId: string | null,
  quantity: number,
  variantId = SHEET,
): ProjectLine => ({
  variantId,
  spaceId,
  spaceName:
    spaceId === KITCHEN ? 'Kitchen' : spaceId === LIVING ? 'Living room' : null,
  name: 'Corrugated roofing sheet',
  sku: 'CRS-25',
  label: '2.5 m',
  price: 16800,
  quantity,
})

describe('lineKey', () => {
  it('keys on variant and space', () => {
    expect(lineKey(line(KITCHEN, 2))).toBe(`${SHEET}:${KITCHEN}`)
  })

  it('counts no space as an empty segment', () => {
    expect(lineKey(line(null, 5))).toBe(`${SHEET}:`)
  })

  it('separates the same variant in two spaces', () => {
    expect(lineKey(line(KITCHEN, 2))).not.toBe(lineKey(line(null, 5)))
  })
})

describe('diffLines', () => {
  const saved = [line(KITCHEN, 2), line(null, 5)]

  it('sends nothing when nothing changed', () => {
    const current = saved.map((entry) => ({ ...entry }))

    expect(diffLines(saved, current)).toEqual({ removed: [], upserts: [] })
  })

  it('upserts only the line whose quantity changed', () => {
    const current = [line(KITCHEN, 3), line(null, 5)]

    const { removed, upserts } = diffLines(saved, current)

    expect(removed).toEqual([])
    expect(upserts).toEqual([line(KITCHEN, 3)])
  })

  it('removes the dropped line and keeps the other', () => {
    const current = [line(null, 5)]

    const { removed, upserts } = diffLines(saved, current)

    expect(removed).toEqual([line(KITCHEN, 2)])
    expect(upserts).toEqual([])
  })

  it('turns a move into a remove and an upsert', () => {
    const current = [line(KITCHEN, 2), line(LIVING, 5)]

    const { removed, upserts } = diffLines(saved, current)

    expect(removed).toEqual([line(null, 5)])
    expect(upserts).toEqual([line(LIVING, 5)])
  })

  it('upserts a line whose key is new', () => {
    const current = [...saved, line(LIVING, 1)]

    const { removed, upserts } = diffLines(saved, current)

    expect(removed).toEqual([])
    expect(upserts).toEqual([line(LIVING, 1)])
  })
})
