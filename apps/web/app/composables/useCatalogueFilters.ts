import type { LocationQuery, LocationQueryValue } from 'vue-router'

const FIXED_KEYS = [
  'category',
  'supplier',
  'priceMin',
  'priceMax',
  'page',
] as const

export type PriceRange = { min: number; max: number }

const strings = (
  value: LocationQueryValue | LocationQueryValue[],
): string[] => {
  const items = Array.isArray(value) ? value : [value]
  return items.filter(
    (item): item is string => typeof item === 'string' && item.length > 0,
  )
}

export const useCatalogueFilters = () => {
  const route = useRoute()

  const query = computed<Record<string, string | string[]>>(() => {
    const entries: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(route.query)) {
      const values = strings(value)
      if (values.length === 0) continue
      if ((FIXED_KEYS as readonly string[]).includes(key)) {
        entries[key] = values[0] as string
      } else if (key.startsWith('spec.')) {
        entries[key] = values
      }
    }
    return entries
  })

  const apply = (
    updates: Record<string, string | string[] | null>,
    { keepPage = false }: { keepPage?: boolean } = {},
  ) => {
    const next: LocationQuery = { ...route.query }
    if (!keepPage) delete next.page
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) delete next[key]
      else next[key] = value
    }
    return navigateTo({ query: next })
  }

  const single = (key: (typeof FIXED_KEYS)[number]) =>
    computed(() => {
      const value = query.value[key]
      return typeof value === 'string' ? value : undefined
    })

  const category = single('category')
  const supplier = single('supplier')

  const page = computed(() => {
    const value = query.value.page
    const parsed = typeof value === 'string' ? Number(value) : 1
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
  })

  const price = computed<Partial<PriceRange>>(() => {
    const read = (key: 'priceMin' | 'priceMax') => {
      const value = query.value[key]
      if (typeof value !== 'string') return undefined
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : undefined
    }
    return { min: read('priceMin'), max: read('priceMax') }
  })

  const specValues = (slug: string): string[] => {
    const value = query.value[`spec.${slug}`]
    if (typeof value === 'string') return [value]
    return value ?? []
  }

  const toggleCategory = (slug: string) =>
    apply({ category: category.value === slug ? null : slug })

  const toggleSupplier = (slug: string) =>
    apply({ supplier: supplier.value === slug ? null : slug })

  const toggleSpec = (slug: string, value: string) => {
    const current = specValues(slug)
    const values = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    return apply({ [`spec.${slug}`]: values.length > 0 ? values : null })
  }

  const setPrice = (range: PriceRange, bounds: PriceRange) =>
    apply({
      priceMin: range.min > bounds.min ? String(range.min) : null,
      priceMax: range.max < bounds.max ? String(range.max) : null,
    })

  const clearPrice = () => apply({ priceMin: null, priceMax: null })

  const goToPage = (value: number) =>
    apply({ page: value > 1 ? String(value) : null }, { keepPage: true })

  const clearAll = () => navigateTo({ query: {} })

  const isFiltered = computed(() =>
    Object.keys(query.value).some((key) => key !== 'page'),
  )

  return {
    query,
    category,
    supplier,
    price,
    page,
    isFiltered,
    specValues,
    toggleCategory,
    toggleSupplier,
    toggleSpec,
    setPrice,
    clearPrice,
    goToPage,
    clearAll,
  }
}
