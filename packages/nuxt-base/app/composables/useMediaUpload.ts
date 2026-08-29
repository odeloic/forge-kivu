import { computed, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'

import type { AllowedMimeType, ErrorCode } from '@forge-kivu/types'

import { toApiError, toErrorCode } from '../utils/errors'
import { isUploadAbort, putWithProgress, validateFile } from '../utils/upload'
import { useApi } from './useApi'

export type UploadStatus =
  | 'queued'
  | 'requesting'
  | 'uploading'
  | 'confirming'
  | 'attaching'
  | 'ready'
  | 'failed'

export type UploadItem = {
  id: string
  file: File
  previewUrl: string
  status: UploadStatus
  progress: number
  mediaId: string | null
  error: ErrorCode | null
}

export type UploadCounts = {
  total: number
  ready: number
  failed: number
  pending: number
}

export type UseMediaUploadOptions = {
  concurrency?: number
  onReady?: (item: UploadItem) => Promise<void> | void
}

export type UseMediaUploadReturn = {
  items: Ref<UploadItem[]>
  counts: ComputedRef<UploadCounts>
  progress: ComputedRef<number>
  busy: ComputedRef<boolean>
  readyMediaIds: ComputedRef<string[]>
  add: (files: Iterable<File>) => void
  retry: (id: string) => void
  remove: (id: string) => void
  clear: () => void
}

const DEFAULT_CONCURRENCY = 3

const SETTLED: readonly UploadStatus[] = ['ready', 'failed']

const isSettled = (item: UploadItem): boolean => SETTLED.includes(item.status)

const fingerprint = (file: File): string =>
  `${file.name}:${file.size}:${file.lastModified}`

export const useMediaUpload = (
  options: UseMediaUploadOptions = {},
): UseMediaUploadReturn => {
  const api = useApi()
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY

  const items = ref<UploadItem[]>([])
  const controllers = new Map<string, AbortController>()

  const find = (id: string): UploadItem | undefined =>
    items.value.find((item) => item.id === id)

  const active = (): number =>
    items.value.filter((item) => item.status !== 'queued' && !isSettled(item))
      .length

  const createUpload = async (file: File) => {
    const res = await api.media.$post({
      json: {
        mimeType: file.type as AllowedMimeType,
        sizeBytes: file.size,
      },
    })
    if (!res.ok) throw await toApiError(res)
    return res.json()
  }

  const confirmUpload = async (mediaId: string) => {
    const res = await api.media[':id'].confirm.$post({
      param: { id: mediaId },
    })
    if (!res.ok) throw await toApiError(res)
  }

  const send = async (
    item: UploadItem,
    signal: AbortSignal,
  ): Promise<string> => {
    item.status = 'requesting'
    const { mediaId, uploadUrl } = await createUpload(item.file)

    item.mediaId = mediaId
    item.status = 'uploading'
    item.progress = 0

    await putWithProgress(uploadUrl, item.file, {
      signal,
      onProgress: (fraction) => {
        item.progress = fraction
      },
    })

    return mediaId
  }

  const run = async (item: UploadItem) => {
    const controller = new AbortController()
    controllers.set(item.id, controller)
    item.error = null

    try {
      let mediaId = item.mediaId ?? (await send(item, controller.signal))

      item.status = 'confirming'
      try {
        await confirmUpload(mediaId)
      } catch (cause) {
        if (toErrorCode(cause) !== 'UPLOAD_INCOMPLETE') throw cause
        item.mediaId = null
        mediaId = await send(item, controller.signal)
        item.status = 'confirming'
        await confirmUpload(mediaId)
      }

      item.progress = 1

      if (options.onReady) {
        item.status = 'attaching'
        await options.onReady(item)
      }

      item.status = 'ready'
    } catch (cause) {
      if (isUploadAbort(cause) || !find(item.id)) return
      item.status = 'failed'
      item.error = toErrorCode(cause)
    } finally {
      controllers.delete(item.id)
      pump()
    }
  }

  const pump = () => {
    while (active() < concurrency) {
      const next = items.value.find((item) => item.status === 'queued')
      if (!next) return
      next.status = 'requesting'
      void run(next)
    }
  }

  const release = (item: UploadItem) => {
    controllers.get(item.id)?.abort()
    controllers.delete(item.id)
    URL.revokeObjectURL(item.previewUrl)
  }

  const add = (files: Iterable<File>) => {
    const known = new Set(items.value.map((item) => fingerprint(item.file)))

    for (const file of files) {
      if (known.has(fingerprint(file))) continue
      known.add(fingerprint(file))

      const error = validateFile(file)
      items.value.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        status: error ? 'failed' : 'queued',
        progress: 0,
        mediaId: null,
        error,
      })
    }

    pump()
  }

  const retry = (id: string) => {
    const item = find(id)
    if (!item || item.status !== 'failed') return
    if (validateFile(item.file)) return

    item.status = 'queued'
    item.progress = 0
    item.error = null
    pump()
  }

  const remove = (id: string) => {
    const index = items.value.findIndex((item) => item.id === id)
    if (index === -1) return

    const [item] = items.value.splice(index, 1)
    if (item) release(item)
    pump()
  }

  const clear = () => {
    items.value.forEach(release)
    items.value = []
  }

  onScopeDispose(() => {
    items.value.forEach(release)
  })

  const counts = computed<UploadCounts>(() => {
    const ready = items.value.filter((item) => item.status === 'ready').length
    const failed = items.value.filter((item) => item.status === 'failed').length

    return {
      total: items.value.length,
      ready,
      failed,
      pending: items.value.length - ready - failed,
    }
  })

  const progress = computed(() => {
    const total = items.value.reduce((sum, item) => sum + item.file.size, 0)
    if (total === 0) return 0

    const done = items.value.reduce((sum, item) => {
      if (item.status === 'ready') return sum + item.file.size
      if (item.status === 'failed') return sum
      return sum + item.file.size * item.progress
    }, 0)

    return done / total
  })

  return {
    items,
    counts,
    progress,
    busy: computed(() => items.value.some((item) => !isSettled(item))),
    readyMediaIds: computed(() =>
      items.value.flatMap((item) =>
        item.status === 'ready' && item.mediaId ? [item.mediaId] : [],
      ),
    ),
    add,
    retry,
    remove,
    clear,
  }
}
