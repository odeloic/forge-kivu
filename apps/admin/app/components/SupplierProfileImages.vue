<script setup lang="ts">
import { ALLOWED_MIME_TYPES } from '@forge-kivu/types'
import type { AdminSupplierDetail } from '@forge-kivu/api-client'

const props = defineProps<{ supplier: AdminSupplierDetail }>()
const emit = defineEmits<{ saved: [] }>()

const saved = () => emit('saved')
const supplierId = () => props.supplier.id

const featured = reactive(
  useSupplierImage(supplierId, 'featuredMediaId', saved),
)
const logo = reactive(useSupplierImage(supplierId, 'logoMediaId', saved))

type SupplierImage = typeof featured

const accept = ALLOWED_MIME_TYPES.join(',')

const featuredInput = useTemplateRef<HTMLInputElement>('featuredInput')
const logoInput = useTemplateRef<HTMLInputElement>('logoInput')

const onPick = (event: Event, image: SupplierImage) => {
  const input = event.target as HTMLInputElement
  if (input.files) image.pick(input.files)
  input.value = ''
}

const STATUS_LABELS: Record<UploadStatus, string> = {
  queued: 'Queued',
  requesting: 'Preparing',
  uploading: 'Uploading',
  confirming: 'Verifying',
  attaching: 'Saving',
  ready: 'Saved',
  failed: 'Failed',
}

const statusText = (image: SupplierImage) => {
  if (!image.item) return ''
  if (image.item.status === 'uploading') {
    return `${Math.round(image.item.progress * 100)}%`
  }
  return STATUS_LABELS[image.item.status]
}

const failed = (image: SupplierImage) => image.item?.status === 'failed'

const source = (image: SupplierImage, savedUrl: string | null) =>
  image.pending && image.item && !failed(image)
    ? image.item.previewUrl
    : savedUrl

const featuredSource = computed(() =>
  source(featured, props.supplier.featuredImageUrl),
)
const logoSource = computed(() => source(logo, props.supplier.logoUrl))

const imageError = computed(() => featured.error ?? logo.error)
</script>

<template>
  <div class="images">
    <span class="eyebrow">Featured image</span>

    <div class="frame">
      <img
        v-if="featuredSource"
        :src="featuredSource"
        :alt="`${supplier.name} featured image`"
        class="featured"
      />
      <svg
        v-else
        class="placeholder"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="4" width="18" height="16" />
        <path d="M3 16l5-5 4 4 3-3 6 6" />
        <circle cx="9" cy="9" r="1.5" />
      </svg>

      <div v-if="featured.pending" class="frame-status">
        <span :class="failed(featured) ? 'status-bad' : 'muted'">
          {{ statusText(featured) }}
        </span>
        <UiButton
          v-if="failed(featured)"
          variant="ghost"
          @click="featured.retry"
        >
          Retry
        </UiButton>
      </div>

      <div class="frame-actions">
        <UiButton :disabled="featured.busy" @click="featuredInput?.click()">
          {{ supplier.featuredImageUrl ? 'Replace' : 'Add image' }}
        </UiButton>
        <UiButton
          v-if="supplier.featuredImageUrl"
          :disabled="featured.busy"
          @click="featured.detach"
        >
          Remove
        </UiButton>
      </div>

      <div class="frame-logo">
        <div class="logo-tile">
          <img
            v-if="logoSource"
            :src="logoSource"
            :alt="`${supplier.name} logo`"
          />
          <svg
            v-else
            class="placeholder"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="16" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
            <circle cx="9" cy="9" r="1.5" />
          </svg>
        </div>

        <div class="logo-bar">
          <span class="eyebrow">Logo</span>
          <template v-if="logo.pending">
            <span
              class="logo-status"
              :class="failed(logo) ? 'status-bad' : 'muted'"
            >
              {{ statusText(logo) }}
            </span>
            <UiButton v-if="failed(logo)" variant="ghost" @click="logo.retry">
              Retry
            </UiButton>
          </template>
          <template v-else>
            <UiButton
              variant="ghost"
              :disabled="logo.busy"
              @click="logoInput?.click()"
            >
              {{ supplier.logoUrl ? 'Replace' : 'Add' }}
            </UiButton>
            <UiButton
              v-if="supplier.logoUrl"
              variant="ghost"
              :disabled="logo.busy"
              @click="logo.detach"
            >
              Remove
            </UiButton>
          </template>
        </div>
      </div>

      <span v-if="featured.item?.status === 'uploading'" class="track">
        <span
          class="fill"
          :style="{ inlineSize: `${featured.item.progress * 100}%` }"
        />
      </span>
    </div>

    <p v-if="imageError" class="note status-bad" role="alert">
      {{ errorMessage(imageError) }}
    </p>

    <span class="muted hint">
      Laid out as the shop renders them. Replacing an image uploads it straight
      away.
    </span>

    <input
      ref="featuredInput"
      type="file"
      :accept="accept"
      hidden
      @change="onPick($event, featured)"
    />
    <input
      ref="logoInput"
      type="file"
      :accept="accept"
      hidden
      @change="onPick($event, logo)"
    />
  </div>
</template>

<style scoped>
.images {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.frame {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  block-size: 12.5rem;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.featured {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.placeholder {
  inline-size: 1.75rem;
  block-size: 1.75rem;
  color: var(--color-faint);
}

.frame-status,
.frame-actions {
  position: absolute;
  inset-block-start: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.frame-status {
  inset-inline-start: var(--space-4);
  padding: var(--space-2) var(--space-5);
  background: var(--color-paper);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.frame-actions {
  inset-inline-end: var(--space-4);
}

.frame-logo {
  position: absolute;
  inset-block-end: var(--space-9);
  inset-inline-start: var(--space-9);
  display: flex;
  align-items: flex-end;
  gap: var(--space-6);
}

.logo-tile {
  display: grid;
  place-items: center;
  overflow: hidden;
  inline-size: 4.5rem;
  block-size: 4.5rem;
  border: var(--border-hairline) solid var(--color-rule-strong);
  background: var(--color-paper);
}

.logo-tile img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}

.logo-tile .placeholder {
  inline-size: 1.375rem;
  block-size: 1.375rem;
}

.logo-bar {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-3) var(--space-6);
  border: var(--border-hairline) solid var(--color-control-border);
  background: var(--color-paper);
}

.logo-status {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.track {
  position: absolute;
  inset-block-end: 0;
  inset-inline: 0;
  block-size: 2px;
  background: var(--color-rule);
}

.fill {
  display: block;
  block-size: 100%;
  background: var(--color-ink);
  transition: inline-size 120ms linear;
}

.hint {
  padding-block-start: var(--space-1);
  font-size: var(--text-xs);
  color: var(--color-faint);
}
</style>
