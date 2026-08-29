<script setup lang="ts">
import type { AdminSupplierDetail } from '@forge-kivu/api-client'

const props = defineProps<{
  supplier: AdminSupplierDetail
  refresh: () => Promise<void>
}>()

const { removeGalleryItem, reorderGallery } = useSuppliers()

const optimisticIds = ref<string[] | null>(null)

const rows = computed(() => {
  const ids = optimisticIds.value
  if (!ids) return props.supplier.gallery
  const byId = new Map(props.supplier.gallery.map((item) => [item.id, item]))
  const known = new Set(ids)
  return [
    ...ids.flatMap((id) => byId.get(id) ?? []),
    ...props.supplier.gallery.filter((item) => !known.has(item.id)),
  ]
})

const {
  pending: reordering,
  error: reorderError,
  run: runReorder,
} = useAsyncAction()

const saveOrder = (ids: string[]) => {
  if (reordering.value) return
  optimisticIds.value = ids
  return runReorder(async () => {
    try {
      await reorderGallery(props.supplier.id, ids)
      await props.refresh()
    } finally {
      optimisticIds.value = null
    }
  })
}

const reposition = (id: string, to: number) => {
  const ids = rows.value.map((item) => item.id)
  const from = ids.indexOf(id)
  if (from === -1 || to < 0 || to >= ids.length || from === to) return
  ids.splice(to, 0, ...ids.splice(from, 1))
  saveOrder(ids)
}

const draggingId = ref<string | null>(null)
const overId = ref<string | null>(null)

const release = () => {
  draggingId.value = null
  overId.value = null
}

const drop = (targetId: string) => {
  const id = draggingId.value
  release()
  if (!id || id === targetId) return
  reposition(
    id,
    rows.value.findIndex((item) => item.id === targetId),
  )
}

const nudge = (id: string, delta: number) =>
  reposition(id, rows.value.findIndex((item) => item.id === id) + delta)

const editingId = ref<string | null>(null)
const doomedId = ref<string | null>(null)
const uploading = ref(false)

const previewing = ref(false)
const previewIndex = ref(0)

const preview = (id: string) => {
  previewIndex.value = rows.value.findIndex((item) => item.id === id)
  previewing.value = true
}

const doomed = computed(
  () => rows.value.find((item) => item.id === doomedId.value) ?? null,
)

const {
  pending: removing,
  error: removeError,
  run: runRemove,
} = useAsyncAction()

const confirmRemove = () => {
  const id = doomedId.value
  if (!id) return
  runRemove(async () => {
    await removeGalleryItem(props.supplier.id, id)
    doomedId.value = null
    await props.refresh()
  })
}

const saved = async () => {
  editingId.value = null
  await props.refresh()
}

const error = computed(() => reorderError.value ?? removeError.value)
</script>

<template>
  <div class="gallery">
    <div class="gallery-header">
      <p class="muted count">
        {{ rows.length }} {{ rows.length === 1 ? 'image' : 'images' }}
        <template v-if="rows.length > 1"> · drag a row to reorder</template>
      </p>
      <div class="spacer" />
      <UiButton variant="primary" @click="uploading = true">Add image</UiButton>
    </div>

    <p v-if="error" class="note status-bad" role="alert">
      {{ errorMessage(error) }}
    </p>

    <div v-if="rows.length" class="table">
      <div class="table-head">
        <span />
        <span>#</span>
        <span>Image</span>
        <span>Alt text and caption</span>
        <span>Link</span>
        <span />
      </div>

      <ul class="rows">
        <SupplierGalleryRow
          v-for="(item, position) in rows"
          :key="item.id"
          :supplier-id="supplier.id"
          :item="item"
          :position="position + 1"
          :editing="editingId === item.id"
          :dragging="draggingId === item.id"
          :over="overId === item.id && draggingId !== item.id"
          :reordering="reordering"
          @edit="editingId = item.id"
          @cancel="editingId = null"
          @saved="saved"
          @remove="doomedId = item.id"
          @preview="preview(item.id)"
          @nudge="(delta) => nudge(item.id, delta)"
          @grab="draggingId = item.id"
          @enter="overId = item.id"
          @drop="drop(item.id)"
          @release="release"
        />
      </ul>
    </div>

    <p v-else class="muted">No images yet.</p>

    <span class="faint hint">
      Dropping a row saves the whole order. Removing an image keeps the file in
      Media.
    </span>

    <SupplierGalleryLightbox
      v-model:open="previewing"
      v-model:index="previewIndex"
      :items="rows"
      @edit="(id) => (editingId = id)"
      @remove="(id) => (doomedId = id)"
    />

    <GalleryUploadDialog
      v-model:open="uploading"
      :supplier-id="supplier.id"
      @attached="refresh"
    />

    <UiConfirmDialog
      :open="doomedId !== null"
      title="Remove this image?"
      :description="`${doomed?.altText ?? 'This image'} is dropped from the gallery. The file stays in Media.`"
      confirm-label="Remove"
      @update:open="(value) => !value && !removing && (doomedId = null)"
      @confirm="confirmRemove"
    />
  </div>
</template>

<style scoped>
.gallery {
  --gallery-columns: 1.5rem 1.875rem 6rem minmax(0, 1fr) 15.625rem 8rem;
  --gallery-columns-editing: 1.5rem 1.875rem 6rem minmax(0, 1fr);

  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.gallery-header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.count {
  font-size: var(--text-xs);
}

.spacer {
  flex-grow: 1;
}

.table {
  display: flex;
  flex-direction: column;
}

.table-head {
  display: grid;
  grid-template-columns: var(--gallery-columns);
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

.faint {
  color: var(--color-faint);
}

.hint {
  font-size: var(--text-xs);
}
</style>
