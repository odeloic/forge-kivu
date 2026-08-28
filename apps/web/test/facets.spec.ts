import { describe, expect, it } from 'vitest'

import {
  type AttributeFacet,
  attributeTitle,
  splitAttributes,
} from '../app/utils/facets'

const attribute = (
  slug: string,
  values: [string, number][],
  unit: string | null = null,
): AttributeFacet => ({
  slug,
  name: slug[0]!.toUpperCase() + slug.slice(1),
  unit,
  values: values.map(([value, count]) => ({ value, count })),
})

describe('attributeTitle', () => {
  it('appends the unit when the attribute carries one', () => {
    expect(attributeTitle(attribute('warranty', [], 'months'))).toBe(
      'Warranty (months)',
    )
  })

  it('leaves an unitless attribute alone', () => {
    expect(attributeTitle(attribute('material', []))).toBe('Material')
  })
})

describe('splitAttributes', () => {
  it('surfaces only attributes with a value on more than one product', () => {
    const { surfaced, rest } = splitAttributes(
      [
        attribute('material', [['Wood', 1]]),
        attribute('warranty', [
          ['12', 6],
          ['24', 3],
        ]),
      ],
      [],
    )

    expect(surfaced.map((row) => row.slug)).toEqual(['warranty'])
    expect(rest.map((row) => row.slug)).toEqual(['material'])
  })

  it('ranks by the largest value count, then by coverage', () => {
    const { surfaced } = splitAttributes(
      [
        attribute('depth', [
          ['900', 2],
          ['380', 1],
        ]),
        attribute('warranty', [
          ['12', 6],
          ['24', 3],
        ]),
        attribute('voltage', [
          ['220', 3],
          ['450', 1],
        ]),
      ],
      [],
    )

    expect(surfaced.map((row) => row.slug)).toEqual([
      'depth',
      'warranty',
      'voltage',
    ])
  })

  it('caps the surfaced set', () => {
    const many = Array.from({ length: 7 }, (_, index) =>
      attribute(`attr-${index}`, [['shared', 2 + index]]),
    )

    const { surfaced, rest } = splitAttributes(many, [])

    expect(surfaced).toHaveLength(4)
    expect(rest).toHaveLength(3)
  })

  it('keeps a filtered attribute surfaced even when its values are unique', () => {
    const { surfaced, rest } = splitAttributes(
      [
        attribute('finish', [['Matt', 1]]),
        attribute('warranty', [['12', 4]]),
      ],
      ['finish'],
    )

    expect(surfaced.map((row) => row.slug)).toEqual(['finish', 'warranty'])
    expect(rest).toEqual([])
  })

  it('preserves the endpoint ordering within each group', () => {
    const { surfaced } = splitAttributes(
      [
        attribute('alpha', [['x', 2]]),
        attribute('beta', [['y', 5]]),
      ],
      [],
    )

    expect(surfaced.map((row) => row.slug)).toEqual(['alpha', 'beta'])
  })
})
