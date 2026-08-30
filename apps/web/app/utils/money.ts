export const calculateLineTotal = (
  unitPrice: number,
  quantity: number,
): number => (Math.round(unitPrice * 100) * quantity) / 100

export const sumAmounts = <T>(
  items: readonly T[],
  amountOf: (item: T) => number | null | undefined,
): number => items.reduce((total, item) => total + (amountOf(item) ?? 0), 0)
