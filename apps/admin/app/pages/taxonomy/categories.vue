<script setup lang="ts">
definePageMeta({ access: 'admin-only' })

const { tree, removeCategory } = useTaxonomy()

const { data, error, refresh } = await useAsyncData('admin-categories', () =>
  tree(),
)

const rows = computed(() => flattenTree(data.value ?? []))

type DialogState = {
  key: number
  editing: CategoryRow | null
  parentId: string | null
}

const dialog = ref<DialogState | null>(null)
let sequence = 0

const openCreate = (parentId: string | null) => {
  dialog.value = { key: (sequence += 1), editing: null, parentId }
}

const openEdit = (row: CategoryRow) => {
  dialog.value = { key: (sequence += 1), editing: row, parentId: row.parentId }
}

const saved = async () => {
  dialog.value = null
  await refresh()
}

const doomed = ref<CategoryRow | null>(null)
const confirming = ref(false)
const { error: actionError, run } = useAsyncAction()

const askRemove = (row: CategoryRow) => {
  doomed.value = row
  confirming.value = true
}

const confirmRemove = () =>
  run(async () => {
    const row = doomed.value
    if (!row) return
    await removeCategory(row.id)
    doomed.value = null
    await refresh()
  })
</script>

<template>
  <section class="page">
    <div class="header">
      <h1>Categories</h1>
      <UiButton variant="primary" @click="openCreate(null)">
        New root category
      </UiButton>
    </div>

    <p v-if="error" class="note status-bad">
      {{ errorMessage(toErrorCode(error)) }}
    </p>
    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <table v-if="rows.length">
      <thead>
        <tr>
          <th>Category</th>
          <th class="slug-column">Slug</th>
          <th class="sort-column">Sort</th>
          <th class="actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id">
          <td
            class="name"
            :class="{ root: row.depth === 0 }"
            :style="{ paddingInlineStart: `${row.depth * 22}px` }"
          >
            <div class="ellip">{{ row.name }}</div>
          </td>
          <td>
            <code class="ellip">{{ row.slug }}</code>
          </td>
          <td>{{ row.sortOrder }}</td>
          <td>
            <div class="actions">
              <UiButton variant="ghost" @click="openEdit(row)">Edit</UiButton>
              <UiButton variant="ghost" @click="openCreate(row.id)">
                Add child
              </UiButton>
              <UiButton variant="ghost" @click="askRemove(row)">
                Delete
              </UiButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="muted">No categories yet.</p>

    <CategoryDialog
      v-if="dialog"
      :key="dialog.key"
      :rows="rows"
      :editing="dialog.editing"
      :parent-id="dialog.parentId"
      @close="dialog = null"
      @saved="saved"
    />

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete category?"
      :description="`${doomed?.name ?? ''} is removed for good. A category that still has products or child categories cannot be deleted.`"
      @confirm="confirmRemove"
    />
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.slug-column {
  width: 26%;
}

.sort-column {
  width: 5rem;
}

.actions-column {
  width: 13rem;
}

.name.root {
  font-weight: var(--weight-medium);
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}
</style>
