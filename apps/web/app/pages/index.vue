<script setup lang="ts">
import type { ProductListItem } from '@forge-kivu/api-client'

definePageMeta({ access: 'public' })

const api = useApi()

const { query, page, goToPage, clearAll } = useCatalogueFilters()

const { data: products } = await useAsyncData(
  'products',
  async () => {
    const res = await api.catalogue.products.$get({ query: query.value })
    if (!res.ok) return null
    return res.json()
  },
  { watch: [query] },
)

const total = computed(() => products.value?.total ?? 0)

const range = computed(() => {
  const items = products.value?.items.length ?? 0
  if (items === 0) return null
  const pageSize = products.value?.pageSize ?? items
  const first = (page.value - 1) * pageSize + 1
  return { first, last: first + items - 1 }
})

const lastPage = computed(() => {
  const pageSize = products.value?.pageSize ?? 0
  if (pageSize === 0) return 1
  return Math.max(1, Math.ceil(total.value / pageSize))
})

const panelOpen = ref(false)
const target = ref<AddToProjectTarget | null>(null)

const addToProject = (product: ProductListItem) => {
  target.value = { product }
  panelOpen.value = true
}
</script>

<template>
  <div class="catalogue">
    <ProductFilters />

    <section class="results">
      <header class="masthead">
        <h1>Catalogue</h1>
        <span class="muted count">
          {{ total === 1 ? '1 product' : `${total} products` }}
        </span>
      </header>

      <ProductFilterChips />

      <div v-if="products?.items.length" class="products">
        <ProductCard
          v-for="product in products.items"
          :key="product.id"
          :product="product"
          @add="addToProject(product)"
        />
      </div>

      <div v-else class="empty">
        <p class="note">No product matches every filter.</p>
        <UiButton @click="clearAll">Clear all filters</UiButton>
      </div>

      <nav v-if="range && lastPage > 1" class="pagination">
        <span class="muted count">
          {{ range.first }} – {{ range.last }} of {{ total }}
        </span>
        <UiButton :disabled="page <= 1" @click="goToPage(page - 1)">
          Previous
        </UiButton>
        <UiButton :disabled="page >= lastPage" @click="goToPage(page + 1)">
          Next
        </UiButton>
      </nav>
    </section>

    <AddToProjectDialog v-model:open="panelOpen" :target="target" />
  </div>
</template>

<style scoped>
.catalogue {
  display: grid;
  grid-template-columns: 18rem 1fr;
  align-items: start;
}

.results {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  min-width: 0;
  padding: var(--space-10) var(--space-11) var(--space-12);
}

.masthead {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
}

.count {
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.products {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: var(--space-9);
  align-content: start;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-7);
  padding: var(--space-12) 0;
}

.pagination {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding-top: var(--space-4);
}

.pagination .count {
  flex-grow: 1;
}

@media (max-width: 56.25rem) {
  .catalogue {
    grid-template-columns: 1fr;
  }

  .results {
    padding: var(--space-9) var(--space-9) var(--space-11);
  }
}
</style>
