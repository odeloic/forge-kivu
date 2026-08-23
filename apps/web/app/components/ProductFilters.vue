<script setup lang="ts">
const { data: facets } = await useProductFacets()

const MATERIALS = ['Steel', 'Plastic', 'Aluminum', 'Wood']

const COLORS = [
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Orange', hex: '#f97316' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Black', hex: '#000000' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Grey', hex: '#9ca3af' },
  { name: 'Brown', hex: '#7c3f00' },
  { name: 'Beige', hex: '#d6c3a1' },
  { name: 'Green', hex: '#16a34a' },
  { name: 'Purple', hex: '#7e22ce' },
]

const BRANDS = ['Woodhabitat', 'Izihirwe', 'Flos', 'Astro']

const SPACES = [
  'Living room',
  'Bedroom',
  'Office',
  'Dining',
  'Bathroom',
  'Outdoor',
]
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

    <fieldset class="section">
      <legend>Materials</legend>
      <div class="grid-2">
        <label v-for="material in MATERIALS" :key="material">
          <input type="checkbox" /> {{ material }}
        </label>
      </div>
    </fieldset>

    <fieldset class="section">
      <legend>Color</legend>
      <div class="grid-2">
        <label v-for="color in COLORS" :key="color.name">
          <span class="swatch" :style="{ background: color.hex }" />
          {{ color.name }}
        </label>
      </div>
    </fieldset>

    <fieldset class="section">
      <legend>Brand</legend>
      <ul class="brands">
        <li v-for="brand in BRANDS" :key="brand">{{ brand }}</li>
      </ul>
    </fieldset>

    <fieldset class="section">
      <legend>Space</legend>
      <div class="grid-2">
        <label v-for="space in SPACES" :key="space">
          <input type="checkbox" /> {{ space }}
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
  color: #666;
}
</style>
