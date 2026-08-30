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

import {
  PROJECT_PHASE_VALUES,
  PROJECT_PHASES,
  PROJECT_TYPE_VALUES,
  PROJECT_TYPES,
  WORK_TYPE_VALUES,
  WORK_TYPES,
  type ProjectPhase,
  type ProjectType,
  type WorkType,
} from '@forge-kivu/types'

import { users } from '../auth/auth.tables'
import { productVariants } from '../catalogue/catalogue.tables'

export {
  PROJECT_PHASES,
  PROJECT_TYPES,
  WORK_TYPES,
  type ProjectPhase,
  type ProjectType,
  type WorkType,
}

export const projectType = pgEnum('project_type', PROJECT_TYPE_VALUES)

export const workType = pgEnum('work_type', WORK_TYPE_VALUES)

export const projectPhase = pgEnum('project_phase', PROJECT_PHASE_VALUES)

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
