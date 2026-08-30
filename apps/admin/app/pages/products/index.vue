<script setup lang="ts">
import type { AdminProductListItem } from '@forge-kivu/api-client'
import { PRODUCT_STATUSES, type ProductStatus } from '@forge-kivu/types'

definePageMeta({ access: 'admin-only' })

const STATUS_LABELS: Record<ProductStatus, string> = {
  [PRODUCT_STATUSES.DRAFT]: 'Draft',
  [PRODUCT_STATUSES.PUBLISHED]: 'Published',
  [PRODUCT_STATUSES.NOT_AVAILABLE]: 'Not available',
}

const STATUS_CLASSES: Record<ProductStatus, string> = {
  [PRODUCT_STATUSES.DRAFT]: 'status-neutral',
  [PRODUCT_STATUSES.PUBLISHED]: 'status-ok',
  [PRODUCT_STATUSES.NOT_AVAILABLE]: 'status-bad',
}

const { list, publish, unpublish } = useProducts()
const { list: listSuppliers } = useSuppliers()

const supplierId = ref('')
const status = ref('')

const { data: suppliers } = await useAsyncData('admin-suppliers-filter', () =>
  listSuppliers(),
)

const { data, error, refresh } = await useAsyncData(
  'admin-products',
  () =>
    list({
      ...(supplierId.value ? { supplierId: supplierId.value } : {}),
      ...(status.value ? { status: status.value as ProductStatus } : {}),
    }),
  { watch: [supplierId, status] },
)

const { pending: acting, error: actionError, run } = useAsyncAction()

const toggle = (row: AdminProductListItem) =>
  run(async () => {
    if (row.status === PRODUCT_STATUSES.PUBLISHED) await unpublish(row.id)
    else await publish(row.id)
    await refresh()
  })

const price = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('en-US')

const count = computed(() => data.value?.length ?? 0)
</script>

<template>
  <section class="page">
    <div class="header">
      <h1>Products</h1>
      <UiButton as-child variant="primary">
        <NuxtLink to="/products/new">New product</NuxtLink>
      </UiButton>
    </div>

    <div class="filters">
      <div class="field">
        <Label for="filter-supplier">Supplier</Label>
        <select id="filter-supplier" v-model="supplierId">
          <option value="">All suppliers</option>
          <option
            v-for="supplier in suppliers ?? []"
            :key="supplier.id"
            :value="supplier.id"
          >
            {{ supplier.name }}
          </option>
        </select>
      </div>

      <div class="field">
        <Label for="filter-status">Status</Label>
        <select id="filter-status" v-model="status">
          <option value="">All</option>
          <option
            v-for="(label, value) in STATUS_LABELS"
            :key="value"
            :value="value"
          >
            {{ label }}
          </option>
        </select>
      </div>

      <div class="spacer" />
      <span class="muted total">
        {{ count }} {{ count === 1 ? 'product' : 'products' }}
      </span>
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
          <th class="image-column">Image</th>
          <th>Product</th>
          <th class="supplier-column">Supplier</th>
          <th class="category-column">Category</th>
          <th class="status-column">Status</th>
          <th class="price-column">From</th>
          <th class="actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in data" :key="row.id">
          <td>
            <span class="thumb">
              <img v-if="row.imageUrl" :src="row.imageUrl" :alt="row.name" />
            </span>
          </td>
          <td>
            <div class="named">
              <NuxtLink class="ellip" :to="`/products/${row.id}`">
                {{ row.name }}
              </NuxtLink>
              <code class="ellip">{{ row.slug }}</code>
            </div>
          </td>
          <td>
            <div class="ellip">{{ row.supplier.name }}</div>
          </td>
          <td>
            <div class="ellip">{{ row.category.name }}</div>
          </td>
          <td class="flag" :class="STATUS_CLASSES[row.status]">
            {{ STATUS_LABELS[row.status] }}
          </td>
          <td>{{ price(row.priceFrom) }}</td>
          <td>
            <div class="actions">
              <UiButton as-child variant="ghost">
                <NuxtLink :to="`/products/${row.id}`">Open</NuxtLink>
              </UiButton>
              <UiButton variant="ghost" :disabled="acting" @click="toggle(row)">
                {{
                  row.status === PRODUCT_STATUSES.PUBLISHED
                    ? 'Unpublish'
                    : 'Publish'
                }}
              </UiButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <p v-else-if="!error" class="muted">No products yet.</p>
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

.filters {
  display: flex;
  align-items: flex-end;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  inline-size: 13rem;
}

.spacer {
  flex-grow: 1;
}

.total {
  font-size: var(--text-xs);
}

.lede {
  font-size: var(--text-xs);
}

.image-column {
  width: 4rem;
}

.supplier-column,
.category-column {
  width: 16%;
}

.status-column {
  width: 9%;
}

.price-column {
  width: 8%;
}

.actions-column {
  width: 10rem;
}

.thumb {
  display: block;
  overflow: hidden;
  inline-size: 2.75rem;
  block-size: 2.25rem;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-canvas);
}

.thumb img {
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
}

.named {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.actions {
  display: flex;
  gap: var(--space-1);
  margin: 0 calc(-1 * var(--space-4));
}
</style>
