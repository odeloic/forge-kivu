import { eq } from 'drizzle-orm'

import { db } from '../../db'
import type { UpdateSettingsInput } from './settings.schemas'
import { platformSettings } from './settings.tables'

export type PlatformSettings = typeof platformSettings.$inferSelect

const SETTINGS_ID = 1

export const getSettings = async (): Promise<PlatformSettings> => {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .limit(1)

  if (!row) throw new Error('platform_settings row is missing')

  return row
}

export const updateSettings = async (
  patch: UpdateSettingsInput,
): Promise<PlatformSettings> => {
  const [row] = await db
    .update(platformSettings)
    .set(patch)
    .where(eq(platformSettings.id, SETTINGS_ID))
    .returning()

  if (!row) throw new Error('platform_settings row is missing')

  return row
}
