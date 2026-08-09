import { createClient, type ApiClient } from '@forge-kivu/api-client'

export const useApi = (): ApiClient => {
  const config = useRuntimeConfig()

  if (import.meta.server) {
    return createClient(config.apiBase, {
      headers: useRequestHeaders(['cookie']),
    })
  }

  return createClient(config.public.apiBase)
}
