import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import { outbox } from '../../lib/mail'
import { auth } from '../../middleware/auth'
import { requireRole } from '../../middleware/require-role'
import { ROLES } from '@forge-kivu/types'
import { sessions, users } from './auth.tables'
import {
  jsonRequest,
  loginAs,
  resetDatabase,
  sessionCookie,
} from '../../test/helpers'

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

const adminApp = new Hono().get(
  '/admin-only',
  auth,
  requireRole(ROLES.ADMIN),
  (c) => c.json({ ok: true }),
)

const onlySession = async () => {
  const [session] = await db.select().from(sessions)
  if (!session) throw new Error('no session row')
  return session
}

const tokenFromCookie = (cookie: string) => cookie.split('=')[1] ?? ''

const resetTokenFromOutbox = () => {
  const mail = outbox.at(-1)
  if (!mail) throw new Error('no mail was sent')
  return new URL(mail.text).searchParams.get('token') ?? ''
}

beforeEach(async () => {
  await resetDatabase()
})

describe('signup', () => {
  it('returns 201 and sets a hardened session cookie', async () => {
    const res = await app.request(
      '/auth/signup',
      jsonRequest({ email: 'ada@example.com', password: 'correct horse' }),
    )

    expect(res.status).toBe(201)

    const header = res.headers.get('set-cookie') ?? ''
    expect(header).toContain('session=')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Lax')
    expect(header).toContain('Path=/')
  })

  it('stores the email lowercase and rejects a duplicate', async () => {
    await app.request(
      '/auth/signup',
      jsonRequest({ email: 'A@b.co', password: 'correct horse' }),
    )

    const [user] = await db.select({ email: users.email }).from(users)
    expect(user?.email).toBe('a@b.co')

    const duplicate = await app.request(
      '/auth/signup',
      jsonRequest({ email: 'a@b.co', password: 'another one' }),
    )
    expect(duplicate.status).toBe(409)
    expect(await duplicate.json()).toMatchObject({
      error: { code: 'EMAIL_TAKEN' },
    })
  })

  it('stores a hash of the token, not the token itself', async () => {
    const res = await app.request(
      '/auth/signup',
      jsonRequest({ email: 'ada@example.com', password: 'correct horse' }),
    )

    const token = tokenFromCookie(sessionCookie(res))
    const session = await onlySession()

    expect(token).not.toBe('')
    expect(session.id).not.toBe(token)
    expect(session.id).toHaveLength(64)
  })

  it('rejects a short password', async () => {
    const res = await app.request(
      '/auth/signup',
      jsonRequest({ email: 'ada@example.com', password: 'short' }),
    )
    expect(res.status).toBe(400)
  })
})

describe('login', () => {
  const credentials = { email: 'ada@example.com', password: 'correct horse' }

  it('accepts correct credentials and sets the session cookie', async () => {
    await loginAs(credentials)

    const res = await app.request('/auth/login', jsonRequest(credentials))

    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toContain('session=')
  })

  it('answers the same way for a wrong password and an unknown email', async () => {
    await loginAs(credentials)

    const wrongPassword = await app.request(
      '/auth/login',
      jsonRequest({ email: credentials.email, password: 'wrong password' }),
    )
    const unknownEmail = await app.request(
      '/auth/login',
      jsonRequest({ email: 'nobody@example.com', password: 'correct horse' }),
    )

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)

    const invalidCredentials = {
      error: { code: 'INVALID_CREDENTIALS' },
    }
    expect(await wrongPassword.json()).toMatchObject(invalidCredentials)
    expect(await unknownEmail.json()).toMatchObject(invalidCredentials)
    expect(wrongPassword.headers.get('set-cookie')).toBeNull()
  })
})

describe('logout', () => {
  it('deletes the session row, clears the cookie and rejects a replay', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const res = await app.request('/auth/logout', jsonRequest({}, cookie))

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(await db.select().from(sessions)).toHaveLength(0)

    const replay = await app.request('/auth/me', { headers: { cookie } })
    expect(replay.status).toBe(401)
  })
})

describe('GET /auth/me', () => {
  it('returns the user for a valid cookie', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const res = await app.request('/auth/me', { headers: { cookie } })

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      email: 'ada@example.com',
      role: ROLES.BASIC,
    })
  })

  it('returns 401 without a cookie', async () => {
    const res = await app.request('/auth/me')
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        requestId: expect.any(String),
      },
    })
  })

  it('returns 401 and deletes the row for an expired session', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.id, (await onlySession()).id))

    const res = await app.request('/auth/me', { headers: { cookie } })

    expect(res.status).toBe(401)
    expect(await db.select().from(sessions)).toHaveLength(0)
  })

  it('extends the expiry once the session is past its halfway point', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const nearlyExpired = new Date(Date.now() + SESSION_TTL_MS / 4)
    await db.update(sessions).set({ expiresAt: nearlyExpired })

    const res = await app.request('/auth/me', { headers: { cookie } })
    expect(res.status).toBe(200)

    const session = await onlySession()
    expect(session.expiresAt.getTime()).toBeGreaterThan(nearlyExpired.getTime())
  })

  it('leaves the expiry alone before the halfway point', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const before = (await onlySession()).expiresAt

    const res = await app.request('/auth/me', { headers: { cookie } })
    expect(res.status).toBe(200)

    expect((await onlySession()).expiresAt.getTime()).toBe(before.getTime())
  })
})

describe('requireRole', () => {
  it('returns 403 for a basic user and 200 for an admin', async () => {
    const basicCookie = await loginAs({
      email: 'basic@example.com',
      password: 'correct horse',
    })
    const adminCookie = await loginAs({
      email: 'admin@example.com',
      password: 'correct horse',
      role: ROLES.ADMIN,
    })

    const basic = await adminApp.request('/admin-only', {
      headers: { cookie: basicCookie },
    })
    const admin = await adminApp.request('/admin-only', {
      headers: { cookie: adminCookie },
    })

    expect(basic.status).toBe(403)
    expect(admin.status).toBe(200)
  })
})

describe('password reset', () => {
  const credentials = { email: 'ada@example.com', password: 'correct horse' }

  it('answers the same way for a known and an unknown email', async () => {
    await loginAs(credentials)

    const known = await app.request(
      '/auth/password-reset',
      jsonRequest({ email: credentials.email }),
    )
    const unknown = await app.request(
      '/auth/password-reset',
      jsonRequest({ email: 'nobody@example.com' }),
    )

    expect(known.status).toBe(unknown.status)
    expect(await known.json()).toEqual(await unknown.json())
  })

  it('accepts a token once and never again', async () => {
    await loginAs(credentials)
    await app.request(
      '/auth/password-reset',
      jsonRequest({ email: credentials.email }),
    )
    const token = resetTokenFromOutbox()

    const first = await app.request(
      '/auth/password-reset/confirm',
      jsonRequest({ token, password: 'a brand new one' }),
    )
    const second = await app.request(
      '/auth/password-reset/confirm',
      jsonRequest({ token, password: 'yet another one' }),
    )

    expect(first.status).toBe(204)
    expect(second.status).toBe(400)
    expect(await second.json()).toMatchObject({
      error: { code: 'INVALID_TOKEN' },
    })

    const login = await app.request(
      '/auth/login',
      jsonRequest({ email: credentials.email, password: 'a brand new one' }),
    )
    expect(login.status).toBe(200)
  })

  it('rejects a token older than 15 minutes', async () => {
    await loginAs(credentials)
    await app.request(
      '/auth/password-reset',
      jsonRequest({ email: credentials.email }),
    )
    const token = resetTokenFromOutbox()

    await db.execute(
      `update "password_reset_tokens" set "expires_at" = now() - interval '1 minute'`,
    )

    const res = await app.request(
      '/auth/password-reset/confirm',
      jsonRequest({ token, password: 'a brand new one' }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects every existing session after a successful reset', async () => {
    const cookie = await loginAs(credentials)
    await app.request(
      '/auth/password-reset',
      jsonRequest({ email: credentials.email }),
    )
    const token = resetTokenFromOutbox()

    await app.request(
      '/auth/password-reset/confirm',
      jsonRequest({ token, password: 'a brand new one' }),
    )

    const res = await app.request('/auth/me', { headers: { cookie } })
    expect(res.status).toBe(401)
    expect(await db.select().from(sessions)).toHaveLength(0)
  })
})

describe('csrf', () => {
  it('rejects a form-style cross-site post', async () => {
    const res = await app.request('/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        origin: 'https://evil.example',
      },
      body: 'email=ada@example.com&password=correct+horse',
    })

    expect(res.status).toBe(403)
  })
})
