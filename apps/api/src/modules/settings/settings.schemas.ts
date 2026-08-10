import { z } from 'zod'

const settingSchema = z.string().trim().min(1).max(20)

export const updateSettingsSchema = z
  .object({
    currency: settingSchema,
    locale: settingSchema,
    language: settingSchema,
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: 'At least one field is required',
  })

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
