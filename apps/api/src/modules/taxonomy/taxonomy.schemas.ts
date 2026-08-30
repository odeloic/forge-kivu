import { z } from 'zod'

export {
  createAttributeSchema,
  createCategorySchema,
  updateAttributeSchema,
  updateCategorySchema,
  type CreateAttributeInput,
  type CreateCategoryInput,
  type UpdateAttributeInput,
  type UpdateCategoryInput,
} from '@forge-kivu/types'

export const taxonomyIdParamSchema = z.object({ id: z.uuid() })
