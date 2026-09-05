<script setup lang="ts">
import type { ProductOption, ProductVariant } from '@forge-kivu/api-client'

interface Props {
  variants: ProductVariant[]
  options: ProductOption[]
}

const chosen = defineModel<string | null>({ required: true })

const props = defineProps<Props>()

const rows = computed(() =>
  props.variants.map((variant) => ({
    id: variant.id,
    label: variantLabel(variant, props.options) || (variant.sku ?? 'Variant'),
    price: variant.price === null ? 'On request' : formatAmount(variant.price),
  })),
)
</script>

<template>
  <fieldset class="variants">
    <legend>Variant</legend>
    <ul class="rows">
      <li v-for="row in rows" :key="row.id">
        <label class="row" :class="{ picked: chosen === row.id }">
          <input
            v-model="chosen"
            type="radio"
            name="add-variant"
            :value="row.id"
          />
          <span class="ellip label">{{ row.label }}</span>
          <span class="price">{{ row.price }}</span>
        </label>
      </li>
    </ul>
  </fieldset>
</template>

<style scoped>
.variants {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.rows {
  display: flex;
  flex-direction: column;
  max-block-size: 17rem;
  overflow-y: auto;
  border-block-start: var(--border-hairline) solid var(--color-rule);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-4) var(--space-2);
  border-block-end: var(--border-hairline) solid var(--color-rule);
  font-size: var(--text-sm);
  cursor: pointer;
}

.row:hover {
  background: var(--color-canvas);
}

.row.picked {
  font-weight: var(--weight-medium);
}

.label {
  flex-grow: 1;
  min-inline-size: 0;
}

.ellip {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.price {
  flex: none;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}
</style>
