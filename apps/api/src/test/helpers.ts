import { eq, sql } from 'drizzle-orm'

import { app } from '../app'
import { db } from '../db'
import { outbox } from '../lib/mail'
import { ROLES, type Role } from '../modules/auth/auth.service'
import { users } from '../modules/auth/auth.tables'

export type TestUser = {
  email: string
  password: string
  role?: Role
}

/**
 * Isn't this a recipe for disaster?
 */
export const resetDatabase = async (): Promise<void> => {
  await db.execute(
    sql`truncate table "spec_attributes", "categories", "suppliers", "media", "password_reset_tokens", "sessions", "users" cascade`,
  )
  outbox.length = 0
}

export const jsonRequest = (body: unknown, cookie?: string): RequestInit => ({
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(cookie ? { cookie } : {}),
  },
  body: JSON.stringify(body),
})

export const sessionCookie = (res: Response): string => {
  const header = res.headers.get('set-cookie')
  if (!header) throw new Error('response has no set-cookie header')
  const [pair] = header.split(';')
  if (!pair) throw new Error('set-cookie header is empty')
  return pair
}

export const loginAs = async (user: TestUser): Promise<string> => {
  const res = await app.request(
    '/auth/signup',
    jsonRequest({ email: user.email, password: user.password }),
  )
  if (res.status !== 201) {
    throw new Error(`signup failed with status ${res.status}`)
  }

  if (user.role && user.role !== ROLES.BASIC) {
    await db
      .update(users)
      .set({ role: user.role })
      .where(eq(users.email, user.email.trim().toLowerCase()))
  }

  return sessionCookie(res)
}
