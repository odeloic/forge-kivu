import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'

import { AppError } from '../../lib/errors'
import { auth } from '../../middleware/auth'
import {
  loginSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  signupSchema,
} from './auth.schemas'
import {
  createPasswordReset,
  invalidateSession,
  login,
  resetPassword,
  sessionCookieOptions,
  SESSION_COOKIE,
  signup,
} from './auth.service'

export const authRoutes = new Hono()
  .post('/signup', zValidator('json', signupSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const token = await signup(email, password)
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions())
    return c.json({ ok: true }, 201)
  })
  .post('/login', zValidator('json', loginSchema), async (c) => {
    const { email, password } = c.req.valid('json')
    const token = await login(email, password)
    if (!token) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password')
    }
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions())
    return c.json({ ok: true }, 200)
  })
  .post('/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) await invalidateSession(token)
    deleteCookie(c, SESSION_COOKIE, { path: '/' })
    return c.body(null, 204)
  })
  .get('/me', auth, (c) => c.json(c.get('user')))
  .post(
    '/password-reset',
    zValidator('json', passwordResetRequestSchema),
    async (c) => {
      await createPasswordReset(c.req.valid('json').email)
      return c.json({ ok: true }, 202)
    },
  )
  .post(
    '/password-reset/confirm',
    zValidator('json', passwordResetConfirmSchema),
    async (c) => {
      const { token, password } = c.req.valid('json')
      if (!(await resetPassword(token, password))) {
        throw new AppError('INVALID_TOKEN', 'Invalid or expired token')
      }
      deleteCookie(c, SESSION_COOKIE, { path: '/' })
      return c.body(null, 204)
    },
  )
