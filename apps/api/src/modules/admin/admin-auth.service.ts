import type { CookieOptions } from 'hono/utils/cookie'

import { ROLES } from '@forge-kivu/types'

import { env } from '../../env'
import {
  createSession,
  SESSION_TTL_MS,
  verifyCredentials,
} from '../auth/auth.service'
import { SESSION_AUDIENCES } from '../auth/auth.tables'

export const ADMIN_SESSION_COOKIE = 'admin_session'

export const adminSessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'Strict',
  path: '/',
  secure: env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_MS / 1000,
})

export const clearAdminSessionCookieOptions = (): CookieOptions => ({
  sameSite: 'Strict',
  path: '/',
  secure: env.NODE_ENV === 'production',
})

export const adminLogin = async (
  email: string,
  password: string,
): Promise<string | null> => {
  const user = await verifyCredentials(email, password)
  if (!user || user.role !== ROLES.ADMIN) return null

  return createSession(user.id, SESSION_AUDIENCES.ADMIN)
}
