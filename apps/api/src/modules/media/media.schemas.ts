import { z } from 'zod'

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export const MAX_SIZE_BYTES = 10 * 1024 * 1024

export const createUploadSchema = z.object({
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  sizeBytes: z.int().min(1).max(MAX_SIZE_BYTES),
})

export type CreateUploadInput = z.infer<typeof createUploadSchema>
