<script setup lang="ts">
import type { AdminSupplierListItem } from '@forge-kivu/api-client'

definePageMeta({ access: 'admin-only' })

const { list, create, remove } = useSuppliers()

const { data, error, refresh } = await useAsyncData('admin-suppliers', () =>
  list(),
)

const creating = ref(false)
const form = reactive({ name: '', slug: '', description: '' })
const { pending: saving, error: formError, run: runCreate } = useAsyncAction()

const openCreate = () => {
  form.name = ''
  form.slug = ''
  form.description = ''
  formError.value = null
  creating.value = true
}

const submit = () =>
  runCreate(async () => {
    await create({
      name: form.name,
      slug: form.slug,
      description: form.description.trim() || null,
    })
    creating.value = false
    await refresh()
  })

const doomed = ref<AdminSupplierListItem | null>(null)
const { error: actionError, run: runRemove } = useAsyncAction()

const confirmRemove = async () => {
  const supplier = doomed.value
  if (!supplier) return
  await runRemove(async () => {
    await remove(supplier.id)
    await refresh()
  })
  doomed.value = null
}
</script>

<template>
  <section class="page">
    <div class="header">
      <h1>Suppliers</h1>
      <UiButton variant="primary" @click="openCreate">New supplier</UiButton>
    </div>

    <p v-if="error" class="note status-bad">
      {{ errorMessage(toErrorCode(error)) }}
    </p>
    <p v-if="actionError" class="note status-bad">
      {{ errorMessage(actionError) }}
    </p>

    <table v-if="data?.length">
      <thead>
        <tr>
          <th class="logo-column">Logo</th>
          <th class="name-column">Name</th>
          <th>Description</th>
          <th class="count-column">Products</th>
          <th class="flag-column">Visible</th>
          <th class="actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.id">
          <td>
            <img
              v-if="row.logoUrl"
              :src="row.logoUrl"
              :alt="`${row.name} logo`"
              class="logo"
            />
            <span v-else class="muted">—</span>
          </td>
          <td>
            <div class="cell">
              <NuxtLink :to="`/suppliers/${row.slug}`">
                {{ row.name }}
              </NuxtLink>
              <br />
              <code>{{ row.slug }}</code>
            </div>
          </td>
          <td>
            <div class="cell muted">{{ row.description ?? '—' }}</div>
          </td>
          <td>{{ row.productCount }}</td>
          <td :class="row.visible ? 'status-ok' : 'status-neutral'">
            {{ row.visible ? 'Yes' : 'No' }}
          </td>
          <td>
            <div class="actions">
              <UiButton as-child variant="ghost">
                <NuxtLink :to="`/suppliers/${row.slug}`"> Open </NuxtLink>
              </UiButton>
              <UiButton variant="ghost" @click="doomed = row">
                Delete
              </UiButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="muted">No suppliers yet.</p>

    <UiDialog
      v-model:open="creating"
      title="New supplier"
      description="The slug is what the shop uses in the supplier's URL."
    >
      <form class="form" novalidate @submit.prevent="submit">
        <fieldset class="fields" :disabled="saving">
          <div class="field">
            <Label for="supplier-name">Name</Label>
            <input
              id="supplier-name"
              v-model="form.name"
              type="text"
              required
            />
          </div>

          <div class="field">
            <Label for="supplier-slug">Slug</Label>
            <input
              id="supplier-slug"
              v-model="form.slug"
              type="text"
              required
            />
          </div>

          <div class="field">
            <Label for="supplier-description">Description</Label>
            <textarea
              id="supplier-description"
              v-model="form.description"
              rows="3"
            />
          </div>

          <p v-if="formError" class="note status-bad" role="alert">
            {{ errorMessage(formError) }}
          </p>

          <div class="form-actions">
            <UiButton @click="creating = false">Cancel</UiButton>
            <UiButton type="submit" variant="primary">
              {{ saving ? 'Creating…' : 'Create supplier' }}
            </UiButton>
          </div>
        </fieldset>
      </form>
    </UiDialog>

    <UiConfirmDialog
      :open="doomed !== null"
      title="Delete supplier?"
      :description="`${doomed?.name ?? ''} is removed for good. Suppliers that still have products cannot be deleted.`"
      @update:open="(value) => !value && (doomed = null)"
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

.logo-column {
  width: 4rem;
}

.name-column {
  width: 22%;
}

.count-column,
.flag-column {
  width: 5rem;
}

.actions-column {
  width: 9rem;
}

.logo {
  width: 2.25rem;
  height: 2.25rem;
  object-fit: contain;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}

.form {
  display: contents;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  margin: 0;
  padding: 0;
  border: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-top: var(--space-2);
}
</style>
