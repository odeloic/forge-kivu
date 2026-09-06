<script setup lang="ts">
import type { FilterOption, LineFilters } from '../composables/useLineFilters'
import { LINE_SHOW, type LineShow } from '../utils/lines'

const props = defineProps<{ filters: LineFilters }>()

type FacetKey = 'show' | 'category' | 'supplier' | 'space'

type Facet = {
  key: FacetKey
  label: string
  selected: string
  options: FilterOption[]
}

const facets = computed<Facet[]>(() => [
  {
    key: 'show',
    label: 'Show',
    selected: props.filters.show === LINE_SHOW.ALL ? '' : props.filters.show,
    options: props.filters.showOptions.filter(
      (option) => option.value !== LINE_SHOW.ALL,
    ),
  },
  {
    key: 'category',
    label: 'Category',
    selected: props.filters.category ?? '',
    options: props.filters.categoryOptions,
  },
  {
    key: 'supplier',
    label: 'Supplier',
    selected: props.filters.supplier ?? '',
    options: props.filters.supplierOptions,
  },
  {
    key: 'space',
    label: 'Space',
    selected: props.filters.space ?? '',
    options: props.filters.spaceOptions,
  },
])

const pick = (key: FacetKey, event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  if (key === 'show') {
    props.filters.setShow(value ? (value as LineShow) : LINE_SHOW.ALL)
    return
  }
  props.filters.setFacet(key, value || null)
}
</script>

<template>
  <div class="filters">
    <div class="row">
      <div v-for="facet in facets" :key="facet.key" class="field">
        <Label :for="`filter-${facet.key}`">{{ facet.label }}</Label>
        <select
          :id="`filter-${facet.key}`"
          class="facet"
          :class="facet.key"
          :value="facet.selected"
          @change="pick(facet.key, $event)"
        >
          <option value="">All</option>
          <option
            v-for="option in facet.options"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }} · {{ option.count }}
          </option>
        </select>
      </div>
    </div>

    <div v-if="props.filters.isFiltered" class="chips">
      <span class="eyebrow">Filtering by</span>
      <button
        v-for="chip in props.filters.chips"
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
      <UiButton variant="ghost" class="clear" @click="props.filters.clearAll">
        Clear all
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-4);
  padding-block-start: var(--space-2);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.facet.show,
.facet.space {
  inline-size: 8.125rem;
}

.facet.category {
  inline-size: 9.375rem;
}

.facet.supplier {
  inline-size: 10.5rem;
}

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

.clear {
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-2xs);
}
</style>
