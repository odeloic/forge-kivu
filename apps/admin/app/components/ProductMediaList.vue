<script setup lang="ts">
const media = defineModel<MediaDraft[]>({ required: true })

const emit = defineEmits<{
  remove: [index: number]
  move: [index: number, delta: number]
}>()

const filename = (url: string): string => {
  const path = url.split('?')[0] ?? ''
  return decodeURIComponent(path.slice(path.lastIndexOf('/') + 1))
}

const draggingIndex = ref<number | null>(null)
const overIndex = ref<number | null>(null)

const release = () => {
  draggingIndex.value = null
  overIndex.value = null
}

const drop = (target: number) => {
  const from = draggingIndex.value
  release()
  if (from === null || from === target) return
  emit('move', from, target - from)
}

const onKeydown = (event: KeyboardEvent, index: number) => {
  const delta = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0
  if (delta === 0) return
  event.preventDefault()
  emit('move', index, delta)
}
</script>

<template>
  <div class="table">
    <div class="table-head">
      <span />
      <span>#</span>
      <span>Image</span>
      <span>File</span>
      <span />
    </div>

    <ul class="rows">
      <li
        v-for="(item, index) in media"
        :key="item.mediaId"
        class="row"
        :class="{
          dragging: draggingIndex === index,
          over: overIndex === index && draggingIndex !== index,
        }"
        draggable="true"
        @dragstart="draggingIndex = index"
        @dragover.prevent="overIndex = index"
        @drop.prevent="drop(index)"
        @dragend="release"
      >
        <button
          type="button"
          class="handle"
          :aria-label="`Reorder image ${index + 1}`"
          @keydown="onKeydown($event, index)"
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

        <code class="position">{{ index + 1 }}</code>

        <span class="thumb">
          <img :src="item.url" :alt="`Product image ${index + 1}`" />
        </span>

        <span class="described">
          <code class="ellip">{{ filename(item.url) }}</code>
          <span v-if="index === 0" class="eyebrow">Listing image</span>
        </span>

        <div class="actions">
          <UiButton variant="ghost" @click="emit('remove', index)">
            Remove
          </UiButton>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.table {
  --columns: 1.5rem 1.875rem 6rem minmax(0, 1fr) 8rem;

  display: flex;
  flex-direction: column;
}

.table-head {
  display: grid;
  grid-template-columns: var(--columns);
  align-items: center;
  gap: var(--space-6);
  padding-block-end: var(--space-3);
  border-block-end: var(--border-hairline) solid var(--color-rule-strong);
  color: var(--color-muted);
  font-size: var(--text-3xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-heading);
  text-transform: uppercase;
}

.rows {
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: var(--columns);
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-4) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.row > * {
  min-inline-size: 0;
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

.handle:hover {
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
  display: flex;
  overflow: hidden;
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

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  margin: 0 calc(-1 * var(--space-4));
}
</style>
