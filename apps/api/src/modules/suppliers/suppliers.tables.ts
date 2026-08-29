import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { media } from '../media/media.tables'

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  logoMediaId: uuid('logo_media_id').references(() => media.id, {
    onDelete: 'set null',
  }),
  email: text('email'),
  phone: text('phone'),
  websiteUrl: text('website_url'),
  address: text('address'),
  featuredMediaId: uuid('featured_media_id').references(() => media.id, {
    onDelete: 'set null',
  }),
  visible: boolean('visible').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const supplierGalleryItems = pgTable(
  'supplier_gallery_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    supplierId: uuid('supplier_id')
      .notNull()
      .references(() => suppliers.id, { onDelete: 'cascade' }),
    mediaId: uuid('media_id')
      .notNull()
      .references(() => media.id),
    caption: text('caption'),
    altText: text('alt_text').notNull(),
    linkUrl: text('link_url'),
    displayOrder: integer('display_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('supplier_gallery_items_supplier_order_idx').on(
      table.supplierId,
      table.displayOrder,
    ),
    unique('supplier_gallery_items_supplier_media_unique').on(
      table.supplierId,
      table.mediaId,
    ),
  ],
)
