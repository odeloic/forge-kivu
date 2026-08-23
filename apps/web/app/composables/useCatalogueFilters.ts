import type { LocationQueryValue } from 'vue-router'

const FIXED_KEYS = ['category', 'supplier', 'page'] as const

const single = (
  value: LocationQueryValue | LocationQueryValue[],
): string | undefined => {
  const first = Array.isArray(value) ? value[0] : value
  return typeof first === 'string' && first.length > 0 ? first : undefined
}

export const useCatalogueFilters = () => {
  const route = useRoute()

  const query = computed<Record<string, string>>(() => {
    const entries: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.query)) {
      const fixed = (FIXED_KEYS as readonly string[]).includes(key)
      if (!fixed && !key.startsWith('spec.')) continue
      const first = single(value)
      if (first) entries[key] = first
    }
    return entries
  })

  return { query }
}
