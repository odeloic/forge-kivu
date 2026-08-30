<script setup lang="ts">
import { ALLOWED_MIME_TYPES, MAX_SIZE_BYTES } from '@forge-kivu/types'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{ ready: [mediaId: string, previewUrl: string] }>()

const { items, counts, busy, add, retry, remove, clear } = useMediaUpload({
  onReady: (item) => {
    if (item.mediaId) emit('ready', item.mediaId, item.previewUrl)
  },
})

const MEGABYTE = 1024 * 1024

const accept = ALLOWED_MIME_TYPES.join(',')
const sizeLimit = `${MAX_SIZE_BYTES / MEGABYTE} MB`

const megabytes = (bytes: number) => `${(bytes / MEGABYTE).toFixed(1)} MB`

const STATUS_LABELS: Record<UploadStatus, string> = {
  queued: 'Queued',
  requesting: 'Preparing',
  uploading: 'Uploading',
  confirming: 'Verifying',
  attaching: 'Adding',
  ready: 'Added',
  failed: 'Failed',
}

const statusText = (item: UploadItem): string => {
  if (item.status === 'failed') {
    if (item.error === 'FILE_TOO_LARGE') {
      return `Too large — ${megabytes(item.file.size)}`
    }
    return item.error ? errorMessage(item.error) : STATUS_LABELS.failed
  }

  if (item.status === 'uploading') return `${Math.round(item.progress * 100)}%`
  return STATUS_LABELS[item.status]
}

const tone = (item: UploadItem) => {
  if (item.status === 'failed') return 'error' as const
  if (item.status === 'ready') return 'ok' as const
  return 'neutral' as const
}

const summary = computed(() => {
  const { total, ready, failed } = counts.value
  if (total === 0) return null
  if (failed === 0 && ready === total) {
    return ready === 1 ? '1 added' : `${ready} added`
  }
  const parts = [`${ready} of ${total} added`]
  if (failed > 0) parts.push(`${failed} failed`)
  return parts.join(' · ')
})

const canRetry = (item: UploadItem) =>
  item.status === 'failed' &&
  item.error !== 'FILE_TOO_LARGE' &&
  item.error !== 'FILE_TYPE_UNSUPPORTED'

watch(open, (isOpen) => {
  if (isOpen) clear()
})
</script>

<template>
  <UiDialog
    v-model:open="open"
    title="Add product images"
    description="Drop images or choose files. Each one joins the list as it finishes; saving the section keeps the order."
  >
    <UiDropZone v-slot="{ over, count, choose }" :accept="accept" @files="add">
      <template v-if="over">
        <p class="lead">
          Release to upload {{ count || '' }}
          {{ count === 1 ? 'image' : 'images' }}
        </p>
      </template>
      <template v-else>
        <p class="lead">
          {{ items.length ? 'Drop more images here' : 'Drop images here' }}
        </p>
        <UiButton @click="choose">Choose files</UiButton>
        <p class="muted hint">JPEG, PNG or WebP · up to {{ sizeLimit }} each</p>
      </template>
    </UiDropZone>

    <ul v-if="items.length" class="tiles">
      <UiUploadTile
        v-for="item in items"
        :key="item.id"
        :label="item.file.name"
        :status="statusText(item)"
        :tone="tone(item)"
        :thumbnail="item.previewUrl"
        :progress="item.status === 'uploading' ? item.progress : null"
      >
        <template #actions>
          <UiButton
            v-if="canRetry(item)"
            variant="ghost"
            @click="retry(item.id)"
          >
            Retry
          </UiButton>
          <UiButton variant="ghost" @click="remove(item.id)">Remove</UiButton>
        </template>
      </UiUploadTile>
    </ul>

    <div class="footer">
      <p v-if="summary" class="muted">{{ summary }}</p>
      <div class="spacer" />
      <UiButton :disabled="busy" @click="open = false">
        {{ busy ? 'Uploading…' : 'Done' }}
      </UiButton>
    </div>
  </UiDialog>
</template>

<style scoped>
.lead {
  font-size: var(--text-md);
}

.hint {
  font-size: var(--text-xs);
}

.tiles {
  max-block-size: 18rem;
  overflow-y: auto;
  list-style: none;
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.spacer {
  flex-grow: 1;
}
</style>
