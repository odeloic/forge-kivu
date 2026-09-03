import { describe, expect, it } from 'vitest'

import {
  calculateLineTotal,
  calculateLineTotalCents,
  sumAmounts,
  sumLineTotals,
} from './money'

describe('money', () => {
  it('rounds the unit price to cents before multiplying by quantity', () => {
    expect(calculateLineTotalCents(14.255, 3)).toBe(4278)
    expect(calculateLineTotal(14.255, 3)).toBe(42.78)
  })

  it('sums line totals in cents', () => {
    expect(
      sumLineTotals([
        { unitPrice: 14.255, quantity: 3 },
        { unitPrice: 5, quantity: 2 },
      ]),
    ).toBe(52.78)
  })

  it('sums amounts and treats missing amounts as zero', () => {
    const items = [{ amount: 12.5 }, { amount: null }, { amount: 7.25 }]

    expect(sumAmounts(items, (item) => item.amount)).toBe(19.75)
  })
})
