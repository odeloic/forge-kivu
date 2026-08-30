import {
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { PRODUCT_STATUSES, type ProductStatus } from '@forge-kivu/types'

import { media } from '../media/media.tables'
import { suppliers } from '../suppliers/suppliers.tables'
import { categories, specAttributes } from '../taxonomy/taxonomy.tables'

export { PRODUCT_STATUSES, type ProductStatus }

export const productStatus = pgEnum('product_status', [
  PRODUCT_STATUSES.DRAFT,
  PRODUCT_STATUSES.PUBLISHED,
  PRODUCT_STATUSES.NOT_AVAILABLE,
])

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'restrict' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: productStatus('status').notNull().default(PRODUCT_STATUSES.DRAFT),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [unique().on(table.supplierId, table.slug)],
)

export const productOptions = pgTable('product_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const productOptionValues = pgTable('product_option_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  optionId: uuid('option_id')
    .notNull()
    .references(() => productOptions.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const productVariants = pgTable('product_variants', {
  id: uuid('id').primaryKey().defaultRandom(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  sku: text('sku'),
  price: numeric('price', { precision: 12, scale: 2, mode: 'number' }),
  imageMediaId: uuid('image_media_id').references(() => media.id, {
    onDelete: 'set null',
  }),
  sortOrder: integer('sort_order').notNull().default(0),
})

export const variantOptionValues = pgTable(
  'variant_option_values',
  {
    variantId: uuid('variant_id')
      .notNull()
      .references(() => productVariants.id, { onDelete: 'cascade' }),
    optionValueId: uuid('option_value_id')
      .notNull()
      .references(() => productOptionValues.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.variantId, table.optionValueId] })],
)

export const productSpecs = pgTable(
  'product_specs',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    attributeId: uuid('attribute_id')
      .notNull()
      .references(() => specAttributes.id, { onDelete: 'restrict' }),
    value: text('value').notNull(),
  },
  (table) => [primaryKey({ columns: [table.productId, table.attributeId] })],
)

export const productMedia = pgTable(
  'product_media',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.productId, table.mediaId] })],
)
