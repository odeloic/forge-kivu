import { z } from 'zod'

import { optionalField, optionalNumberField } from './fields'

export const PROJECT_TYPES = {
  RESIDENTIAL_HOUSE: 'residential_house',
  APARTMENT_BUILDING: 'apartment_building',
  COMMERCIAL: 'commercial',
  INDUSTRIAL: 'industrial',
  INSTITUTIONAL: 'institutional',
  OTHER: 'other',
} as const

export type ProjectType = (typeof PROJECT_TYPES)[keyof typeof PROJECT_TYPES]

export const PROJECT_TYPE_VALUES = [
  PROJECT_TYPES.RESIDENTIAL_HOUSE,
  PROJECT_TYPES.APARTMENT_BUILDING,
  PROJECT_TYPES.COMMERCIAL,
  PROJECT_TYPES.INDUSTRIAL,
  PROJECT_TYPES.INSTITUTIONAL,
  PROJECT_TYPES.OTHER,
] as const

export const WORK_TYPES = {
  NEW_CONSTRUCTION: 'new_construction',
  RENOVATION: 'renovation',
  EXTENSION: 'extension',
  REPAIR: 'repair',
} as const

export type WorkType = (typeof WORK_TYPES)[keyof typeof WORK_TYPES]

export const WORK_TYPE_VALUES = [
  WORK_TYPES.NEW_CONSTRUCTION,
  WORK_TYPES.RENOVATION,
  WORK_TYPES.EXTENSION,
  WORK_TYPES.REPAIR,
] as const

export const PROJECT_PHASES = {
  FOUNDATION: 'foundation',
  STRUCTURE: 'structure',
  ROOFING: 'roofing',
  FINISHING: 'finishing',
} as const

export type ProjectPhase = (typeof PROJECT_PHASES)[keyof typeof PROJECT_PHASES]

export const PROJECT_PHASE_VALUES = [
  PROJECT_PHASES.FOUNDATION,
  PROJECT_PHASES.STRUCTURE,
  PROJECT_PHASES.ROOFING,
  PROJECT_PHASES.FINISHING,
] as const

export const PROJECT_SORTS = {
  UPDATED_AT: 'updatedAt',
  CREATED_AT: 'createdAt',
} as const

export type ProjectSort = (typeof PROJECT_SORTS)[keyof typeof PROJECT_SORTS]

export const PROJECT_SORT_VALUES = [
  PROJECT_SORTS.UPDATED_AT,
  PROJECT_SORTS.CREATED_AT,
] as const

export const PROJECT_LIMITS = {
  name: 200,
  clientName: 200,
  location: 200,
  description: 5000,
  budget: 9999999999.99,
  quantity: 1000000,
  spaceName: 100,
  spaces: 50,
} as const

export const projectFields = {
  name: z.string().trim().min(1, 'Name is required.').max(PROJECT_LIMITS.name),
  projectType: z.enum(PROJECT_TYPE_VALUES, {
    error: 'Project type is required.',
  }),
  workType: z.enum(WORK_TYPE_VALUES, { error: 'Choose a valid work type.' }),
  phase: z.enum(PROJECT_PHASE_VALUES, { error: 'Choose a valid phase.' }),
  clientName: z
    .string()
    .trim()
    .min(1, 'Client is required.')
    .max(PROJECT_LIMITS.clientName),
  location: z
    .string()
    .trim()
    .min(1, 'Location is required.')
    .max(PROJECT_LIMITS.location),
  description: z.string().trim().max(PROJECT_LIMITS.description),
  date: z.iso.date('Use the date picker.'),
  budget: z
    .number()
    .nonnegative('Budget cannot be negative.')
    .max(PROJECT_LIMITS.budget)
    .multipleOf(0.01, 'Budget can have at most two decimals.'),
  quantity: z
    .number()
    .min(0.01, 'Quantity must be at least 0.01.')
    .max(PROJECT_LIMITS.quantity)
    .multipleOf(0.01, 'Quantity can have at most two decimals.'),
  spaceName: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(PROJECT_LIMITS.spaceName),
}

const atLeastOneField = (patch: object): boolean =>
  Object.keys(patch).length > 0

export const createProjectSchema = z.object({
  name: projectFields.name,
  projectType: projectFields.projectType,
  workType: projectFields.workType.nullish(),
  phase: projectFields.phase.nullish(),
  clientName: projectFields.clientName.nullish(),
  location: projectFields.location.nullish(),
  description: projectFields.description.nullish(),
  startDate: projectFields.date.nullish(),
  endDate: projectFields.date.nullish(),
  budget: projectFields.budget.nullish(),
})

export const updateProjectSchema = z
  .object({
    name: projectFields.name,
    projectType: projectFields.projectType,
    workType: projectFields.workType.nullable(),
    phase: projectFields.phase.nullable(),
    clientName: projectFields.clientName.nullable(),
    location: projectFields.location.nullable(),
    description: projectFields.description.nullable(),
    startDate: projectFields.date.nullable(),
    endDate: projectFields.date.nullable(),
    budget: projectFields.budget.nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const setItemSchema = z.object({
  quantity: projectFields.quantity,
  spaceId: z.uuid().nullish(),
})

export const removeItemQuerySchema = z.object({ spaceId: z.uuid().optional() })

export const createProjectSpaceSchema = z.object({
  name: projectFields.spaceName,
  spaceId: z.uuid().nullish(),
})

export const updateProjectSpaceSchema = z
  .object({
    name: projectFields.spaceName,
    spaceId: z.uuid().nullable(),
  })
  .partial()
  .refine(atLeastOneField, { message: 'At least one field is required' })

export const setPhaseSchema = z.object({ completedOn: projectFields.date })

export const projectIdentityFormSchema = z.object({
  name: projectFields.name,
  projectType: projectFields.projectType,
  workType: optionalField(projectFields.workType),
})

export const projectSiteFormSchema = z.object({
  clientName: optionalField(projectFields.clientName),
  location: optionalField(projectFields.location),
  description: optionalField(projectFields.description),
})

export const projectScheduleFormSchema = z
  .object({
    startDate: optionalField(projectFields.date),
    endDate: optionalField(projectFields.date),
    budget: optionalNumberField(projectFields.budget),
    phase: optionalField(projectFields.phase),
  })
  .refine(
    (values) =>
      values.startDate === null ||
      values.endDate === null ||
      values.startDate <= values.endDate,
    { message: 'The end date comes before the start date.', path: ['endDate'] },
  )

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type SetItemInput = z.infer<typeof setItemSchema>
export type RemoveItemQuery = z.infer<typeof removeItemQuerySchema>
export type CreateProjectSpaceInput = z.infer<typeof createProjectSpaceSchema>
export type UpdateProjectSpaceInput = z.infer<typeof updateProjectSpaceSchema>
export type SetPhaseInput = z.infer<typeof setPhaseSchema>
export type ProjectIdentityFormValues = z.output<
  typeof projectIdentityFormSchema
>
export type ProjectSiteFormValues = z.output<typeof projectSiteFormSchema>
export type ProjectScheduleFormValues = z.output<
  typeof projectScheduleFormSchema
>
