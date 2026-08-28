import type { ProductOption, ProductVariant } from '@forge-kivu/api-client'
import { describe, expect, it } from 'vitest'

import {
  matchVariant,
  priceRangeOf,
  prunedSelection,
  selectionOf,
} from '../app/utils/variants'

const option = (
  id: string,
  name: string,
  values: string[],
): ProductOption => ({
  id,
  name,
  sortOrder: 0,
  values: values.map((value, index) => ({
    id: `${id}-${value}`,
    value,
    sortOrder: index,
  })),
})

const variant = (
  id: string,
  optionValueIds: string[],
  price: number | null = null,
): ProductVariant => ({
  id,
  sku: id.toUpperCase(),
  price,
  sortOrder: 0,
  imageMediaId: null,
  imageUrl: null,
  optionValueIds,
})

const colour = option('colour', 'Colour', ['Charcoal', 'Beige'])
const size = option('size', 'Size', ['Small', 'Large'])

describe('selectionOf', () => {
  it('reads one value per option out of the given variant', () => {
    const chosen = variant('a', ['colour-Beige', 'size-Large'])

    expect(selectionOf([colour, size], chosen)).toEqual({
      colour: 'colour-Beige',
      size: 'size-Large',
    })
  })

  it('falls back to the first value of any option the variant misses', () => {
    const chosen = variant('a', ['colour-Beige'])

    expect(selectionOf([colour, size], chosen)).toEqual({
      colour: 'colour-Beige',
      size: 'size-Small',
    })
  })

  it('is empty for a product with no options', () => {
    expect(selectionOf([], variant('a', []))).toEqual({})
  })
})

describe('prunedSelection', () => {
  it('drops overrides for options this product does not carry', () => {
    expect(
      prunedSelection([colour], {
        colour: 'colour-Beige',
        finish: 'finish-Oak',
      }),
    ).toEqual({ colour: 'colour-Beige' })
  })

  it('drops an override whose value no longer exists on the option', () => {
    expect(prunedSelection([colour], { colour: 'colour-Green' })).toEqual({})
  })
})

describe('matchVariant', () => {
  const variants = [
    variant('a', ['colour-Charcoal', 'size-Small'], 100),
    variant('b', ['colour-Beige', 'size-Large'], 140),
  ]

  it('matches regardless of the order the ids come in', () => {
    expect(
      matchVariant(variants, { size: 'size-Large', colour: 'colour-Beige' })
        ?.id,
    ).toBe('b')
  })

  it('returns nothing for a combination no variant covers', () => {
    expect(
      matchVariant(variants, {
        colour: 'colour-Charcoal',
        size: 'size-Large',
      }),
    ).toBeUndefined()
  })

  it('matches the lone variant of an optionless product', () => {
    expect(matchVariant([variant('only', [])], {})?.id).toBe('only')
  })
})

describe('priceRangeOf', () => {
  it('spans the priced variants', () => {
    expect(
      priceRangeOf([
        variant('a', [], 100),
        variant('b', [], 140),
        variant('c', [], 120),
      ]),
    ).toEqual({ min: 100, max: 140 })
  })

  it('ignores variants with no price', () => {
    expect(priceRangeOf([variant('a', [], null), variant('b', [], 80)])).toEqual(
      { min: 80, max: 80 },
    )
  })

  it('is null when nothing is priced', () => {
    expect(priceRangeOf([variant('a', [], null)])).toBeNull()
  })
})
