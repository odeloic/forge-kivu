import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { AppError } from '../../lib/errors'
import { adminAuth } from '../../middleware/admin-auth'
import { invalidateSession } from '../auth/auth.service'
import { SESSION_AUDIENCES } from '../auth/auth.tables'
import { adminLoginSchema } from './admin-auth.schemas'
import {
  ADMIN_SESSION_COOKIE,
  adminLogin,
  adminSessionCookieOptions,
  clearAdminSessionCookieOptions,
} from './admin-auth.service'

export const adminAuthRoutes = new Hono()
  .post('/login', zValidator('json', adminLoginSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const token = await adminLogin(email, password)
    if (!token) {
      throw new AppError('INVALID_CREDENTIALS')
    }
    setCookie(c, ADMIN_SESSION_COOKIE, token, adminSessionCookieOptions())
    return c.json({ ok: true }, 200)
  })
  .post('/logout', async (c) => {
    const token = getCookie(c, ADMIN_SESSION_COOKIE)
    if (token) await invalidateSession(token, SESSION_AUDIENCES.ADMIN)
    deleteCookie(c, ADMIN_SESSION_COOKIE, clearAdminSessionCookieOptions())
    return c.body(null, 204)
  })
  .get('/me', adminAuth, (c) => c.json(c.get('user')))
