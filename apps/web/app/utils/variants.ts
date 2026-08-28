import type { ProductOption, ProductVariant } from '@forge-kivu/api-client'

export type OptionSelection = Record<string, string>

const sameValues = (variant: ProductVariant, chosen: string[]): boolean =>
  variant.optionValueIds.length === chosen.length &&
  chosen.every((id) => variant.optionValueIds.includes(id))

export const selectionOf = (
  options: ProductOption[],
  variant: ProductVariant | undefined,
): OptionSelection => {
  const selection: OptionSelection = {}
  for (const option of options) {
    const held = option.values.find((value) =>
      variant?.optionValueIds.includes(value.id),
    )
    const fallback = option.values[0]
    const chosen = held ?? fallback
    if (chosen) selection[option.id] = chosen.id
  }
  return selection
}

export const prunedSelection = (
  options: ProductOption[],
  overrides: OptionSelection,
): OptionSelection => {
  const selection: OptionSelection = {}
  for (const option of options) {
    const chosen = overrides[option.id]
    if (chosen && option.values.some((value) => value.id === chosen)) {
      selection[option.id] = chosen
    }
  }
  return selection
}

export const matchVariant = (
  variants: ProductVariant[],
  selection: OptionSelection,
): ProductVariant | undefined => {
  const chosen = Object.values(selection)
  return variants.find((variant) => sameValues(variant, chosen))
}

export const priceRangeOf = (
  variants: ProductVariant[],
): { min: number; max: number } | null => {
  const prices = variants
    .map((variant) => variant.price)
    .filter((price): price is number => price !== null)
  if (prices.length === 0) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
}
