<script setup lang="ts">
const { data: facets } = await useProductFacets()

const {
  category,
  supplier,
  price,
  specValues,
  isFiltered,
  toggleCategory,
  toggleSupplier,
  setPrice,
  clearAll,
} = useCatalogueFilters()

const sections = computed(() => {
  const attributes = facets.value?.attributes ?? []
  const filtered = attributes
    .map((attribute) => attribute.slug)
    .filter((slug) => specValues(slug).length > 0)
  return splitAttributes(attributes, filtered)
})

const bounds = computed(() => facets.value?.price ?? null)

const sliderValue = computed({
  get: (): number[] => {
    const range = bounds.value
    if (!range) return []
    return [price.value.min ?? range.min, price.value.max ?? range.max]
  },
  set: ([min, max]: number[]) => {
    const range = bounds.value
    if (!range || min === undefined || max === undefined) return
    setPrice({ min, max }, range)
  },
})

const step = computed(() => {
  const range = bounds.value
  if (!range) return 1
  return Math.max(1, Math.round((range.max - range.min) / 100))
})

const moreOpen = ref(false)
</script>

<template>
  <aside class="filters">
    <div class="masthead">
      <h2>Filter</h2>
      <UiButton v-if="isFiltered" variant="ghost" @click="clearAll">
        Clear all
      </UiButton>
    </div>

    <fieldset v-if="facets?.categories.length" class="section">
      <legend>Category</legend>
      <ToggleGroupRoot
        :model-value="category ?? ''"
        type="single"
        class="options"
        @update:model-value="toggleCategory(String($event))"
      >
        <ToggleGroupItem
          v-for="row in facets.categories"
          :key="row.slug"
          :value="row.slug"
          class="option"
        >
          <span class="option-label">{{ row.name }}</span>
          <span class="count">{{ row.count }}</span>
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </fieldset>

    <fieldset v-if="facets?.suppliers.length" class="section">
      <legend>Brand</legend>
      <ToggleGroupRoot
        :model-value="supplier ?? ''"
        type="single"
        class="options"
        @update:model-value="toggleSupplier(String($event))"
      >
        <ToggleGroupItem
          v-for="row in facets.suppliers"
          :key="row.slug"
          :value="row.slug"
          class="option"
        >
          <span class="option-label">{{ row.name }}</span>
          <span class="count">{{ row.count }}</span>
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </fieldset>

    <fieldset v-if="bounds && bounds.max > bounds.min" class="section">
      <legend>Price</legend>
      <div class="bounds">
        <span>{{ formatRwf(sliderValue[0] ?? bounds.min) }}</span>
        <span>{{ formatRwf(sliderValue[1] ?? bounds.max) }}</span>
      </div>
      <SliderRoot
        v-model="sliderValue"
        :min="bounds.min"
        :max="bounds.max"
        :step="step"
        :min-steps-between-thumbs="1"
        class="slider"
      >
        <SliderTrack class="track">
          <SliderRange class="range" />
        </SliderTrack>
        <SliderThumb class="thumb" aria-label="Lowest price" />
        <SliderThumb class="thumb" aria-label="Highest price" />
      </SliderRoot>
    </fieldset>

    <ProductFilterAttribute
      v-for="attribute in sections.surfaced"
      :key="attribute.slug"
      :attribute="attribute"
    />

    <CollapsibleRoot v-if="sections.rest.length" v-model:open="moreOpen">
      <CollapsibleTrigger as-child>
        <UiButton variant="ghost" class="more">
          {{
            moreOpen
              ? `Hide the other ${sections.rest.length} specification filters`
              : `${sections.rest.length} more specification filters`
          }}
        </UiButton>
      </CollapsibleTrigger>
      <CollapsibleContent class="rest">
        <ProductFilterAttribute
          v-for="attribute in sections.rest"
          :key="attribute.slug"
          :attribute="attribute"
        />
      </CollapsibleContent>
    </CollapsibleRoot>
  </aside>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-10) var(--space-9) var(--space-12);
  border-right: var(--border-hairline) solid var(--color-rule);
}

.masthead {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
}

.masthead h2 {
  flex-grow: 1;
}

.section {
  padding: var(--space-7) 0 0;
  border: 0;
  border-top: var(--border-hairline) solid var(--color-rule);
}

.section legend {
  padding: 0;
}

.options {
  display: flex;
  flex-direction: column;
  padding-top: var(--space-2);
}

.option {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
}

.option:hover .option-label {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.option[data-state='on'] {
  font-weight: var(--weight-medium);
}

.option-label {
  flex-grow: 1;
}

.count {
  color: var(--color-faint);
  font-size: var(--text-2xs);
  font-variant-numeric: tabular-nums;
}

.bounds {
  display: flex;
  justify-content: space-between;
  padding: var(--space-4) 0 var(--space-5);
  color: var(--color-muted);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
}

.slider {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--space-8);
  touch-action: none;
  user-select: none;
}

.track {
  position: relative;
  flex-grow: 1;
  height: var(--border-hairline);
  background: var(--color-field-border);
}

.range {
  position: absolute;
  height: 100%;
  background: var(--color-ink);
}

.thumb {
  display: block;
  width: var(--space-6);
  height: var(--space-6);
  border: var(--border-hairline) solid var(--color-ink);
  border-radius: 50%;
  background: var(--color-paper);
  cursor: grab;
}

.thumb:focus-visible {
  outline: var(--focus-width-strong) solid var(--color-accent);
  outline-offset: var(--focus-offset);
}

.more {
  padding-left: 0;
  padding-right: 0;
}

.rest {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding-top: var(--space-8);
}
</style>
