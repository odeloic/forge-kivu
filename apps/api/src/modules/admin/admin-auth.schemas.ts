import { z } from 'zod'

import { emailSchema } from '../auth/auth.schemas'

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})

export type AdminLoginInput = z.infer<typeof adminLoginSchema>
