import type { MenuItem } from '../utils/menu'

export const useMenuTree = () => {
  const api = useApi()
  const cache = useState<Record<string, MenuItem[]>>('menu-tree', () => ({}))
  const pending = useState<Record<string, boolean>>('menu-pending', () => ({}))
  const errors = useState<Record<string, boolean>>('menu-errors', () => ({}))

  const requests = new Map<string, Promise<void>>()

  const fetchSection = async (path: string) => {
    if (cache.value[path] || pending.value[path]) return
    const endpoint = MENU_ENDPOINTS[path as keyof typeof MENU_ENDPOINTS]
    if (!endpoint) return
    pending.value[path] = true
    errors.value[path] = false
    try {
      if (endpoint === 'categories') {
        const response = await api.categories.$get()
        if (!response.ok) throw await toApiError(response)
        cache.value[path] = categoryMenuItems(await response.json())
      } else if (endpoint === 'spaces') {
        const response = await api.spaces.$get()
        if (!response.ok) throw await toApiError(response)
        cache.value[path] = (await response.json()).map((space) => ({
          id: space.id,
          label: space.name,
          target: '/spaces',
        }))
      } else {
        const response = await api.suppliers.$get()
        if (!response.ok) throw await toApiError(response)
        cache.value[path] = (await response.json()).map((supplier) => ({
          id: supplier.id,
          label: supplier.name,
          target: `/suppliers/${encodeURIComponent(supplier.slug)}`,
        }))
      }
    } catch {
      errors.value[path] = true
    } finally {
      pending.value[path] = false
    }
  }

  const load = (path: string): Promise<void> => {
    const existing = requests.get(path)
    if (existing) return existing
    const request = fetchSection(path).finally(() => requests.delete(path))
    requests.set(path, request)
    return request
  }

  const preload = () => Promise.all(Object.keys(MENU_ENDPOINTS).map(load))
  return { cache, errors, pending, load, preload }
}
