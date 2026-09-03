import { z } from 'zod'

export {
  createAttributeSchema,
  createCategorySchema,
  createSpaceSchema,
  createUnitSchema,
  updateAttributeSchema,
  updateCategorySchema,
  updateSpaceSchema,
  updateUnitSchema,
  type CreateAttributeInput,
  type CreateCategoryInput,
  type CreateSpaceInput,
  type CreateUnitInput,
  type UpdateAttributeInput,
  type UpdateCategoryInput,
  type UpdateSpaceInput,
  type UpdateUnitInput,
} from '@forge-kivu/types'

export const taxonomyIdParamSchema = z.object({ id: z.uuid() })
