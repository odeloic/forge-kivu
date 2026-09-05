import type { Space } from '@forge-kivu/api-client'

export const useSpaces = () => {
  const api = useApi()

  const list = async (): Promise<Space[]> => {
    const res = await api.spaces.$get()
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  return { list }
}
