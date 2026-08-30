import {
  PROJECT_PHASE_VALUES,
  PROJECT_SORT_VALUES,
  PROJECT_SORTS,
  PROJECT_TYPE_VALUES,
} from '@forge-kivu/types'
import { z } from 'zod'

export {
  createProjectSchema,
  setItemSchema,
  setPhaseSchema,
  updateProjectSchema,
  PROJECT_SORTS,
  type CreateProjectInput,
  type ProjectSort,
  type SetItemInput,
  type SetPhaseInput,
  type UpdateProjectInput,
} from '@forge-kivu/types'

export const listQuerySchema = z.object({
  projectType: z.enum(PROJECT_TYPE_VALUES).optional(),
  phase: z.enum(PROJECT_PHASE_VALUES).optional(),
  sort: z.enum(PROJECT_SORT_VALUES).default(PROJECT_SORTS.UPDATED_AT),
})

export const projectIdParamSchema = z.object({ id: z.uuid() })

export const projectPhaseParamSchema = z.object({
  id: z.uuid(),
  phase: z.enum(PROJECT_PHASE_VALUES),
})

export const projectItemParamSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
})

export type ListProjectsQuery = z.infer<typeof listQuerySchema>
