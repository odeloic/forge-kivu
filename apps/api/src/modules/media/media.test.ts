import { HeadObjectCommand } from '@aws-sdk/client-s3'
import { eq } from 'drizzle-orm'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { app } from '../../app'
import { db } from '../../db'
import { env } from '../../env'
import { s3 } from '../../storage'
import { ROLES } from '../auth/auth.service'
import { MAX_SIZE_BYTES } from './media.schemas'
import { getPublicUrl, getReady } from './media.service'
import { media, MEDIA_STATUSES } from './media.tables'
import { loginAs, resetDatabase } from '../../test/helpers'
import {
  confirmUpload as confirm,
  ensurePublicBucket,
  PNG_BYTES,
  requestUpload,
  uploadBytes,
} from '../../test/media'

const onlyMediaRow = async () => {
  const [row] = await db.select().from(media)
  if (!row) throw new Error('no media row')
  return row
}

beforeAll(async () => {
  await ensurePublicBucket()
})

beforeEach(async () => {
  await resetDatabase()
})

describe('request an upload', () => {
  it('returns 201 with an upload url and stores a pending row', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const { res, json } = await requestUpload(cookie)

    expect(res.status).toBe(201)
    expect(json).toMatchObject({
      mediaId: expect.any(String),
      uploadUrl: expect.stringContaining(env.S3_BUCKET),
    })

    const row = await onlyMediaRow()
    expect(row).toMatchObject({
      id: json.mediaId,
      mimeType: 'image/png',
      sizeBytes: PNG_BYTES.byteLength,
      status: MEDIA_STATUSES.PENDING,
    })
  })

  it('rejects a disallowed type and an oversized request', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const badType = await requestUpload(cookie, {
      mimeType: 'image/gif',
      sizeBytes: 12,
    })
    const oversized = await requestUpload(cookie, {
      mimeType: 'image/png',
      sizeBytes: MAX_SIZE_BYTES + 1,
    })

    expect(badType.res.status).toBe(400)
    expect(oversized.res.status).toBe(400)
    expect(await db.select().from(media)).toHaveLength(0)
  })

  it('rejects requests without a session', async () => {
    const { res } = await requestUpload('')
    expect(res.status).toBe(401)
  })

  it('accepts a direct upload to the presigned url', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })

    const { json } = await requestUpload(cookie)
    await uploadBytes(json.uploadUrl, 'image/png', PNG_BYTES)

    const row = await onlyMediaRow()
    const head = await s3.send(
      new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: row.key }),
    )
    expect(head.ContentLength).toBe(PNG_BYTES.byteLength)
  })
})

describe('confirm the upload', () => {
  const createAndUpload = async (cookie: string, bytes = PNG_BYTES) => {
    const { json } = await requestUpload(cookie, {
      mimeType: 'image/png',
      sizeBytes: bytes.byteLength,
    })
    await uploadBytes(json.uploadUrl, 'image/png', bytes)
    return json.mediaId as string
  }

  it('flips the row to ready after a real upload', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const mediaId = await createAndUpload(cookie)

    const res = await confirm(mediaId, cookie)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: mediaId,
      status: MEDIA_STATUSES.READY,
    })
    expect((await onlyMediaRow()).status).toBe(MEDIA_STATUSES.READY)
  })

  it('fails and stays pending when nothing was uploaded', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const { json } = await requestUpload(cookie)

    const res = await confirm(json.mediaId, cookie)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'UPLOAD_INCOMPLETE' },
    })
    expect((await onlyMediaRow()).status).toBe(MEDIA_STATUSES.PENDING)
  })

  it('fails when the uploaded size does not match the declared size', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const { json } = await requestUpload(cookie, {
      mimeType: 'image/png',
      sizeBytes: PNG_BYTES.byteLength + 100,
    })
    await uploadBytes(json.uploadUrl, 'image/png', PNG_BYTES)

    const res = await confirm(json.mediaId, cookie)

    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({
      error: { code: 'SIZE_MISMATCH' },
    })
    expect((await onlyMediaRow()).status).toBe(MEDIA_STATUSES.PENDING)
  })

  it('returns 404 when confirming media uploaded by a different user', async () => {
    const owner = await loginAs({
      email: 'owner@example.com',
      password: 'correct horse',
    })
    const other = await loginAs({
      email: 'other@example.com',
      password: 'correct horse',
    })
    const mediaId = await createAndUpload(owner)

    const res = await confirm(mediaId, other)

    expect(res.status).toBe(404)
    expect((await onlyMediaRow()).status).toBe(MEDIA_STATUSES.PENDING)
  })

  it('returns an already-ready record unchanged on retry', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const mediaId = await createAndUpload(cookie)
    await confirm(mediaId, cookie)

    const res = await confirm(mediaId, cookie)

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      id: mediaId,
      status: MEDIA_STATUSES.READY,
    })
  })
})

describe('serve and delete', () => {
  const createReadyMedia = async (cookie: string) => {
    const { json } = await requestUpload(cookie)
    await uploadBytes(json.uploadUrl, 'image/png', PNG_BYTES)
    await confirm(json.mediaId, cookie)
    return onlyMediaRow()
  }

  it('serves ready media through its public url', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const row = await createReadyMedia(cookie)

    const res = await fetch(getPublicUrl(row.key))

    expect(res.status).toBe(200)
    const body = new Uint8Array(await res.arrayBuffer())
    expect(body).toEqual(PNG_BYTES)
  })

  it('exposes ready media to other modules and hides pending rows', async () => {
    const cookie = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const ready = await createReadyMedia(cookie)

    const { json: pending } = await requestUpload(cookie)

    expect(await getReady(ready.id)).toMatchObject({
      id: ready.id,
      status: MEDIA_STATUSES.READY,
    })
    expect(await getReady(pending.mediaId)).toBeNull()
  })

  it('lets an admin delete the row and the object', async () => {
    const user = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const admin = await loginAs({
      email: 'admin@example.com',
      password: 'correct horse',
      role: ROLES.ADMIN,
    })
    const row = await createReadyMedia(user)

    const res = await app.request(`/admin/media/${row.id}`, {
      method: 'DELETE',
      headers: { cookie: admin, 'content-type': 'application/json' },
    })

    expect(res.status).toBe(204)
    expect(await db.select().from(media)).toHaveLength(0)
    const head = await s3
      .send(new HeadObjectCommand({ Bucket: env.S3_BUCKET, Key: row.key }))
      .catch((error: unknown) => error)
    expect(head).toMatchObject({ name: 'NotFound' })
  })

  it('rejects a delete from a non-admin', async () => {
    const user = await loginAs({
      email: 'ada@example.com',
      password: 'correct horse',
    })
    const row = await createReadyMedia(user)

    const res = await app.request(`/admin/media/${row.id}`, {
      method: 'DELETE',
      headers: { cookie: user, 'content-type': 'application/json' },
    })

    expect(res.status).toBe(403)
    expect(
      await db.select().from(media).where(eq(media.id, row.id)),
    ).toHaveLength(1)
  })
})
