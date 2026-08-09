import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

import { AppError } from '../lib/errors'
import {
  SESSION_COOKIE,
  validateSession,
  type AuthSession,
  type AuthUser,
} from '../modules/auth/auth.service'

export type AuthEnv = {
  Variables: {
    user: AuthUser
    session: AuthSession
  }
}

export const auth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) throw new AppError('UNAUTHENTICATED', 'Unauthorized')

  const result = await validateSession(token)
  if (!result) throw new AppError('UNAUTHENTICATED', 'Unauthorized')

  c.set('user', result.user)
  c.set('session', result.session)

  await next()
})
