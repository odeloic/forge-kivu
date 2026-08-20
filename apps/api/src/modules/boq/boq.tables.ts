import {
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

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
  quantity: integer('quantity').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})
