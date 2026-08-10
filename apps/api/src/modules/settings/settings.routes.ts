import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'

import { updateSettingsSchema } from './settings.schemas'
import { getSettings, updateSettings } from './settings.service'

export const settingsRoutes = new Hono().get('/', async (c) =>
  c.json(await getSettings()),
)

export const adminSettingsRoutes = new Hono().patch(
  '/',
  zValidator('json', updateSettingsSchema),
  async (c) => c.json(await updateSettings(c.req.valid('json'))),
)
