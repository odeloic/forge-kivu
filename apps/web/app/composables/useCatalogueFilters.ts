import type { LocationQuery, LocationQueryValue } from 'vue-router'

const FIXED_KEYS = ['category', 'supplier', 'page'] as const

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

  const apply = (updates: Record<string, string | string[] | null>) => {
    const next: LocationQuery = { ...route.query }
    delete next.page
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) delete next[key]
      else next[key] = value
    }
    return navigateTo({ query: next })
  }

  const supplier = computed(() => {
    const value = query.value.supplier
    return typeof value === 'string' ? value : undefined
  })

  const specValues = (slug: string): string[] => {
    const value = query.value[`spec.${slug}`]
    if (typeof value === 'string') return [value]
    return value ?? []
  }

  const toggleSupplier = (slug: string) =>
    apply({ supplier: supplier.value === slug ? null : slug })

  const toggleSpec = (slug: string, value: string) => {
    const current = specValues(slug)
    const values = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value]
    return apply({ [`spec.${slug}`]: values.length > 0 ? values : null })
  }

  return { query, supplier, specValues, toggleSupplier, toggleSpec }
}
