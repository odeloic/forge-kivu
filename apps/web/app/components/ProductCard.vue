<script setup lang="ts">
import type { ProductListItem } from '@forge-kivu/api-client'

interface Props {
  product: ProductListItem
}

const props = defineProps<Props>()

defineEmits<{ add: [] }>()

const detailPath = computed(
  () => `/products/${props.product.supplier.slug}/${props.product.slug}`,
)

const price = computed(() =>
  props.product.priceFrom === null
    ? 'On request'
    : formatRwf(props.product.priceFrom),
)
</script>

<template>
  <article class="card">
    <header class="head">
      <span class="eyebrow">{{ product.supplier.name }}</span>
      <UiButton
        variant="ghost"
        class="add"
        :aria-label="`Add ${product.name} to a project`"
        @click="$emit('add')"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 13 13"
          fill="none"
          stroke="currentColor"
          stroke-width="1.3"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6.5 1.5 V11.5 M1.5 6.5 H11.5" />
        </svg>
      </UiButton>
    </header>

    <NuxtLink :to="detailPath" class="figure" tabindex="-1" aria-hidden="true">
      <img
        v-if="product.imageUrl"
        :src="product.imageUrl"
        :alt="product.name"
        loading="lazy"
      />
      <span v-else class="eyebrow">No image</span>
    </NuxtLink>

    <footer class="foot">
      <NuxtLink :to="detailPath" class="name">{{ product.name }}</NuxtLink>
      <span class="price">{{ price }}</span>
    </footer>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  border: var(--border-hairline) solid var(--color-rule);
  background: var(--color-paper);
}

.card:hover {
  border-color: var(--color-rule-strong);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-5);
}

.add {
  padding: var(--space-2);
  color: var(--color-muted);
}

.figure {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-grow: 1;
  min-height: 9.25rem;
  padding: var(--space-4) var(--space-8) var(--space-8);
}

.figure img {
  max-width: 100%;
  max-height: 11rem;
  object-fit: contain;
}

.foot {
  display: grid;
  grid-template-columns: 1fr auto;
  border-top: var(--border-hairline) solid var(--color-rule);
}

.name {
  padding: var(--space-4) var(--space-5);
  color: var(--color-ink);
  font-size: var(--text-sm);
  text-decoration: none;
}

.name:hover {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.price {
  padding: var(--space-4) var(--space-5);
  border-left: var(--border-hairline) solid var(--color-rule);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
