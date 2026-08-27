<script setup lang="ts">
import type { AdminProductListItem } from '@forge-kivu/api-client'

definePageMeta({ access: 'admin-only' })

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { list, update, remove } = useSuppliers()
const { list: listProducts } = useProducts()
const { load: loadSettings } = useSettings()

const { data, error, refresh } = await useAsyncData(
  () => `admin-supplier-${slug.value}`,
  async () => {
    const suppliers = await list()
    const supplier = suppliers.find((item) => item.slug === slug.value)
    if (!supplier) throw createError({ statusCode: 404 })
    const [products, settings] = await Promise.all([
      listProducts({ supplierId: supplier.id }),
      loadSettings(),
    ])
    return { supplier, products, settings }
  },
  { watch: [slug] },
)

if (error.value) throw error.value

const form = reactive({ name: '', slug: '', description: '' })

watchEffect(() => {
  const supplier = data.value?.supplier
  if (!supplier) return
  form.name = supplier.name
  form.slug = supplier.slug
  form.description = supplier.description ?? ''
})

const saving = ref(false)
const actionError = ref<ErrorCode | null>(null)

const run = async (action: () => Promise<void>) => {
  if (saving.value) return
  saving.value = true
  actionError.value = null
  try {
    await action()
  } catch (cause) {
    actionError.value = toErrorCode(cause)
  } finally {
    saving.value = false
  }
}

const saveDetails = () =>
  run(async () => {
    const supplier = data.value?.supplier
    if (!supplier) return
    const saved = await update(supplier.id, {
      name: form.name,
      slug: form.slug,
      description: form.description.trim() || null,
    })
    if (saved.slug === slug.value) await refresh()
    else await navigateTo(`/suppliers/${saved.slug}`)
  })

const toggleVisible = () =>
  run(async () => {
    const supplier = data.value?.supplier
    if (!supplier) return
    await update(supplier.id, { visible: !supplier.visible })
    await refresh()
  })

const confirming = ref(false)

const confirmRemove = () =>
  run(async () => {
    const supplier = data.value?.supplier
    if (!supplier) return
    await remove(supplier.id)
    await navigateTo('/suppliers')
  })

const STATUS_LABELS: Record<AdminProductListItem['status'], string> = {
  draft: 'Draft',
  published: 'Published',
  not_available: 'Not available',
}

const STATUS_CLASSES: Record<AdminProductListItem['status'], string> = {
  draft: 'status-neutral',
  published: 'status-ok',
  not_available: 'status-bad',
}

const statusFilter = ref<AdminProductListItem['status'] | ''>('')

const products = computed(() => {
  const all = data.value?.products ?? []
  if (!statusFilter.value) return all
  return all.filter((product) => product.status === statusFilter.value)
})

const price = (value: number | null) => {
  const settings = data.value?.settings
  if (value === null || !settings) return '—'
  return new Intl.NumberFormat(settings.locale, {
    style: 'currency',
    currency: settings.currency,
  }).format(value)
}

const day = (value: string | Date) =>
  new Intl.DateTimeFormat(data.value?.settings.locale, {
    dateStyle: 'medium',
  }).format(new Date(value))
</script>

<template>
  <section v-if="data" class="page">
    <p class="breadcrumb">
      <NuxtLink to="/suppliers">Suppliers</NuxtLink>
      <span class="muted"> / {{ data.supplier.name }}</span>
    </p>

    <div class="header">
      <h1>{{ data.supplier.name }}</h1>
      <span
        class="flag"
        :class="data.supplier.visible ? 'status-ok' : 'status-neutral'"
      >
        {{ data.supplier.visible ? 'Visible' : 'Hidden' }}
      </span>
      <div class="spacer" />
      <UiButton :disabled="saving" @click="toggleVisible">
        {{ data.supplier.visible ? 'Hide from shop' : 'Show in shop' }}
      </UiButton>
      <UiButton variant="ghost" @click="confirming = true">Delete</UiButton>
    </div>

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>

    <form novalidate @submit.prevent="saveDetails">
      <fieldset class="details" :disabled="saving">
        <legend>Details</legend>

        <div class="row">
          <div class="field">
            <Label for="name">Name</Label>
            <input id="name" v-model="form.name" type="text" required />
          </div>
          <div class="field">
            <Label for="slug">Slug</Label>
            <input id="slug" v-model="form.slug" type="text" required />
          </div>
        </div>

        <div class="field">
          <Label for="description">Description</Label>
          <textarea id="description" v-model="form.description" rows="3" />
        </div>

        <div v-if="data.supplier.logoUrl" class="logo-row">
          <span class="eyebrow">Logo</span>
          <img
            :src="data.supplier.logoUrl"
            :alt="`${data.supplier.name} logo`"
            class="logo"
          />
        </div>

        <div>
          <UiButton type="submit" variant="primary">
            {{ saving ? 'Saving…' : 'Save details' }}
          </UiButton>
        </div>
      </fieldset>
    </form>

    <section class="products">
      <div class="products-header">
        <h2>Products from this supplier</h2>
        <div class="spacer" />
        <div class="field">
          <Label for="status">Status</Label>
          <select id="status" v-model="statusFilter">
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="not_available">Not available</option>
          </select>
        </div>
      </div>

      <table v-if="products.length">
        <thead>
          <tr>
            <th class="name-column">Name</th>
            <th>Category</th>
            <th class="price-column">Price from</th>
            <th class="status-column">Status</th>
            <th class="date-column">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="product in products" :key="product.id">
            <td>
              <div class="cell">
                {{ product.name }}<br />
                <code>{{ product.slug }}</code>
              </div>
            </td>
            <td>
              <div class="cell">{{ product.category.name }}</div>
            </td>
            <td>{{ price(product.priceFrom) }}</td>
            <td :class="STATUS_CLASSES[product.status]">
              {{ STATUS_LABELS[product.status] }}
            </td>
            <td class="muted">{{ day(product.createdAt) }}</td>
          </tr>
        </tbody>
      </table>

      <p v-else class="muted">
        {{
          statusFilter
            ? 'No products with this status.'
            : 'This supplier has no products yet.'
        }}
      </p>
    </section>

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete supplier?"
      :description="`${data.supplier.name} is removed for good. A supplier that still has products cannot be deleted.`"
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

.breadcrumb {
  font-size: var(--text-xs);
}

.header,
.products-header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.products-header {
  align-items: flex-end;
}

.spacer {
  flex-grow: 1;
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.details {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  max-width: 44rem;
}

.row {
  display: flex;
  gap: var(--space-7);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-grow: 1;
}

.logo-row {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.logo {
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
}

.products {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.name-column {
  width: 34%;
}

.price-column,
.status-column,
.date-column {
  width: 8rem;
}
</style>
