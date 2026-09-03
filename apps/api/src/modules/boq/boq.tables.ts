import {
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import type { BoqOption } from '@forge-kivu/types'

import { productVariants } from '../catalogue/catalogue.tables'
import { projects } from '../projects/projects.tables'

export const boqs = pgTable(
  'boqs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    revision: integer('revision').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique().on(table.projectId, table.revision)],
)

export const boqItems = pgTable('boq_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  boqId: uuid('boq_id')
    .notNull()
    .references(() => boqs.id, { onDelete: 'cascade' }),
  variantId: uuid('variant_id').references(() => productVariants.id, {
    onDelete: 'set null',
  }),
  name: text('name').notNull(),
  sku: text('sku'),
  unitPrice: numeric('unit_price', {
    precision: 12,
    scale: 2,
    mode: 'number',
  }).notNull(),
  quantity: numeric('quantity', {
    precision: 12,
    scale: 2,
    mode: 'number',
  }).notNull(),
  unit: text('unit').notNull().default(''),
  spaceId: uuid('space_id'),
  spaceName: text('space_name'),
  supplierName: text('supplier_name').notNull().default(''),
  categoryName: text('category_name').notNull().default(''),
  categoryRootName: text('category_root_name').notNull().default(''),
  options: jsonb('options').$type<BoqOption[]>().notNull().default([]),
  sortOrder: integer('sort_order').notNull().default(0),
})
