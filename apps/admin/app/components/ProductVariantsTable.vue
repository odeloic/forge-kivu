<script setup lang="ts">
import { CATALOGUE_LIMITS } from '@forge-kivu/types'

const variants = defineModel<VariantDraft[]>({ required: true })

const props = withDefaults(
  defineProps<{
    optionNames: string[]
    currency: string
    images?: MediaDraft[]
  }>(),
  { images: () => [] },
)

const showImage = computed(() => props.images.length > 0)
</script>

<template>
  <table>
    <thead>
      <tr>
        <th class="sku-column">SKU</th>
        <th class="price-column">Price ({{ currency }})</th>
        <th v-for="name in optionNames" :key="name">{{ name }}</th>
        <th v-if="showImage" class="image-column">Image</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="variant in variants" :key="variant.key">
        <td>
          <input
            v-model="variant.sku"
            type="text"
            aria-label="SKU"
            :maxlength="CATALOGUE_LIMITS.sku"
          />
        </td>
        <td>
          <input
            v-model="variant.price"
            type="number"
            inputmode="decimal"
            step="0.01"
            min="0"
            aria-label="Price"
          />
        </td>
        <td v-for="(label, index) in variant.labels" :key="index">
          <div class="cell">{{ label }}</div>
        </td>
        <td v-if="showImage">
          <select v-model="variant.imageMediaId" aria-label="Variant image">
            <option :value="null">—</option>
            <option
              v-for="(image, index) in images"
              :key="image.mediaId"
              :value="image.mediaId"
            >
              Image {{ index + 1 }}
            </option>
          </select>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.sku-column {
  width: 12rem;
}

.price-column {
  width: 8rem;
}

.image-column {
  width: 9rem;
}

td input,
td select {
  inline-size: 100%;
}
</style>
