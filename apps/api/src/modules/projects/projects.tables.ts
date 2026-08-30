import {
  date,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from '../auth/auth.tables'
import { productVariants } from '../catalogue/catalogue.tables'

export const PROJECT_TYPES = {
  RESIDENTIAL_HOUSE: 'residential_house',
  APARTMENT_BUILDING: 'apartment_building',
  COMMERCIAL: 'commercial',
  INDUSTRIAL: 'industrial',
  INSTITUTIONAL: 'institutional',
  OTHER: 'other',
} as const

export type ProjectType = (typeof PROJECT_TYPES)[keyof typeof PROJECT_TYPES]

export const projectType = pgEnum('project_type', [
  PROJECT_TYPES.RESIDENTIAL_HOUSE,
  PROJECT_TYPES.APARTMENT_BUILDING,
  PROJECT_TYPES.COMMERCIAL,
  PROJECT_TYPES.INDUSTRIAL,
  PROJECT_TYPES.INSTITUTIONAL,
  PROJECT_TYPES.OTHER,
])

export const WORK_TYPES = {
  NEW_CONSTRUCTION: 'new_construction',
  RENOVATION: 'renovation',
  EXTENSION: 'extension',
  REPAIR: 'repair',
} as const

export type WorkType = (typeof WORK_TYPES)[keyof typeof WORK_TYPES]

export const workType = pgEnum('work_type', [
  WORK_TYPES.NEW_CONSTRUCTION,
  WORK_TYPES.RENOVATION,
  WORK_TYPES.EXTENSION,
  WORK_TYPES.REPAIR,
])

export const PROJECT_PHASES = {
  FOUNDATION: 'foundation',
  STRUCTURE: 'structure',
  ROOFING: 'roofing',
  FINISHING: 'finishing',
} as const

export type ProjectPhase = (typeof PROJECT_PHASES)[keyof typeof PROJECT_PHASES]

export const projectPhase = pgEnum('project_phase', [
  PROJECT_PHASES.FOUNDATION,
  PROJECT_PHASES.STRUCTURE,
  PROJECT_PHASES.ROOFING,
  PROJECT_PHASES.FINISHING,
])

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  projectType: projectType('project_type').notNull(),
  workType: workType('work_type'),
  phase: projectPhase('phase'),
  clientName: text('client_name'),
  location: text('location'),
  description: text('description'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  budget: numeric('budget', { precision: 12, scale: 2, mode: 'number' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const projectItems = pgTable(
  'project_items',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.variantId] })],
)

export const projectPhases = pgTable(
  'project_phases',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    phase: projectPhase('phase').notNull(),
    completedOn: date('completed_on').notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.phase] })],
)
