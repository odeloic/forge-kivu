import { hc } from 'hono/client'

import type { AppType } from '@forge-kivu/api'

type ClientOptions = Parameters<typeof hc>[1]

export const createClient = (baseUrl: string, options?: ClientOptions) =>
  hc<AppType>(baseUrl, options)

export type ApiClient = ReturnType<typeof createClient>
