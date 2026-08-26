import { and, eq } from 'drizzle-orm'
import type { CookieOptions } from 'hono/utils/cookie'

import type { Role } from '@forge-kivu/types'

import { db } from '../../db'
import { isUniqueViolation } from '../../db/errors'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { sendMail } from '../../lib/mail'
import {
  passwordResetTokens,
  SESSION_AUDIENCES,
  sessions,
  users,
  type SessionAudience,
} from './auth.tables'

export const SESSION_COOKIE = 'session'

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000
const TOKEN_BYTES = 32

const dummyPasswordHash = Bun.password.hash('forge-kivu-dummy-password', {
  algorithm: 'argon2id',
})

export type AuthUser = {
  id: string
  email: string
  role: Role
  createdAt: Date
}

export type AuthSession = {
  id: string
  userId: string
  audience: SessionAudience
  expiresAt: Date
}

export type Credentials = {
  id: string
  role: Role
}

const publicUserColumns = {
  id: users.id,
  email: users.email,
  role: users.role,
  createdAt: users.createdAt,
}

export const sessionCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'Lax',
  path: '/',
  secure: env.NODE_ENV === 'production',
  maxAge: SESSION_TTL_MS / 1000,
})

const generateToken = (): string => {
  const bytes = new Uint8Array(TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return Buffer.from(bytes).toString('base64url')
}

const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return Buffer.from(digest).toString('hex')
}

const normalizeEmail = (email: string): string => email.trim().toLowerCase()

export const createSession = async (
  userId: string,
  audience: SessionAudience,
): Promise<string> => {
  const token = generateToken()
  await db.insert(sessions).values({
    id: await hashToken(token),
    userId,
    audience,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })
  return token
}

export const signup = async (
  email: string,
  password: string,
): Promise<string> => {
  const passwordHash = await Bun.password.hash(password, {
    algorithm: 'argon2id',
  })

  const created = await db
    .insert(users)
    .values({ email: normalizeEmail(email), passwordHash })
    .returning({ id: users.id })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('EMAIL_TAKEN')
      }
      throw error
    })

  const [user] = created
  if (!user) throw new Error('Signup failed: insert returned no row')

  return createSession(user.id, SESSION_AUDIENCES.WORKSHOP)
}

export const verifyCredentials = async (
  email: string,
  password: string,
): Promise<Credentials | null> => {
  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1)

  if (!user) {
    await Bun.password.verify(password, await dummyPasswordHash)
    return null
  }

  if (!(await Bun.password.verify(password, user.passwordHash))) return null

  return { id: user.id, role: user.role }
}

export const login = async (
  email: string,
  password: string,
): Promise<string | null> => {
  const user = await verifyCredentials(email, password)
  if (!user) return null

  return createSession(user.id, SESSION_AUDIENCES.WORKSHOP)
}

export const validateSession = async (
  token: string,
  audience: SessionAudience,
): Promise<{ user: AuthUser; session: AuthSession } | null> => {
  const sessionId = await hashToken(token)

  const [row] = await db
    .select({
      session: {
        id: sessions.id,
        userId: sessions.userId,
        audience: sessions.audience,
        expiresAt: sessions.expiresAt,
      },
      user: publicUserColumns,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), eq(sessions.audience, audience)))
    .limit(1)

  if (!row) return null

  const now = Date.now()

  if (row.session.expiresAt.getTime() <= now) {
    await db.delete(sessions).where(eq(sessions.id, sessionId))
    return null
  }

  if (row.session.expiresAt.getTime() - now < SESSION_TTL_MS / 2) {
    const expiresAt = new Date(now + SESSION_TTL_MS)
    await db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, sessionId))
    return { user: row.user, session: { ...row.session, expiresAt } }
  }

  return row
}

export const invalidateSession = async (
  token: string,
  audience: SessionAudience,
): Promise<void> => {
  await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.id, await hashToken(token)),
        eq(sessions.audience, audience),
      ),
    )
}

export const invalidateAllSessions = async (userId: string): Promise<void> => {
  await db.delete(sessions).where(eq(sessions.userId, userId))
}

export const createPasswordReset = async (email: string): Promise<void> => {
  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1)

  if (!user) return

  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.userId, user.id))

  const token = generateToken()
  await db.insert(passwordResetTokens).values({
    id: await hashToken(token),
    userId: user.id,
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  })

  await sendMail({
    to: user.email,
    subject: 'Reset your password',
    text: `${env.APP_URL}/reset-password?token=${token}`,
  })
}

export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<boolean> => {
  const tokenId = await hashToken(token)

  const [row] = await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.id, tokenId))
    .returning({
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
    })

  if (!row || row.expiresAt.getTime() <= Date.now()) return false

  const passwordHash = await Bun.password.hash(newPassword, {
    algorithm: 'argon2id',
  })

  await db.update(users).set({ passwordHash }).where(eq(users.id, row.userId))

  await invalidateAllSessions(row.userId)

  return true
}

export const getUserById = async (id: string): Promise<AuthUser | null> => {
  const [user] = await db
    .select(publicUserColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  return user ?? null
}
