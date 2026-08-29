import { effectScope, nextTick } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ErrorCode } from '@forge-kivu/types'

const apiError = (code: ErrorCode) =>
  new Response(JSON.stringify({ error: { code } }), {
    status: 400,
    headers: { 'content-type': 'application/json' },
  })

const created = (mediaId: string) =>
  new Response(
    JSON.stringify({ mediaId, uploadUrl: `https://s3/${mediaId}` }),
    {
      status: 201,
      headers: { 'content-type': 'application/json' },
    },
  )

const ok = () => new Response('{}', { status: 200 })

const post = vi.fn()
const confirmPost = vi.fn()

vi.mock('../app/composables/useApi', () => ({
  useApi: () => ({
    media: Object.assign(
      { $post: post },
      { ':id': { confirm: { $post: confirmPost } } },
    ),
  }),
}))

type PendingPut = {
  url: string
  file: File
  onProgress?: (fraction: number) => void
  signal?: AbortSignal
  resolve: () => void
  reject: (cause: unknown) => void
}

let puts: PendingPut[] = []

vi.mock('../app/utils/upload', async (importOriginal) => {
  const original = await importOriginal<typeof import('../app/utils/upload')>()
  return {
    ...original,
    putWithProgress: (
      url: string,
      file: File,
      options: { onProgress?: (n: number) => void; signal?: AbortSignal } = {},
    ) =>
      new Promise<void>((resolve, reject) => {
        const pending: PendingPut = { url, file, ...options, resolve, reject }
        options.signal?.addEventListener('abort', () =>
          reject(new original.UploadAbortError()),
        )
        puts.push(pending)
      }),
  }
})

const { useMediaUpload } = await import('../app/composables/useMediaUpload')

const file = (name: string, size = 1_024, type = 'image/png'): File =>
  ({ name, size, type, lastModified: 1 }) as File

const flush = async () => {
  for (let i = 0; i < 25; i++) await nextTick()
}

const settlePut = async (index = 0) => {
  puts[index]?.resolve()
  await flush()
}

beforeEach(() => {
  puts = []
  post.mockReset()
  confirmPost.mockReset()
  let n = 0
  post.mockImplementation(() => Promise.resolve(created(`media-${++n}`)))
  confirmPost.mockImplementation(() => Promise.resolve(ok()))

  vi.stubGlobal('URL', {
    createObjectURL: (f: File) => `blob:${f.name}`,
    revokeObjectURL: vi.fn(),
  })
})

const run = <T>(body: () => T): T => {
  const scope = effectScope()
  const result = scope.run(body)
  if (!result) throw new Error('scope produced no value')
  return result
}

describe('useMediaUpload', () => {
  it('rejects invalid files into failed tiles without queueing them', async () => {
    const upload = run(() => useMediaUpload())

    upload.add([
      file('doc.pdf', 1_024, 'application/pdf'),
      file('huge.png', 11 * 1024 * 1024),
    ])
    await flush()

    expect(upload.items.value.map((item) => item.error)).toEqual([
      'FILE_TYPE_UNSUPPORTED',
      'FILE_TOO_LARGE',
    ])
    expect(post).not.toHaveBeenCalled()
    expect(upload.counts.value.failed).toBe(2)
  })

  it('runs at most three uploads at a time', async () => {
    const upload = run(() => useMediaUpload())

    upload.add([1, 2, 3, 4, 5].map((n) => file(`p${n}.png`)))
    await flush()

    expect(puts).toHaveLength(3)
    expect(upload.items.value[4]?.status).toBe('queued')

    await settlePut(0)
    expect(puts).toHaveLength(4)
  })

  it('reaches ready only after confirm and exposes the media id', async () => {
    const upload = run(() => useMediaUpload())

    upload.add([file('a.png')])
    await flush()

    expect(upload.items.value[0]?.status).toBe('uploading')
    expect(upload.readyMediaIds.value).toEqual([])

    await settlePut()

    expect(confirmPost).toHaveBeenCalledWith({ param: { id: 'media-1' } })
    expect(upload.items.value[0]?.status).toBe('ready')
    expect(upload.readyMediaIds.value).toEqual(['media-1'])
    expect(upload.progress.value).toBe(1)
  })

  it('awaits onReady between confirm and ready, and fails the item when it throws', async () => {
    const onReady = vi.fn(() => Promise.reject(new Error('attach failed')))
    const upload = run(() => useMediaUpload({ onReady }))

    upload.add([file('a.png')])
    await flush()
    await settlePut()

    expect(onReady).toHaveBeenCalledOnce()
    expect(upload.items.value[0]?.status).toBe('failed')
    expect(upload.items.value[0]?.error).toBe('INTERNAL')
  })

  it('does not stall the queue when one item fails', async () => {
    const upload = run(() => useMediaUpload())

    upload.add([1, 2, 3, 4].map((n) => file(`p${n}.png`)))
    await flush()

    puts[0]?.reject(new Error('network'))
    await flush()

    expect(upload.items.value[0]?.status).toBe('failed')
    expect(puts).toHaveLength(4)
  })

  it('re-uploads on retry when confirm reports the bytes never landed', async () => {
    confirmPost.mockImplementationOnce(() =>
      Promise.resolve(apiError('UPLOAD_INCOMPLETE')),
    )

    const upload = run(() => useMediaUpload())
    upload.add([file('a.png')])
    await flush()
    await settlePut()

    expect(puts).toHaveLength(2)
    expect(post).toHaveBeenCalledTimes(2)

    await settlePut(1)

    expect(upload.items.value[0]?.status).toBe('ready')
    expect(upload.items.value[0]?.mediaId).toBe('media-2')
  })

  it('retries a failed item without re-requesting an upload when bytes are already up', async () => {
    confirmPost.mockImplementationOnce(() =>
      Promise.resolve(apiError('SIZE_MISMATCH')),
    )

    const upload = run(() => useMediaUpload())
    upload.add([file('a.png')])
    await flush()
    await settlePut()

    expect(upload.items.value[0]?.error).toBe('SIZE_MISMATCH')

    upload.retry(upload.items.value[0]!.id)
    await flush()

    expect(post).toHaveBeenCalledOnce()
    expect(upload.items.value[0]?.status).toBe('ready')
  })

  it('aborts and revokes the preview when an in-flight item is removed', async () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', {
      createObjectURL: (f: File) => `blob:${f.name}`,
      revokeObjectURL: revoke,
    })

    const upload = run(() => useMediaUpload())
    upload.add([file('a.png'), file('b.png')])
    await flush()

    const aborted = new Promise<boolean>((resolve) =>
      puts[0]?.signal?.addEventListener('abort', () => resolve(true)),
    )

    upload.remove(upload.items.value[0]!.id)
    await flush()

    await expect(aborted).resolves.toBe(true)
    expect(revoke).toHaveBeenCalledWith('blob:a.png')
    expect(upload.items.value).toHaveLength(1)
  })

  it('skips a file that is already queued', async () => {
    const upload = run(() => useMediaUpload())

    upload.add([file('a.png')])
    upload.add([file('a.png')])
    await flush()

    expect(upload.items.value).toHaveLength(1)
  })
})
