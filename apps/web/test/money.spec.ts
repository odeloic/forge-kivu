import { describe, expect, it } from 'vitest'

import { calculateLineTotal, sumAmounts } from '../app/utils/money'

describe('calculateLineTotal', () => {
  it('rounds the unit price to cents before multiplying by quantity', () => {
    expect(calculateLineTotal(14.255, 3)).toBe(42.78)
  })
})

describe('sumAmounts', () => {
  it('sums amounts and treats missing amounts as zero', () => {
    const items = [{ amount: 12.5 }, { amount: null }, { amount: 7.25 }]

    expect(sumAmounts(items, (item) => item.amount)).toBe(19.75)
  })
})
