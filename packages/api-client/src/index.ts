import { hc, type InferResponseType } from 'hono/client'

import type { AppType } from '@forge-kivu/api'

type ClientOptions = Parameters<typeof hc>[1]

export type ApiClient = ReturnType<typeof hc<AppType>>

export type SessionUser = InferResponseType<
  ApiClient['auth']['me']['$get'],
  200
>

export const createClient = (
  baseUrl: string,
  options?: ClientOptions,
): ApiClient => hc<AppType>(baseUrl, options)
