import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import { media } from '../media/media.tables'

export const suppliers = pgTable('suppliers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  logoMediaId: uuid('logo_media_id').references(() => media.id, {
    onDelete: 'set null',
  }),
  visible: boolean('visible').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
