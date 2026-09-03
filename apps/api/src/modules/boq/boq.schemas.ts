import { z } from 'zod'

export {
  BOQ_COLUMNS,
  EXPORT_FORMATS,
  exportQuerySchema,
  type BoqColumn,
  type BoqViewQuery,
  type ExportFormat,
  type ExportQuery,
} from '@forge-kivu/types'

export const boqProjectParamSchema = z.object({ projectId: z.uuid() })

export const boqIdParamSchema = z.object({ id: z.uuid() })
