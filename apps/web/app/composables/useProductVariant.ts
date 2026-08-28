import type { ProductDetail } from '@forge-kivu/api-client'

export const useProductVariant = (
  product: MaybeRefOrGetter<ProductDetail | null | undefined>,
) => {
  const detail = computed(() => toValue(product))
  const options = computed(() => detail.value?.options ?? [])
  const variants = computed(() => detail.value?.variants ?? [])

  const overrides = ref<OptionSelection>({})

  const selection = computed<OptionSelection>(() => ({
    ...selectionOf(options.value, variants.value[0]),
    ...prunedSelection(options.value, overrides.value),
  }))

  const variant = computed(() => matchVariant(variants.value, selection.value))

  const priceRange = computed(() => priceRangeOf(variants.value))

  const price = computed(() => {
    const chosen = variant.value
    if (!chosen) return 'Unavailable'
    return chosen.price === null ? 'Price on request' : formatRwf(chosen.price)
  })

  const imageUrl = computed(
    () => variant.value?.imageUrl ?? detail.value?.media[0]?.url ?? null,
  )

  const isSelected = (optionId: string, valueId: string): boolean =>
    selection.value[optionId] === valueId

  const select = (optionId: string, valueId: string) => {
    overrides.value = { ...overrides.value, [optionId]: valueId }
  }

  return {
    options,
    variants,
    selection,
    variant,
    price,
    priceRange,
    imageUrl,
    isSelected,
    select,
  }
}
