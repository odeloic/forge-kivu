<script setup lang="ts">
import type { AdminProductDetail } from '@forge-kivu/api-client'

definePageMeta({ access: 'admin-only' })

const STEPS = [
  { index: 1, label: 'Details' },
  { index: 2, label: 'Options' },
  { index: 3, label: 'Variants' },
  { index: 4, label: 'Specs & media' },
  { index: 5, label: 'Review' },
] as const

const { setOptions, setVariants, setSpecs, setMedia, publish } = useProducts()
const { list: listSuppliers } = useSuppliers()
const { tree, attributes, units: listUnits } = useTaxonomy()
const { settings, load: loadSettings } = useSettings()

const [suppliers, categories, specAttributes, units] = await Promise.all([
  useAsyncData('wizard-suppliers', () => listSuppliers()),
  useAsyncData('wizard-categories', () => tree()),
  useAsyncData('wizard-attributes', () => attributes()),
  useAsyncData('wizard-units', () => listUnits()),
])
await loadSettings()

const categoryRows = computed(() => flattenTree(categories.data.value ?? []))
const currency = computed(() => settings.value?.currency ?? '')

const product = ref<AdminProductDetail | null>(null)
const step = ref(1)
const done = ref(0)
const noOptions = ref(false)

const sections = useProductSections(
  product,
  {
    options: async (input) => {
      if (product.value)
        product.value = await setOptions(product.value.id, input)
    },
    variants: async (input) => {
      if (product.value)
        product.value = await setVariants(product.value.id, input)
    },
    specs: async (input) => {
      if (product.value) product.value = await setSpecs(product.value.id, input)
    },
    media: async (input) => {
      if (product.value) product.value = await setMedia(product.value.id, input)
    },
  },
  units.data,
)

const rail = computed(() =>
  STEPS.map((entry) => {
    const unlocked = entry.index <= done.value + 1
    const state =
      entry.index === step.value
        ? 'Editing'
        : entry.index <= done.value
          ? 'Saved'
          : entry.index === done.value + 1
            ? 'Next'
            : 'Locked'
    return {
      ...entry,
      state,
      lit: entry.index === step.value || entry.index <= done.value,
      unlocked,
    }
  }),
)

const goto = (index: number) => {
  if (index <= done.value + 1) step.value = index
}

const advance = () => {
  done.value = Math.max(done.value, step.value)
  step.value = Math.min(5, step.value + 1)
}

const created = (saved: AdminProductDetail) => {
  product.value = saved
  advance()
}

const { pending: saving, error: actionError, run } = useAsyncAction()

const saveStep = () =>
  run(async () => {
    if (step.value === 2 && (await sections.saveOptions())) advance()
    else if (step.value === 3 && (await sections.saveVariants())) advance()
    else if (step.value === 4) {
      if (await sections.saveSpecs()) {
        await sections.saveMedia()
        advance()
      }
    }
  })

const publishNow = () =>
  run(async () => {
    if (!product.value) return
    await publish(product.value.id)
    await navigateTo(`/products/${product.value.id}`)
  })

const uploading = ref(false)

const nextLabel = computed(() => {
  if (step.value === 1) return 'Create draft & continue'
  if (step.value === 2) {
    return noOptions.value
      ? 'Skip options & continue'
      : 'Save options & continue'
  }
  if (step.value === 3) return 'Save variants & continue'
  return 'Save specs, media & continue'
})

watch(noOptions, (value) => {
  if (value) sections.options.value = []
})

const priced = computed(
  () =>
    (product.value?.variants ?? []).filter((variant) => variant.price !== null)
      .length,
)
</script>

<template>
  <section class="page">
    <p class="breadcrumb">
      <NuxtLink to="/products">Products</NuxtLink>
      <span class="muted"> / {{ product?.name ?? 'New product' }}</span>
    </p>

    <div class="header">
      <h1>{{ product?.name ?? 'New product' }}</h1>
      <span v-if="product" class="flag status-neutral">Draft</span>
      <div class="spacer" />
      <span class="muted counter">Step {{ step }} of 5</span>

      <UiButton v-if="product" as-child variant="ghost">
        <NuxtLink :to="`/products/${product.id}`">Save &amp; exit</NuxtLink>
      </UiButton>

      <UiButton :disabled="step === 1" @click="step -= 1">Back</UiButton>

      <UiButton
        v-if="step === 1"
        type="submit"
        form="wizard-details"
        variant="primary"
      >
        {{ nextLabel }}
      </UiButton>
      <UiButton
        v-else-if="step < 5"
        variant="primary"
        :disabled="saving"
        @click="saveStep"
      >
        {{ saving ? 'Saving…' : nextLabel }}
      </UiButton>
      <template v-else>
        <UiButton as-child>
          <NuxtLink :to="`/products/${product?.id}`">Finish as draft</NuxtLink>
        </UiButton>
        <UiButton variant="primary" :disabled="saving" @click="publishNow">
          {{ saving ? 'Publishing…' : 'Publish' }}
        </UiButton>
      </template>
    </div>

    <ol class="rail">
      <li v-for="entry in rail" :key="entry.index" class="rail-step">
        <button
          type="button"
          class="rail-button"
          :class="{ lit: entry.lit }"
          :disabled="!entry.unlocked"
          @click="goto(entry.index)"
        >
          <span class="rail-label">{{ entry.index }} · {{ entry.label }}</span>
          <span
            class="rail-state"
            :class="`state-${entry.state.toLowerCase()}`"
          >
            {{ entry.state }}
          </span>
        </button>
      </li>
    </ol>

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>
    <p v-if="sections.issue.value" class="note status-bad" role="alert">
      {{ sections.issue.value }}
    </p>

    <template v-if="step === 1">
      <ProductDetailsForm
        form-id="wizard-details"
        :product="null"
        :suppliers="suppliers.data.value ?? []"
        :categories="categoryRows"
        @saved="created"
      />
    </template>

    <template v-else-if="step === 2">
      <fieldset class="section">
        <legend>Options</legend>
        <label class="choice">
          <input v-model="noOptions" type="checkbox" />
          This product is sold one way only — no options
        </label>
        <ProductOptionsFields
          v-if="!noOptions"
          v-model="sections.options.value"
          @add="sections.addOption"
          @remove="sections.removeOption"
        />
      </fieldset>
    </template>

    <template v-else-if="step === 3">
      <fieldset class="section">
        <legend>Variants</legend>
        <ProductVariantsTable
          v-model="sections.variants.value"
          :option-names="sections.optionNames.value"
          :currency="currency"
          :units="units.data.value ?? []"
        />
      </fieldset>
    </template>

    <template v-else-if="step === 4">
      <fieldset class="section">
        <legend>Specs</legend>
        <ProductSpecsTable
          v-model="sections.specs.value"
          :attributes="specAttributes.data.value ?? []"
          @add="sections.addSpec"
          @remove="sections.removeSpec"
        />
      </fieldset>

      <fieldset class="section">
        <legend>Media</legend>
        <div class="media-header">
          <div class="spacer" />
          <UiButton variant="primary" @click="uploading = true">
            Add images
          </UiButton>
        </div>
        <ProductMediaList
          v-if="sections.media.value.length"
          v-model="sections.media.value"
          @remove="sections.removeMedia"
          @move="sections.moveMedia"
        />
      </fieldset>
    </template>

    <template v-else>
      <fieldset class="section">
        <legend>Review</legend>
        <dl class="review">
          <div class="review-row">
            <dt>Supplier</dt>
            <dd>{{ product?.supplier.name }}</dd>
          </div>
          <div class="review-row">
            <dt>Category</dt>
            <dd>{{ product?.category.name }}</dd>
          </div>
          <div class="review-row">
            <dt>Name and slug</dt>
            <dd>{{ product?.name }} · {{ product?.slug }}</dd>
          </div>
          <div class="review-row">
            <dt>Options</dt>
            <dd>
              {{
                sections.optionNames.value.length
                  ? sections.optionNames.value.join(', ')
                  : 'None'
              }}
            </dd>
          </div>
          <div class="review-row">
            <dt>Variants</dt>
            <dd>
              {{ sections.variants.value.length }}
              {{
                sections.variants.value.length === 1 ? 'variant' : 'variants'
              }}, {{ priced }} priced
            </dd>
          </div>
          <div class="review-row">
            <dt>Specs</dt>
            <dd :class="{ 'status-warn': sections.specs.value.length === 0 }">
              {{
                sections.specs.value.length
                  ? `${sections.specs.value.length} set`
                  : 'None — the product will not appear under any filter'
              }}
            </dd>
          </div>
          <div class="review-row">
            <dt>Media</dt>
            <dd :class="{ 'status-warn': sections.media.value.length === 0 }">
              {{
                sections.media.value.length
                  ? `${sections.media.value.length} images`
                  : 'None — the shop shows a placeholder'
              }}
            </dd>
          </div>
        </dl>
      </fieldset>
    </template>

    <ProductUploadDialog v-model:open="uploading" @ready="sections.addMedia" />
  </section>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.breadcrumb {
  font-size: var(--text-xs);
}

.header {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.spacer {
  flex-grow: 1;
}

.counter {
  font-size: var(--text-xs);
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.note-line {
  margin-block-start: calc(-1 * var(--space-6));
  font-size: var(--text-xs);
}

.rail {
  display: flex;
  gap: var(--space-6);
  list-style: none;
}

.rail-step {
  flex: 1 1 0;
  min-inline-size: 0;
}

.rail-button {
  display: block;
  inline-size: 100%;
  padding: var(--space-5) 0 0;
  border: 0;
  border-block-start: var(--border-hairline) solid var(--color-rule);
  text-align: start;
}

.rail-button.lit {
  border-block-start: 2px solid var(--color-rule-strong);
}

.rail-button:disabled {
  cursor: default;
  opacity: 1;
}

.rail-label {
  display: block;
  color: var(--color-faint);
  font-size: var(--text-3xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-heading);
  text-transform: uppercase;
}

.rail-button.lit .rail-label {
  color: var(--color-ink);
}

.rail-state {
  display: block;
  margin-block-start: var(--space-1);
  color: var(--color-faint);
  font-size: var(--text-2xs);
  font-weight: var(--weight-regular);
}

.rail-state.state-editing {
  color: var(--color-ink);
}

.rail-state.state-saved {
  color: var(--color-status-ok);
}

.rail-state.state-next {
  color: var(--color-muted);
}

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.media-header {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.review {
  display: flex;
  flex-direction: column;
}

.review-row {
  display: flex;
  gap: var(--space-9);
  padding: var(--space-4) 0;
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.review-row dt {
  flex: none;
  inline-size: 9.5rem;
  color: var(--color-muted);
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.review-row dd {
  margin: 0;
  font-size: var(--text-sm);
}
</style>
