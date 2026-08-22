import { createClient, type ApiClient } from '@forge-kivu/api-client'

export const useApi = (): ApiClient => {
  const config = useRuntimeConfig()
  const session = useSessionState()

  const trackedFetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const response = await fetch(input, init)
    if (response.status === 401) session.value = null
    return response
  }

  if (import.meta.server) {
    return createClient(config.apiBase, {
      fetch: trackedFetch,
      headers: useRequestHeaders(['cookie']),
    })
  }

  return createClient(config.public.apiBase, { fetch: trackedFetch })
}
