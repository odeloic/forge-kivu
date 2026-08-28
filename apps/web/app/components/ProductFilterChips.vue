<script setup lang="ts">
const { data: facets } = await useProductFacets()

const {
  category,
  supplier,
  price,
  specValues,
  toggleCategory,
  toggleSupplier,
  toggleSpec,
  clearPrice,
} = useCatalogueFilters()

type Chip = { key: string; label: string; drop: () => void }

const chips = computed<Chip[]>(() => {
  const rows: Chip[] = []

  const chosenCategory = facets.value?.categories.find(
    (row) => row.slug === category.value,
  )
  if (chosenCategory) {
    rows.push({
      key: `category:${chosenCategory.slug}`,
      label: chosenCategory.name,
      drop: () => toggleCategory(chosenCategory.slug),
    })
  }

  const chosenSupplier = facets.value?.suppliers.find(
    (row) => row.slug === supplier.value,
  )
  if (chosenSupplier) {
    rows.push({
      key: `supplier:${chosenSupplier.slug}`,
      label: chosenSupplier.name,
      drop: () => toggleSupplier(chosenSupplier.slug),
    })
  }

  const { min, max } = price.value
  if (min !== undefined || max !== undefined) {
    const bounds = facets.value?.price
    const low = min ?? bounds?.min ?? 0
    const high = max ?? bounds?.max ?? 0
    rows.push({
      key: 'price',
      label: `${formatRwf(low)} – ${formatRwf(high)}`,
      drop: clearPrice,
    })
  }

  for (const attribute of facets.value?.attributes ?? []) {
    for (const value of specValues(attribute.slug)) {
      rows.push({
        key: `${attribute.slug}:${value}`,
        label: `${attribute.name}: ${value}`,
        drop: () => toggleSpec(attribute.slug, value),
      })
    }
  }

  return rows
})
</script>

<template>
  <div v-if="chips.length" class="chips">
    <span class="eyebrow">Filtering by</span>
    <button
      v-for="chip in chips"
      :key="chip.key"
      type="button"
      class="chip"
      @click="chip.drop"
    >
      <span>{{ chip.label }}</span>
      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        stroke="currentColor"
        stroke-width="1.2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M1 1 L8 8 M8 1 L1 8" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
}

.chip {
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
  border-color: var(--color-control-border);
  background: var(--color-paper);
  font-size: var(--text-2xs);
  font-weight: var(--weight-regular);
}

.chip:hover {
  border-color: var(--color-rule-strong);
  background: var(--color-canvas);
}
</style>
