import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../app/utils/errors'
import {
  isUploadAbort,
  putWithProgress,
  UploadAbortError,
  validateFile,
} from '../app/utils/upload'

const file = (type: string, size: number): File =>
  ({ type, size, name: 'photo.jpg' }) as File

type XhrStub = {
  status: number
  open: ReturnType<typeof vi.fn>
  setRequestHeader: ReturnType<typeof vi.fn>
  send: ReturnType<typeof vi.fn>
  abort: () => void
  upload: { onprogress: ((event: ProgressEvent) => void) | null }
  onload: (() => void) | null
  onerror: (() => void) | null
  ontimeout: (() => void) | null
  onabort: (() => void) | null
}

let instances: XhrStub[] = []

const lastXhr = (): XhrStub => {
  const xhr = instances.at(-1)
  if (!xhr) throw new Error('no XMLHttpRequest was created')
  return xhr
}

const progress = (loaded: number, total: number): ProgressEvent =>
  ({ lengthComputable: true, loaded, total }) as ProgressEvent

beforeEach(() => {
  instances = []
  vi.stubGlobal(
    'XMLHttpRequest',
    class {
      status = 200
      open = vi.fn()
      setRequestHeader = vi.fn()
      send = vi.fn()
      upload: XhrStub['upload'] = { onprogress: null }
      onload: XhrStub['onload'] = null
      onerror: XhrStub['onerror'] = null
      ontimeout: XhrStub['ontimeout'] = null
      onabort: XhrStub['onabort'] = null

      constructor() {
        instances.push(this as unknown as XhrStub)
      }

      abort() {
        this.onabort?.()
      }
    },
  )
})

describe('validateFile', () => {
  it('accepts an allowed image within the size limit', () => {
    expect(validateFile(file('image/webp', 1_024))).toBeNull()
  })

  it('rejects a disallowed type', () => {
    expect(validateFile(file('application/pdf', 1_024))).toBe(
      'FILE_TYPE_UNSUPPORTED',
    )
  })

  it('rejects a file over the ceiling', () => {
    expect(validateFile(file('image/png', 10 * 1024 * 1024 + 1))).toBe(
      'FILE_TOO_LARGE',
    )
  })

  it('rejects an empty file', () => {
    expect(validateFile(file('image/png', 0))).toBe('UPLOAD_FAILED')
  })
})

describe('putWithProgress', () => {
  it('sends the file with its content type and resolves on success', async () => {
    const pending = putWithProgress('https://storage/put', file('image/png', 4))
    const xhr = lastXhr()

    expect(xhr.open).toHaveBeenCalledWith('PUT', 'https://storage/put')
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/png',
    )

    xhr.onload?.()
    await expect(pending).resolves.toBeUndefined()
  })

  it('reports progress as a fraction', async () => {
    const seen: number[] = []
    const pending = putWithProgress(
      'https://storage/put',
      file('image/png', 4),
      {
        onProgress: (fraction) => seen.push(fraction),
      },
    )
    const xhr = lastXhr()

    xhr.upload.onprogress?.(progress(25, 100))
    xhr.upload.onprogress?.(progress(100, 100))
    xhr.onload?.()
    await pending

    expect(seen).toEqual([0.25, 1])
  })

  it('fails with UPLOAD_FAILED on a non-2xx response', async () => {
    const pending = putWithProgress('https://storage/put', file('image/png', 4))
    const xhr = lastXhr()

    xhr.status = 403
    xhr.onload?.()

    await expect(pending).rejects.toThrow(ApiError)
    await expect(pending).rejects.toMatchObject({ code: 'UPLOAD_FAILED' })
  })

  it('fails with UPLOAD_FAILED on a network error', async () => {
    const pending = putWithProgress('https://storage/put', file('image/png', 4))
    lastXhr().onerror?.()

    await expect(pending).rejects.toMatchObject({ code: 'UPLOAD_FAILED' })
  })

  it('aborts when the signal fires', async () => {
    const controller = new AbortController()
    const pending = putWithProgress(
      'https://storage/put',
      file('image/png', 4),
      { signal: controller.signal },
    )

    controller.abort()

    await expect(pending).rejects.toThrow(UploadAbortError)
    await expect(
      pending.catch((cause: unknown) => isUploadAbort(cause)),
    ).resolves.toBe(true)
  })

  it('never opens a request when the signal is already aborted', async () => {
    const pending = putWithProgress(
      'https://storage/put',
      file('image/png', 4),
      { signal: AbortSignal.abort() },
    )

    await expect(pending).rejects.toThrow(UploadAbortError)
    expect(instances).toHaveLength(0)
  })
})
