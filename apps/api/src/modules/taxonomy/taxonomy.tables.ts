import { sql } from 'drizzle-orm'
import {
  type AnyPgColumn,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

import {
  ATTRIBUTE_VALUE_TYPE_VALUES,
  ATTRIBUTE_VALUE_TYPES,
} from '@forge-kivu/types'

export const attributeValueType = pgEnum(
  'attribute_value_type',
  ATTRIBUTE_VALUE_TYPE_VALUES,
)

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, {
    onDelete: 'restrict',
  }),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const SPEC_ATTRIBUTE_NAME_INDEX = 'spec_attributes_name_lower_idx'

export const specAttributes = pgTable(
  'spec_attributes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    unit: text('unit'),
    type: attributeValueType('type')
      .notNull()
      .default(ATTRIBUTE_VALUE_TYPES.TEXT),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex(SPEC_ATTRIBUTE_NAME_INDEX).on(sql`lower(${table.name})`),
  ],
)

export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  symbol: text('symbol').notNull(),
  slug: text('slug').notNull().unique(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
