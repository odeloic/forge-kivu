import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { and, eq } from 'drizzle-orm'

import { db } from '../../db'
import { env } from '../../env'
import { AppError } from '../../lib/errors'
import { s3 } from '../../storage'
import { ALLOWED_MIME_TYPES, type CreateUploadInput } from './media.schemas'
import { media, MEDIA_STATUSES } from './media.tables'

export type Media = typeof media.$inferSelect

const UPLOAD_URL_TTL_SECONDS = 900

const EXTENSIONS: Record<(typeof ALLOWED_MIME_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const isMissingObject = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false
  if ('name' in error && error.name === 'NotFound') return true
  if (
    '$metadata' in error &&
    typeof error.$metadata === 'object' &&
    error.$metadata !== null &&
    'httpStatusCode' in error.$metadata
  ) {
    return error.$metadata.httpStatusCode === 404
  }
  return false
}

export const createUpload = async (
  userId: string,
  input: CreateUploadInput,
): Promise<{ mediaId: string; uploadUrl: string }> => {
  const key = `media/${crypto.randomUUID()}.${EXTENSIONS[input.mimeType]}`

  const [row] = await db
    .insert(media)
    .values({
      key,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      uploadedById: userId,
    })
    .returning({ id: media.id })

  if (!row) throw new Error('createUpload failed: insert returned no row')

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ContentType: input.mimeType,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  )

  return { mediaId: row.id, uploadUrl }
}

export const confirmUpload = async (
  mediaId: string,
  userId: string,
): Promise<Media> => {
  const [row] = await db
    .select()
    .from(media)
    .where(eq(media.id, mediaId))
    .limit(1)

  if (!row || row.uploadedById !== userId) {
    throw new AppError('NOT_FOUND', 'Media not found')
  }

  if (row.status === MEDIA_STATUSES.READY) return row

  const head = await s3
    .send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: row.key }))
    .catch((error: unknown) => {
      if (isMissingObject(error)) {
        throw new AppError('UPLOAD_INCOMPLETE', 'Object has not been uploaded')
      }
      throw error
    })

  if (head.ContentLength !== row.sizeBytes) {
    throw new AppError(
      'SIZE_MISMATCH',
      'Uploaded size does not match the declared size',
    )
  }

  const [ready] = await db
    .update(media)
    .set({ status: MEDIA_STATUSES.READY })
    .where(eq(media.id, row.id))
    .returning()

  if (!ready) throw new Error('confirmUpload failed: update returned no row')

  return ready
}

export const getReady = async (mediaId: string): Promise<Media | null> => {
  const [row] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, mediaId), eq(media.status, MEDIA_STATUSES.READY)))
    .limit(1)

  return row ?? null
}

export const getPublicUrl = (key: string): string =>
  `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`

export const remove = async (mediaId: string): Promise<void> => {
  const [row] = await db
    .delete(media)
    .where(eq(media.id, mediaId))
    .returning({ key: media.key })

  if (!row) throw new AppError('NOT_FOUND', 'Media not found')

  await s3.send(
    new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: row.key }),
  )
}
