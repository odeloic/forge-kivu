<script setup lang="ts">
import type { ProductFacets } from '@forge-kivu/api-client'

type AttributeFacet = ProductFacets['attributes'][number]

const { data: facets } = await useProductFacets()

const { supplier, specValues, toggleSupplier, toggleSpec } =
  useCatalogueFilters()

const COLOR_SLUGS = ['colour', 'color']

const COLOR_HEXES: Record<string, string> = {
  Blue: '#1d4ed8',
  White: '#ffffff',
  Orange: '#f97316',
  Pink: '#ec4899',
  Red: '#dc2626',
  Black: '#000000',
  Yellow: '#facc15',
  Grey: '#9ca3af',
  Brown: '#7c3f00',
  Beige: '#d6c3a1',
  Green: '#16a34a',
  Purple: '#7e22ce',
}

const sectionTitle = (attribute: AttributeFacet): string =>
  attribute.unit ? `${attribute.name} (${attribute.unit})` : attribute.name
</script>

<template>
  <aside class="filters">
    <h2 class="title">Filter</h2>

    <fieldset v-if="facets?.price" class="section">
      <legend>Price</legend>
      <div class="price-bounds">
        <span>{{ formatRwf(facets.price.min) }}</span>
        <span>{{ formatRwf(facets.price.max) }}</span>
      </div>
      <input type="range" :min="facets.price.min" :max="facets.price.max" />
    </fieldset>

    <fieldset class="section">
      <legend>Availability</legend>
      <label><input type="checkbox" /> In stock</label>
      <label><input type="checkbox" /> By request</label>
    </fieldset>

    <fieldset v-if="facets && facets.suppliers.length > 0" class="section">
      <legend>Brand</legend>
      <ul class="brands">
        <li v-for="brand in facets.suppliers" :key="brand.slug">
          <button
            type="button"
            class="brand"
            :class="{ active: supplier === brand.slug }"
            @click="toggleSupplier(brand.slug)"
          >
            {{ brand.name }} ({{ brand.count }})
          </button>
        </li>
      </ul>
    </fieldset>

    <fieldset
      v-for="attribute in facets?.attributes"
      :key="attribute.slug"
      class="section"
    >
      <legend>{{ sectionTitle(attribute) }}</legend>
      <div class="grid-2">
        <label v-for="value in attribute.values" :key="value.value">
          <input
            type="checkbox"
            :checked="specValues(attribute.slug).includes(value.value)"
            @change="toggleSpec(attribute.slug, value.value)"
          />
          <span
            v-if="COLOR_SLUGS.includes(attribute.slug)"
            class="swatch"
            :style="{ background: COLOR_HEXES[value.value] }"
          />
          {{ value.value }} ({{ value.count }})
        </label>
      </div>
    </fieldset>
  </aside>
</template>

<style scoped>
.filters {
  border-right: 2px solid #000;
  padding: 1rem 1.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.title {
  margin: 0 0 1rem;
  font-size: 1.5rem;
}

.section {
  border: none;
  border-top: 1px solid #000;
  margin: 0;
  padding: 0.75rem 0 1.25rem;
}

.section legend {
  float: right;
  font-weight: 600;
  padding: 0.25rem 0 0.5rem;
}

.section legend + * {
  clear: both;
}

.section label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.2rem 0;
  color: #666;
}

.price-bounds {
  display: flex;
  justify-content: space-between;
  color: #666;
}

.section input[type='range'] {
  width: 100%;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
}

.swatch {
  width: 1rem;
  height: 1rem;
  border: 1px solid #000;
  flex-shrink: 0;
}

.brands {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.brand {
  border: none;
  background: none;
  padding: 0;
  font: inherit;
  text-transform: inherit;
  letter-spacing: inherit;
  color: #666;
  cursor: pointer;
}

.brand.active {
  color: #000;
  font-weight: 600;
  text-decoration: underline;
}
</style>
