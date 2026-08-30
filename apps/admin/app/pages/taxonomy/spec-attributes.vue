<script setup lang="ts">
import type { SpecAttribute } from '@forge-kivu/api-client'

definePageMeta({ access: 'admin-only' })

const { attributes, removeAttribute } = useTaxonomy()

const { data, error, refresh } = await useAsyncData(
  'admin-spec-attributes',
  () => attributes(),
)

type DialogState = { key: number; editing: SpecAttribute | null }

const dialog = ref<DialogState | null>(null)
let sequence = 0

const openCreate = () => {
  dialog.value = { key: (sequence += 1), editing: null }
}

const openEdit = (attribute: SpecAttribute) => {
  dialog.value = { key: (sequence += 1), editing: attribute }
}

const saved = async () => {
  dialog.value = null
  await refresh()
}

const doomed = ref<SpecAttribute | null>(null)
const confirming = ref(false)
const { error: actionError, run } = useAsyncAction()

const askRemove = (attribute: SpecAttribute) => {
  doomed.value = attribute
  confirming.value = true
}

const confirmRemove = () =>
  run(async () => {
    const attribute = doomed.value
    if (!attribute) return
    await removeAttribute(attribute.id)
    doomed.value = null
    await refresh()
  })
</script>

<template>
  <section class="page">
    <div class="header">
      <h1>Spec attributes</h1>
      <UiButton variant="primary" @click="openCreate">New attribute</UiButton>
    </div>

    <p v-if="error" class="note status-bad">
      {{ errorMessage(toErrorCode(error)) }}
    </p>
    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <table v-if="data?.length">
      <thead>
        <tr>
          <th>Name</th>
          <th class="slug-column">Slug</th>
          <th class="unit-column">Unit</th>
          <th class="actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.id">
          <td>
            <div class="ellip">{{ row.name }}</div>
          </td>
          <td>
            <code class="ellip">{{ row.slug }}</code>
          </td>
          <td :class="{ muted: !row.unit }">{{ row.unit ?? '—' }}</td>
          <td>
            <div class="actions">
              <UiButton variant="ghost" @click="openEdit(row)">Edit</UiButton>
              <UiButton variant="ghost" @click="askRemove(row)">
                Delete
              </UiButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="muted">No attributes yet.</p>

    <p class="muted lede">
      Leave the unit empty for anything that is not measured — Material, Finish,
      Grade. A unit is a label the shop prints beside the value, not a
      converter, so pick one and keep every product’s value in it.
    </p>

    <SpecAttributeDialog
      v-if="dialog"
      :key="dialog.key"
      :editing="dialog.editing"
      @close="dialog = null"
      @saved="saved"
    />

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete attribute?"
      :description="`${doomed?.name ?? ''} is removed for good. An attribute that products still carry a value for cannot be deleted.`"
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

.lede {
  font-size: var(--text-xs);
}

.slug-column {
  width: 26%;
}

.unit-column {
  width: 5rem;
}

.actions-column {
  width: 10rem;
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
