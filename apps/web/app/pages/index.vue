<script setup lang="ts">
definePageMeta({ access: 'public' })

const api = useApi()

const { query } = useCatalogueFilters()

const { data: products } = await useAsyncData(
  'products',
  async () => {
    const res = await api.catalogue.products.$get({ query: query.value })
    if (!res.ok) return null
    return res.json()
  },
  { watch: [query] },
)
</script>

<template>
  <div class="catalogue">
    <ProductFilters />
    <section class="products">
      <ProductCard
        v-for="product in products?.items"
        :key="product.id"
        :product="product"
      />
    </section>
  </div>
</template>

<style scoped>
.catalogue {
  display: grid;
  grid-template-columns: 1fr 3fr;
}

.products {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-content: start;
}
</style>
