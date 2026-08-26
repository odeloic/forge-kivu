import { getCookie } from 'hono/cookie'
import { createMiddleware } from 'hono/factory'

import { AppError } from '../lib/errors'
import { ADMIN_SESSION_COOKIE } from '../modules/admin/admin-auth.service'
import { validateSession } from '../modules/auth/auth.service'
import { SESSION_AUDIENCES } from '../modules/auth/auth.tables'
import type { AuthEnv } from './auth'

export const adminAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const token = getCookie(c, ADMIN_SESSION_COOKIE)
  if (!token) throw new AppError('UNAUTHENTICATED')

  const result = await validateSession(token, SESSION_AUDIENCES.ADMIN)
  if (!result) throw new AppError('UNAUTHENTICATED')

  c.set('user', result.user)
  c.set('session', result.session)

  await next()
})
