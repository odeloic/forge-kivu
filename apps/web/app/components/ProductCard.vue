<script setup lang="ts">
import type { ProductListItem } from '@forge-kivu/api-client'

const props = defineProps<{ product: ProductListItem }>()

defineEmits<{ add: [] }>()

const detailPath = computed(
  () => `/products/${props.product.supplier.slug}/${props.product.slug}`,
)

const price = computed(() =>
  props.product.priceFrom === null
    ? 'Price on request'
    : formatRwf(props.product.priceFrom),
)
</script>

<template>
  <article class="card">
    <header class="card-header">
      <span class="supplier">{{ product.supplier.name }}</span>
      <button
        type="button"
        class="add"
        :aria-label="`Add ${product.name}`"
        @click="$emit('add')"
      >
        +
      </button>
    </header>
    <NuxtLink :to="detailPath" class="figure">
      <img
        v-if="product.imageUrl"
        :src="product.imageUrl"
        :alt="product.name"
        loading="lazy"
      />
      <span v-else class="no-image">No image</span>
    </NuxtLink>
    <footer class="card-footer">
      <NuxtLink :to="detailPath" class="name">{{ product.name }}</NuxtLink>
      <span class="price">{{ price }}</span>
    </footer>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  border: 1px solid #000;
  background: #fff;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
}

.supplier {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.add {
  border: none;
  background: none;
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
  padding: 0;
}

.figure {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.5rem 1.5rem;
  min-height: 12rem;
}

.figure img {
  max-width: 100%;
  max-height: 14rem;
  object-fit: contain;
}

.no-image {
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-footer {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid #000;
}

.name,
.price {
  padding: 0.6rem 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.name {
  color: inherit;
  text-decoration: none;
}

.price {
  border-left: 1px solid #000;
  font-weight: 700;
  text-align: center;
}
</style>
