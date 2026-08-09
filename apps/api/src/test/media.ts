import { CreateBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'

import { app } from '../app'
import { env } from '../env'
import { s3 } from '../storage'
import { jsonRequest } from './helpers'

export const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
])

export type UploadResponse = { mediaId: string; uploadUrl: string }

export const ensurePublicBucket = async (): Promise<void> => {
  await s3
    .send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
    .catch(() => {})

  await s3.send(
    new PutBucketPolicyCommand({
      Bucket: env.S3_BUCKET,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${env.S3_BUCKET}/*`],
          },
        ],
      }),
    }),
  )
}

export const requestUpload = async (
  cookie: string,
  body: unknown = { mimeType: 'image/png', sizeBytes: PNG_BYTES.byteLength },
) => {
  const res = await app.request('/media', jsonRequest(body, cookie))
  const json = (await res.json().catch(() => ({}))) as UploadResponse
  return { res, json }
}

export const uploadBytes = async (
  uploadUrl: string,
  mimeType: string,
  bytes: Uint8Array<ArrayBuffer>,
): Promise<void> => {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': mimeType },
    body: bytes,
  })
  if (!res.ok) throw new Error(`direct upload failed with status ${res.status}`)
}

export const confirmUpload = (mediaId: string, cookie: string) =>
  app.request(`/media/${mediaId}/confirm`, jsonRequest({}, cookie))

export const createPendingMedia = async (cookie: string): Promise<string> => {
  const { json } = await requestUpload(cookie)
  return json.mediaId
}

export const createReadyMedia = async (cookie: string): Promise<string> => {
  const { json } = await requestUpload(cookie)
  await uploadBytes(json.uploadUrl, 'image/png', PNG_BYTES)
  const res = await confirmUpload(json.mediaId, cookie)
  if (res.status !== 200) {
    throw new Error(`confirm failed with status ${res.status}`)
  }
  return json.mediaId
}
