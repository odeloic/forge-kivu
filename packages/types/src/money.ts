export type MoneyLine = {
  unitPrice: number
  quantity: number
}

export const calculateLineTotalCents = (
  unitPrice: number,
  quantity: number,
): number => Math.round(Math.round(unitPrice * 100) * quantity)

export const calculateLineTotal = (
  unitPrice: number,
  quantity: number,
): number => calculateLineTotalCents(unitPrice, quantity) / 100

export const sumLineTotals = (lines: readonly MoneyLine[]): number =>
  lines.reduce(
    (total, line) =>
      total + calculateLineTotalCents(line.unitPrice, line.quantity),
    0,
  ) / 100

export const sumAmounts = <T>(
  items: readonly T[],
  amountOf: (item: T) => number | null | undefined,
): number => items.reduce((total, item) => total + (amountOf(item) ?? 0), 0)
