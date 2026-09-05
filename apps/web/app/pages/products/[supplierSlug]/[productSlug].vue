<script setup lang="ts">
import type { ProductOption, ProductVariant } from '@forge-kivu/api-client'

definePageMeta({ access: 'public' })

const route = useRoute()
const router = useRouter()
const api = useApi()

const params = computed(() => ({
  supplierSlug: String(route.params.supplierSlug),
  productSlug: String(route.params.productSlug),
}))

const { data: product, error } = await useAsyncData(
  () => `product-${params.value.supplierSlug}-${params.value.productSlug}`,
  async () => {
    const res = await api.catalogue.products[':supplierSlug'][
      ':productSlug'
    ].$get({ param: params.value })
    if (!res.ok) throw toNuxtError((await toApiError(res)).code)
    return res.json()
  },
  { watch: [params] },
)

if (error.value) throw error.value

const {
  options,
  variants,
  variant,
  price,
  imageUrl,
  isSelected,
  select,
  selectVariant,
} = useProductVariant(product)

const panelOpen = ref(false)
const askVariant = ref(false)

const target = computed<AddToProjectTarget | null>(() =>
  product.value
    ? {
        product: product.value,
        variant: askVariant.value ? undefined : variant.value,
      }
    : null,
)

const openPanel = () => {
  askVariant.value = false
  panelOpen.value = true
}

onMounted(() => {
  const add = route.query.add
  if (typeof add !== 'string') return

  if (add) selectVariant(add)
  askVariant.value = add === ''
  panelOpen.value = true

  const query = { ...route.query }
  delete query.add
  void router.replace({ query })
})

const valueOf = (row: ProductVariant, option: ProductOption): string | null =>
  option.values.find((value) => row.optionValueIds.includes(value.id))?.value ??
  null

const selectedValue = (option: ProductOption): string =>
  option.values.find((value) => isSelected(option.id, value.id))?.id ?? ''

const specTitle = (spec: { name: string; unit: string | null }): string =>
  spec.unit ? `${spec.name} (${spec.unit})` : spec.name
</script>

<template>
  <article v-if="product" class="product">
    <nav class="breadcrumb">
      <UiButton as-child variant="ghost" class="back">
        <NuxtLink to="/">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M7 2 L3 6 L7 10" />
          </svg>
          <span>Catalogue</span>
        </NuxtLink>
      </UiButton>
      <span class="muted trail">{{ product.category.name }}</span>
    </nav>

    <div class="overview">
      <div class="gallery">
        <div class="stage">
          <img
            v-if="imageUrl"
            :src="imageUrl"
            :alt="product.name"
            loading="lazy"
          />
          <span v-else class="eyebrow">No image</span>
        </div>
        <div v-if="product.media.length > 1" class="thumbs">
          <img
            v-for="item in product.media"
            :key="item.mediaId"
            :src="item.url"
            :alt="product.name"
            class="thumb"
            loading="lazy"
          />
        </div>
      </div>

      <div class="info">
        <div class="heading">
          <NuxtLink
            :to="`/suppliers/${product.supplier.slug}`"
            class="eyebrow supplier"
          >
            {{ product.supplier.name }}
          </NuxtLink>
          <h1 class="title">{{ product.name }}</h1>
        </div>

        <div class="pricing">
          <span class="price">{{ price }}</span>
          <code v-if="variant?.sku">{{ variant.sku }}</code>
        </div>

        <p v-if="product.description" class="muted description">
          {{ product.description }}
        </p>

        <fieldset v-for="option in options" :key="option.id" class="option">
          <legend>{{ option.name }}</legend>
          <ToggleGroupRoot
            :model-value="selectedValue(option)"
            type="single"
            class="pills"
            @update:model-value="select(option.id, String($event))"
          >
            <ToggleGroupItem
              v-for="value in option.values"
              :key="value.id"
              :value="value.id"
              class="pill"
            >
              {{ value.value }}
            </ToggleGroupItem>
          </ToggleGroupRoot>
        </fieldset>

        <p v-if="!variant" class="note status-warn" role="status">
          This combination is not available.
        </p>

        <div class="actions">
          <UiButton variant="primary" :disabled="!variant" @click="openPanel">
            Add to project
          </UiButton>
          <UiButton as-child>
            <NuxtLink to="/contact">Ask about this product</NuxtLink>
          </UiButton>
        </div>
      </div>
    </div>

    <div class="panels">
      <section v-if="product.specs.length" class="panel">
        <h2>Specification</h2>
        <table>
          <thead>
            <tr>
              <th class="attribute-column">Attribute</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="spec in product.specs" :key="spec.attributeId">
              <td class="muted">{{ specTitle(spec) }}</td>
              <td>{{ spec.value }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section v-if="options.length" class="panel">
        <h2>Variants</h2>
        <table>
          <thead>
            <tr>
              <th class="sku-column">SKU</th>
              <th v-for="option in options" :key="option.id">
                {{ option.name }}
              </th>
              <th class="price-column">Price</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in variants" :key="row.id">
              <td>
                <code v-if="row.sku">{{ row.sku }}</code>
                <span v-else class="muted">—</span>
              </td>
              <td v-for="option in options" :key="option.id">
                {{ valueOf(row, option) ?? '—' }}
              </td>
              <td class="numeric">
                {{ row.price === null ? '—' : formatRwf(row.price) }}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <AddToProjectDialog v-model:open="panelOpen" :target="target" />
  </article>
</template>

<style scoped>
.product {
  display: flex;
  flex-direction: column;
  gap: var(--space-11);
  padding: var(--space-9) var(--space-11) var(--space-12);
}

.product > * {
  min-width: 0;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.back {
  gap: var(--space-4);
  margin-left: calc(-1 * var(--space-4));
  text-decoration: none;
}

.trail {
  font-size: var(--text-xs);
}

.overview {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  align-items: start;
  gap: var(--space-12);
}

.gallery {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-width: 0;
}

.stage {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 4 / 3;
  max-height: 34rem;
  padding: var(--space-9);
  border: var(--border-hairline) solid var(--color-rule);
}

.stage img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.thumbs {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-5);
}

.thumb {
  width: 4rem;
  height: 4rem;
  padding: var(--space-3);
  border: var(--border-hairline) solid var(--color-rule);
  object-fit: contain;
}

.info {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
  min-width: 0;
}

.heading {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.supplier {
  color: var(--color-muted);
  text-decoration: none;
}

.supplier:hover {
  color: var(--color-ink);
}

.title {
  font-size: var(--text-xl);
  line-height: var(--leading-tight);
}

.pricing {
  display: flex;
  align-items: baseline;
  gap: var(--space-6);
}

.price {
  font-size: var(--text-xl);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-tight);
  font-variant-numeric: tabular-nums;
}

.description {
  max-width: 42ch;
}

.option {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: 0;
  border: 0;
}

.option legend {
  padding: 0;
}

.pills {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
}

.pill {
  padding: var(--space-4) var(--space-6);
  border: var(--border-hairline) solid var(--color-control-border);
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: var(--text-xs);
  cursor: pointer;
}

.pill:hover {
  border-color: var(--color-rule-strong);
}

.pill[data-state='on'] {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: var(--color-paper);
  font-weight: var(--weight-medium);
}

.actions {
  display: flex;
  gap: var(--space-5);
}

.panels {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(24rem, 1fr));
  align-items: start;
  gap: var(--space-11) var(--space-12);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  min-width: 0;
}

.attribute-column {
  width: 30%;
}

.sku-column {
  width: 12rem;
}

.price-column {
  width: 9rem;
}

.numeric {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 56.25rem) {
  .product {
    gap: var(--space-10);
    padding: var(--space-9) var(--space-9) var(--space-11);
  }

  .overview {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-10);
  }

  .stage {
    aspect-ratio: 1 / 1;
    max-height: 20rem;
    padding: var(--space-7);
  }

  .actions {
    flex-wrap: wrap;
  }
}
</style>
