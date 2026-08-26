import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'

import { ROLES } from '@forge-kivu/types'

import { app } from '../../app'
import { db } from '../../db'
import {
  SESSION_AUDIENCES,
  sessions,
  users,
  type SessionAudience,
} from '../auth/auth.tables'
import {
  jsonRequest,
  loginAs,
  loginAsAdmin,
  resetDatabase,
  sessionCookie,
} from '../../test/helpers'

const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

const BASIC = { email: 'ada@example.com', password: 'correct horse' }

const adminLogin = (body: unknown) =>
  app.request('/admin/auth/login', jsonRequest(body))

const adminMe = (cookie?: string) =>
  app.request('/admin/auth/me', cookie ? { headers: { cookie } } : undefined)

const adminLogout = (cookie?: string) =>
  app.request('/admin/auth/logout', jsonRequest({}, cookie))

const onlySessionOf = async (audience: SessionAudience) => {
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.audience, audience))
  if (!session) throw new Error(`no ${audience} session row`)
  return session
}

const guardedRoutes: readonly {
  method: string
  path: string
  reached: number
}[] = [
  {
    method: 'DELETE',
    path: '/admin/media/00000000-0000-4000-8000-000000000000',
    reached: 404,
  },
  { method: 'GET', path: '/admin/products', reached: 200 },
  { method: 'PATCH', path: '/admin/settings', reached: 400 },
  { method: 'GET', path: '/admin/suppliers', reached: 200 },
  { method: 'POST', path: '/admin/categories', reached: 400 },
  { method: 'POST', path: '/admin/spec-attributes', reached: 400 },
]

const callGuarded = (method: string, path: string, cookie?: string) =>
  app.request(path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(method === 'GET' ? {} : { body: '{}' }),
  })

beforeEach(async () => {
  await resetDatabase()
})

describe('POST /admin/auth/login', () => {
  it('sets a hardened admin cookie and stores an admin-audience session', async () => {
    await loginAs(ADMIN)

    const res = await adminLogin({
      email: ADMIN.email,
      password: ADMIN.password,
    })

    expect(res.status).toBe(200)

    const header = res.headers.get('set-cookie') ?? ''
    expect(header).toContain('admin_session=')
    expect(header).toContain('HttpOnly')
    expect(header).toContain('SameSite=Strict')
    expect(header).toContain('Path=/')
    expect(header).not.toContain('Domain=')

    expect((await onlySessionOf(SESSION_AUDIENCES.ADMIN)).audience).toBe(
      SESSION_AUDIENCES.ADMIN,
    )
  })

  it('leaves a session created by the workshop on the workshop audience', async () => {
    await loginAs(BASIC)

    expect((await onlySessionOf(SESSION_AUDIENCES.WORKSHOP)).audience).toBe(
      SESSION_AUDIENCES.WORKSHOP,
    )
  })

  it('answers a basic user the same way as a wrong password', async () => {
    await loginAs(BASIC)
    await loginAs(ADMIN)

    const basic = await adminLogin({
      email: BASIC.email,
      password: BASIC.password,
    })
    const wrongPassword = await adminLogin({
      email: ADMIN.email,
      password: 'wrong password',
    })
    const unknownEmail = await adminLogin({
      email: 'nobody@example.com',
      password: ADMIN.password,
    })

    for (const res of [basic, wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401)
      expect(await res.json()).toMatchObject({
        error: { code: 'INVALID_CREDENTIALS' },
      })
      expect(res.headers.get('set-cookie')).toBeNull()
    }

    expect(
      await db
        .select()
        .from(sessions)
        .where(eq(sessions.audience, SESSION_AUDIENCES.ADMIN)),
    ).toHaveLength(0)
  })
})

describe('GET /admin/auth/me', () => {
  it('returns the admin for an admin cookie', async () => {
    const cookie = await loginAsAdmin()

    const res = await adminMe(cookie)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      email: 'admin@example.com',
      role: ROLES.ADMIN,
    })
  })

  it('returns 401 for a workshop cookie carried under the admin name', async () => {
    const workshop = await loginAs(ADMIN)
    const token = workshop.split('=')[1] ?? ''

    const res = await adminMe(`admin_session=${token}`)

    expect(res.status).toBe(401)
  })

  it('returns 401 without a cookie and for an expired session', async () => {
    const cookie = await loginAsAdmin()

    expect((await adminMe()).status).toBe(401)

    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.audience, SESSION_AUDIENCES.ADMIN))

    expect((await adminMe(cookie)).status).toBe(401)
  })
})

describe('POST /admin/auth/logout', () => {
  it('deletes the admin session, clears its cookie and rejects a replay', async () => {
    const cookie = await loginAsAdmin()

    const res = await adminLogout(cookie)

    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toContain('admin_session=')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(
      await db
        .select()
        .from(sessions)
        .where(eq(sessions.audience, SESSION_AUDIENCES.ADMIN)),
    ).toHaveLength(0)

    expect((await adminMe(cookie)).status).toBe(401)
  })

  it('leaves a workshop session alone', async () => {
    const workshop = await loginAs(ADMIN)
    const adminCookie = sessionCookie(
      await adminLogin({ email: ADMIN.email, password: ADMIN.password }),
    )

    await adminLogout(adminCookie)

    const res = await app.request('/auth/me', {
      headers: { cookie: workshop },
    })
    expect(res.status).toBe(200)
  })

  it('does not revoke a workshop token replayed as an admin cookie', async () => {
    const workshop = await loginAs(ADMIN)
    const token = workshop.split('=')[1] ?? ''

    await adminLogout(`admin_session=${token}`)

    const res = await app.request('/auth/me', { headers: { cookie: workshop } })
    expect(res.status).toBe(200)
  })
})

describe('the admin namespace guard', () => {
  it('lets an admin session reach every mounted admin domain route', async () => {
    const cookie = await loginAsAdmin()

    for (const { method, path, reached } of guardedRoutes) {
      const res = await callGuarded(method, path, cookie)
      expect(res.status, `${method} ${path}`).toBe(reached)
    }
  })

  it('refuses no cookie, a workshop session and an expired admin session', async () => {
    const workshop = await loginAs(BASIC)
    const expired = await loginAsAdmin()
    await db
      .update(sessions)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(sessions.audience, SESSION_AUDIENCES.ADMIN))

    for (const { method, path } of guardedRoutes) {
      const anonymous = await callGuarded(method, path)
      const workshopSession = await callGuarded(method, path, workshop)
      const expiredSession = await callGuarded(method, path, expired)

      expect(anonymous.status, `${method} ${path}`).toBe(401)
      expect(workshopSession.status, `${method} ${path}`).toBe(401)
      expect(expiredSession.status, `${method} ${path}`).toBe(401)
    }
  })

  it('refuses an admin-audience session whose user is no longer an admin', async () => {
    const cookie = await loginAsAdmin()
    await db
      .update(users)
      .set({ role: ROLES.BASIC })
      .where(eq(users.email, 'admin@example.com'))

    const res = await app.request('/admin/suppliers', { headers: { cookie } })

    expect(res.status).toBe(403)
  })

  it('guards a path that no admin route claims', async () => {
    const cookie = await loginAsAdmin()

    const anonymous = await app.request('/admin/not-a-route')
    const authorized = await app.request('/admin/not-a-route', {
      headers: { cookie },
    })

    expect(anonymous.status).toBe(401)
    expect(authorized.status).toBe(404)
  })
})
