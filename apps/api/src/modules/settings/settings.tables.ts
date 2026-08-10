import { sql } from 'drizzle-orm'
import { check, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const platformSettings = pgTable(
  'platform_settings',
  {
    id: integer('id').primaryKey(),
    currency: text('currency').notNull(),
    locale: text('locale').notNull(),
    language: text('language').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check('platform_settings_singleton', sql`${table.id} = 1`)],
)
