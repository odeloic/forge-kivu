import { z } from 'zod'

import { PROJECT_PHASES, PROJECT_TYPES, WORK_TYPES } from './projects.tables'

const nameSchema = z.string().trim().min(1).max(200)
const clientNameSchema = z.string().trim().min(1).max(200)
const locationSchema = z.string().trim().min(1).max(200)
const descriptionSchema = z.string().trim().max(5000)
const dateSchema = z.iso.date()
const budgetSchema = z
  .number()
  .nonnegative()
  .max(9999999999.99)
  .multipleOf(0.01)

const projectTypeSchema = z.enum([
  PROJECT_TYPES.RESIDENTIAL_HOUSE,
  PROJECT_TYPES.APARTMENT_BUILDING,
  PROJECT_TYPES.COMMERCIAL,
  PROJECT_TYPES.INDUSTRIAL,
  PROJECT_TYPES.INSTITUTIONAL,
  PROJECT_TYPES.OTHER,
])

const workTypeSchema = z.enum([
  WORK_TYPES.NEW_CONSTRUCTION,
  WORK_TYPES.RENOVATION,
  WORK_TYPES.EXTENSION,
  WORK_TYPES.REPAIR,
])

const phaseSchema = z.enum([
  PROJECT_PHASES.FOUNDATION,
  PROJECT_PHASES.STRUCTURE,
  PROJECT_PHASES.ROOFING,
  PROJECT_PHASES.FINISHING,
])

const atLeastOneField = (patch: object): boolean =>
  Object.keys(patch).length > 0

export const createProjectSchema = z.object({
  name: nameSchema,
  projectType: projectTypeSchema,
  workType: workTypeSchema.nullish(),
  phase: phaseSchema.nullish(),
  clientName: clientNameSchema.nullish(),
  location: locationSchema.nullish(),
  description: descriptionSchema.nullish(),
  startDate: dateSchema.nullish(),
  endDate: dateSchema.nullish(),
  budget: budgetSchema.nullish(),
})

export const updateProjectSchema = z
  .object({
    name: nameSchema,
    projectType: projectTypeSchema,
    workType: workTypeSchema.nullable(),
    phase: phaseSchema.nullable(),
    clientName: clientNameSchema.nullable(),
    location: locationSchema.nullable(),
    description: descriptionSchema.nullable(),
    startDate: dateSchema.nullable(),
    endDate: dateSchema.nullable(),
    budget: budgetSchema.nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const PROJECT_SORTS = {
  UPDATED_AT: 'updatedAt',
  CREATED_AT: 'createdAt',
} as const

export type ProjectSort = (typeof PROJECT_SORTS)[keyof typeof PROJECT_SORTS]

export const listQuerySchema = z.object({
  projectType: projectTypeSchema.optional(),
  phase: phaseSchema.optional(),
  sort: z
    .enum([PROJECT_SORTS.UPDATED_AT, PROJECT_SORTS.CREATED_AT])
    .default(PROJECT_SORTS.UPDATED_AT),
})

export const projectIdParamSchema = z.object({ id: z.uuid() })

export const projectPhaseParamSchema = z.object({
  id: z.uuid(),
  phase: phaseSchema,
})

export const setPhaseSchema = z.object({ completedOn: dateSchema })

export const projectItemParamSchema = z.object({
  id: z.uuid(),
  variantId: z.uuid(),
})

export const setItemSchema = z.object({
  quantity: z.number().int().min(1).max(1000000),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type SetItemInput = z.infer<typeof setItemSchema>
export type ListProjectsQuery = z.infer<typeof listQuerySchema>
export type SetPhaseInput = z.infer<typeof setPhaseSchema>
