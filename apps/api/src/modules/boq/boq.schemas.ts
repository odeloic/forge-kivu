import { z } from 'zod'

export {
  EXPORT_FORMATS,
  exportQuerySchema,
  type ExportFormat,
  type ExportQuery,
} from '@forge-kivu/types'

export const boqProjectParamSchema = z.object({ projectId: z.uuid() })

export const boqIdParamSchema = z.object({ id: z.uuid() })
