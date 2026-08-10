import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import { jsonRequest, loginAs, resetDatabase } from '../../test/helpers'
import { ROLES } from '../auth/auth.service'
import { platformSettings } from './settings.tables'

const ADMIN = {
  email: 'admin@example.com',
  password: 'correct horse',
  role: ROLES.ADMIN,
}

const BASIC = { email: 'ada@example.com', password: 'correct horse' }

const SEED = { currency: 'RWF', locale: 'en-RW', language: 'en' }

const patchSettings = (body: unknown, cookie?: string) =>
  app.request('/admin/settings', { ...jsonRequest(body, cookie), method: 'PATCH' })

const getSettings = () => app.request('/settings')

beforeEach(resetDatabase)

afterEach(async () => {
  await db
    .update(platformSettings)
    .set(SEED)
    .where(eq(platformSettings.id, 1))
})

describe('GET /settings', () => {
  it('returns the seeded row to an anonymous caller', async () => {
    const res = await getSettings()

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject(SEED)
  })
})

describe('PATCH /admin/settings', () => {
  it('updates currency as admin and reflects it on the public read', async () => {
    const cookie = await loginAs(ADMIN)

    const res = await patchSettings({ currency: 'USD' }, cookie)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ...SEED, currency: 'USD' })

    const read = await getSettings()
    expect(await read.json()).toMatchObject({ ...SEED, currency: 'USD' })
  })

  it('returns 403 for a basic user', async () => {
    const cookie = await loginAs(BASIC)

    const res = await patchSettings({ currency: 'USD' }, cookie)
    expect(res.status).toBe(403)
  })

  it('returns 401 without a session', async () => {
    const res = await patchSettings({ currency: 'USD' })
    expect(res.status).toBe(401)
  })

  it('returns 400 for an empty currency', async () => {
    const cookie = await loginAs(ADMIN)

    const res = await patchSettings({ currency: '' }, cookie)
    expect(res.status).toBe(400)
  })

  it('returns 400 for an empty patch', async () => {
    const cookie = await loginAs(ADMIN)

    const res = await patchSettings({}, cookie)
    expect(res.status).toBe(400)
  })
})

describe('platform_settings singleton', () => {
  it('rejects a second row on the check constraint', async () => {
    await expect(
      db.insert(platformSettings).values({ id: 2, ...SEED }),
    ).rejects.toThrow()
  })
})
