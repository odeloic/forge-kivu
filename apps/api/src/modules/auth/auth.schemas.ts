import { z } from 'zod'

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email())
const passwordSchema = z.string().min(8).max(200)

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
})

export const passwordResetRequestSchema = z.object({
  email: emailSchema,
})

export const passwordResetConfirmSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

export type SignupInput = z.infer<typeof signupSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>
export type PasswordResetConfirmInput = z.infer<
  typeof passwordResetConfirmSchema
>
