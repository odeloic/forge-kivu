import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

import { users } from '../auth/auth.tables'

export const MEDIA_STATUSES = {
  PENDING: 'pending',
  READY: 'ready',
} as const

export type MediaStatus = (typeof MEDIA_STATUSES)[keyof typeof MEDIA_STATUSES]

export const mediaStatus = pgEnum('media_status', [
  MEDIA_STATUSES.PENDING,
  MEDIA_STATUSES.READY,
])

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: text('key').notNull().unique(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  status: mediaStatus('status').notNull().default(MEDIA_STATUSES.PENDING),
  uploadedById: uuid('uploaded_by_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
