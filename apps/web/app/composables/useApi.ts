import { createClient, type ApiClient } from '@forge-kivu/api-client'

export const useApi = (): ApiClient => {
  const config = useRuntimeConfig()
  return createClient(config.public.apiBase)
}
