import {
  ALLOWED_MIME_TYPES,
  MAX_SIZE_BYTES,
  type AllowedMimeType,
  type ErrorCode,
} from '@forge-kivu/types'

import { ApiError } from './errors'

export class UploadAbortError extends Error {
  constructor() {
    super('UPLOAD_ABORTED')
    this.name = 'UploadAbortError'
  }
}

export const isUploadAbort = (cause: unknown): boolean =>
  cause instanceof UploadAbortError

const isAllowedMimeType = (value: string): value is AllowedMimeType =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(value)

export const validateFile = (file: File): ErrorCode | null => {
  if (!isAllowedMimeType(file.type)) return 'FILE_TYPE_UNSUPPORTED'
  if (file.size > MAX_SIZE_BYTES) return 'FILE_TOO_LARGE'
  if (file.size < 1) return 'UPLOAD_FAILED'
  return null
}

export type PutOptions = {
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
}

export const putWithProgress = (
  url: string,
  file: File,
  options: PutOptions = {},
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(new UploadAbortError())
      return
    }

    const xhr = new XMLHttpRequest()
    const abort = () => xhr.abort()

    const settle = (finish: () => void) => {
      options.signal?.removeEventListener('abort', abort)
      finish()
    }

    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', file.type)

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total === 0) return
      options.onProgress?.(event.loaded / event.total)
    }

    xhr.onload = () =>
      settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new ApiError('UPLOAD_FAILED'))
      })

    xhr.onerror = () => settle(() => reject(new ApiError('UPLOAD_FAILED')))
    xhr.ontimeout = () => settle(() => reject(new ApiError('UPLOAD_FAILED')))
    xhr.onabort = () => settle(() => reject(new UploadAbortError()))

    options.signal?.addEventListener('abort', abort, { once: true })

    xhr.send(file)
  })
