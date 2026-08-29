<script setup lang="ts">
import type { AdminSupplierDetail } from '@forge-kivu/api-client'

const props = defineProps<{
  supplierId: string
  item: AdminSupplierDetail['gallery'][number]
  position: number
  editing: boolean
  dragging: boolean
  over: boolean
  reordering: boolean
}>()

const emit = defineEmits<{
  edit: []
  cancel: []
  saved: []
  remove: []
  preview: []
  nudge: [delta: number]
  grab: []
  enter: []
  drop: []
  release: []
}>()

const filename = computed(() => {
  const path = props.item.imageUrl.split('?')[0] ?? ''
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
})

const onKeydown = (event: KeyboardEvent) => {
  const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (delta === 0) return
  event.preventDefault()
  emit('nudge', delta)
}

const onDragStart = (event: DragEvent) => {
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  emit('grab')
}

const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  emit('enter')
}
</script>

<template>
  <li
    class="row"
    :class="{ editing, dragging, over }"
    :draggable="!editing && !reordering"
    @dragstart="onDragStart"
    @dragover="onDragOver"
    @drop.prevent="emit('drop')"
    @dragend="emit('release')"
  >
    <button
      type="button"
      class="handle"
      :disabled="editing || reordering"
      :aria-label="`Reorder ${item.altText ?? filename}, position ${position}`"
      @keydown="onKeydown"
    >
      <svg viewBox="0 0 12 16" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="3" r="1.4" />
        <circle cx="9" cy="3" r="1.4" />
        <circle cx="3" cy="8" r="1.4" />
        <circle cx="9" cy="8" r="1.4" />
        <circle cx="3" cy="13" r="1.4" />
        <circle cx="9" cy="13" r="1.4" />
      </svg>
    </button>

    <code class="position">{{ position }}</code>

    <button type="button" class="thumb" @click="emit('preview')">
      <img :src="item.imageUrl" :alt="item.altText ?? ''" />
      <span class="sr-only">Preview {{ item.altText ?? filename }}</span>
    </button>

    <div v-if="!editing" class="described">
      <span v-if="item.altText" class="alt">{{ item.altText }}</span>
      <code v-else class="alt">{{ filename }}</code>
      <span v-if="item.caption" class="muted caption">{{ item.caption }}</span>
      <span v-else-if="item.altText" class="faint caption">No caption</span>
      <span v-else class="status-bad caption">Needs alt text</span>
    </div>

    <a
      v-if="!editing && item.linkUrl"
      class="link"
      :href="item.linkUrl"
      target="_blank"
      rel="noreferrer"
    >
      {{ item.linkUrl }}
    </a>
    <span v-else-if="!editing" class="faint">—</span>

    <div v-if="!editing" class="actions">
      <UiButton variant="ghost" :disabled="reordering" @click="emit('edit')">
        Edit
      </UiButton>
      <UiButton variant="ghost" :disabled="reordering" @click="emit('remove')">
        Remove
      </UiButton>
    </div>

    <SupplierGalleryRowForm
      v-else
      :supplier-id="supplierId"
      :item="item"
      @saved="emit('saved')"
      @cancel="emit('cancel')"
    />
  </li>
</template>

<style scoped>
.row {
  display: grid;
  grid-template-columns: var(--gallery-columns);
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.row.editing {
  grid-template-columns: var(--gallery-columns-editing);
  align-items: start;
}

.row.dragging {
  opacity: 0.4;
}

.row.over {
  border-block-end-color: var(--color-rule-strong);
  background: var(--color-canvas);
}

.handle {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2);
  color: var(--color-control-border);
  cursor: grab;
}

.handle:disabled {
  cursor: default;
}

.handle:hover:not(:disabled) {
  color: var(--color-muted);
}

.handle svg {
  inline-size: 0.75rem;
  block-size: 1rem;
}

.position {
  color: var(--color-muted);
}

.thumb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 0;
  inline-size: 6rem;
  block-size: 4rem;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.thumb img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.described {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-inline-size: 0;
}

.alt {
  overflow: hidden;
  font-size: var(--text-sm);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.caption {
  overflow: hidden;
  font-size: var(--text-xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.faint {
  color: var(--color-faint);
}

.link {
  overflow: hidden;
  color: var(--color-muted);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}

.sr-only {
  position: absolute;
  overflow: hidden;
  inline-size: 1px;
  block-size: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
