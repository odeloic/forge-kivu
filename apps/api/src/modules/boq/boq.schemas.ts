import { z } from 'zod'

export const EXPORT_FORMATS = {
  XLSX: 'xlsx',
  CSV: 'csv',
} as const

export type ExportFormat = (typeof EXPORT_FORMATS)[keyof typeof EXPORT_FORMATS]

export const boqProjectParamSchema = z.object({ projectId: z.uuid() })

export const boqIdParamSchema = z.object({ id: z.uuid() })

export const exportQuerySchema = z.object({
  format: z.enum([EXPORT_FORMATS.XLSX, EXPORT_FORMATS.CSV]),
})

export type ExportQuery = z.infer<typeof exportQuerySchema>
