<script setup lang="ts">
import type { AdminProductListItem } from '@forge-kivu/api-client'

const props = defineProps<{ supplierId: string }>()

const { list } = useProducts()
const { load: loadSettings } = useSettings()

const { data, error } = await useAsyncData(
  () => `admin-supplier-products-${props.supplierId}`,
  async () => {
    const [products, settings] = await Promise.all([
      list({ supplierId: props.supplierId }),
      loadSettings(),
    ])
    return { products, settings }
  },
  { watch: [() => props.supplierId] },
)

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

const day = (value: string) =>
  new Intl.DateTimeFormat(data.value?.settings.locale, {
    dateStyle: 'medium',
  }).format(new Date(value))
</script>

<template>
  <div class="products">
    <p v-if="error" class="note status-bad" role="alert">
      {{ errorMessage(toErrorCode(error)) }}
    </p>

    <div class="products-header">
      <span class="muted count">
        {{ data?.products.length ?? 0 }}
        {{ data?.products.length === 1 ? 'product' : 'products' }}
        from this supplier
      </span>
      <div class="spacer" />
      <div class="field">
        <Label for="product-status">Status</Label>
        <select id="product-status" v-model="statusFilter">
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

    <p v-else-if="!error" class="muted">
      {{
        statusFilter
          ? 'No products with this status.'
          : 'This supplier has no products yet.'
      }}
    </p>
  </div>
</template>

<style scoped>
.products {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.products-header {
  display: flex;
  align-items: flex-end;
  gap: var(--space-7);
}

.count {
  padding-block-end: var(--space-3);
  font-size: var(--text-xs);
}

.spacer {
  flex-grow: 1;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
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
