import type { Settings } from '@forge-kivu/api-client'

export const useSettings = () => {
  const api = useApi()
  const settings = useState<Settings | null>('admin-settings', () => null)

  const load = async (): Promise<Settings> => {
    if (settings.value) return settings.value
    const res = await api.settings.$get()
    if (!res.ok) throw await toApiError(res)
    settings.value = await res.json()
    return settings.value
  }

  return { settings, load }
}
