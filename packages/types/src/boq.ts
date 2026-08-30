import { z } from 'zod'

export const EXPORT_FORMATS = {
  XLSX: 'xlsx',
  CSV: 'csv',
} as const

export type ExportFormat = (typeof EXPORT_FORMATS)[keyof typeof EXPORT_FORMATS]

export const EXPORT_FORMAT_VALUES = [
  EXPORT_FORMATS.XLSX,
  EXPORT_FORMATS.CSV,
] as const

export const exportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMAT_VALUES),
})

export type ExportQuery = z.infer<typeof exportQuerySchema>
