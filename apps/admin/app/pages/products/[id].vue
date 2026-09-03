<script setup lang="ts">
import { PRODUCT_STATUSES, type ProductStatus } from '@forge-kivu/types'

definePageMeta({ access: 'admin-only' })

const STATUS_LABELS: Record<ProductStatus, string> = {
  [PRODUCT_STATUSES.DRAFT]: 'Draft',
  [PRODUCT_STATUSES.PUBLISHED]: 'Published',
  [PRODUCT_STATUSES.NOT_AVAILABLE]: 'Not available',
}

const STATUS_CLASSES: Record<ProductStatus, string> = {
  [PRODUCT_STATUSES.DRAFT]: 'status-neutral',
  [PRODUCT_STATUSES.PUBLISHED]: 'status-ok',
  [PRODUCT_STATUSES.NOT_AVAILABLE]: 'status-bad',
}

const route = useRoute()
const id = computed(() => String(route.params.id))

const {
  detail,
  remove,
  publish,
  unpublish,
  setOptions,
  setVariants,
  setSpecs,
  setMedia,
} = useProducts()
const { list: listSuppliers } = useSuppliers()
const { tree, attributes, units: listUnits } = useTaxonomy()
const { settings, load: loadSettings } = useSettings()

const { data, error, refresh } = await useAsyncData(
  () => `admin-product-${id.value}`,
  () => detail(id.value),
  { watch: [id] },
)

if (error.value) throw error.value

const [suppliers, categories, specAttributes, units] = await Promise.all([
  useAsyncData('product-suppliers', () => listSuppliers()),
  useAsyncData('product-categories', () => tree()),
  useAsyncData('product-attributes', () => attributes()),
  useAsyncData('product-units', () => listUnits()),
])
await loadSettings()

const categoryRows = computed(() => flattenTree(categories.data.value ?? []))
const currency = computed(() => settings.value?.currency ?? '')

const sections = useProductSections(
  data,
  {
    options: async (input) => {
      data.value = await setOptions(id.value, input)
    },
    variants: async (input) => {
      data.value = await setVariants(id.value, input)
    },
    specs: async (input) => {
      data.value = await setSpecs(id.value, input)
    },
    media: async (input) => {
      data.value = await setMedia(id.value, input)
    },
  },
  units.data,
)

const TABS = [
  { value: 'details', label: 'Details' },
  { value: 'variants', label: 'Options & variants' },
  { value: 'specs', label: 'Specs' },
  { value: 'media', label: 'Media' },
] as const

const tab = ref<(typeof TABS)[number]['value']>('details')

const counts = computed<Record<(typeof TABS)[number]['value'], number | null>>(
  () => ({
    details: null,
    variants: data.value?.variants.length ?? 0,
    specs: data.value?.specs.length ?? 0,
    media: data.value?.media.length ?? 0,
  }),
)

const { pending: acting, error: actionError, run } = useAsyncAction()

const toggleStatus = () =>
  run(async () => {
    if (!data.value) return
    data.value =
      data.value.status === PRODUCT_STATUSES.PUBLISHED
        ? await unpublish(id.value)
        : await publish(id.value)
  })

const saveSection = (save: () => Promise<boolean>) =>
  run(async () => {
    await save()
  })

const confirming = ref(false)
const uploading = ref(false)

const confirmRemove = () =>
  run(async () => {
    await remove(id.value)
    await navigateTo('/products')
  })

const updatedAt = computed(() =>
  data.value
    ? new Date(data.value.updatedAt).toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '',
)
</script>

<template>
  <section v-if="data" class="page">
    <p class="breadcrumb">
      <NuxtLink to="/products">Products</NuxtLink>
      <span class="muted"> / </span>
      <NuxtLink :to="`/suppliers/${data.supplier.slug}`">
        {{ data.supplier.name }}
      </NuxtLink>
      <span class="muted"> / {{ data.name }}</span>
    </p>

    <div class="header">
      <h1>{{ data.name }}</h1>
      <span class="flag" :class="STATUS_CLASSES[data.status]">
        {{ STATUS_LABELS[data.status] }}
      </span>
      <div class="spacer" />
      <UiButton :disabled="acting" @click="toggleStatus">
        {{
          data.status === PRODUCT_STATUSES.PUBLISHED ? 'Unpublish' : 'Publish'
        }}
      </UiButton>
      <UiButton variant="ghost" @click="confirming = true">Delete</UiButton>
    </div>

    <p class="muted summary">
      {{ data.category.name }} · Updated {{ updatedAt }}
    </p>

    <!-- <p v-if="data.status === PRODUCT_STATUSES.DRAFT" class="note">
      Never published.
    </p>
    <p
      v-else-if="data.status === PRODUCT_STATUSES.NOT_AVAILABLE"
      class="note status-bad"
    >
      Not available.
    </p> -->

    <p v-if="actionError" class="note status-bad" role="alert">
      {{ errorMessage(actionError) }}
    </p>
    <p v-if="sections.issue.value" class="note status-bad" role="alert">
      {{ sections.issue.value }}
    </p>

    <TabsRoot v-model="tab" :unmount-on-hide="false" class="tabs">
      <TabsList class="tab-strip">
        <TabsTrigger
          v-for="item in TABS"
          :key="item.value"
          :value="item.value"
          class="tab"
        >
          {{ item.label }}
          <span v-if="counts[item.value] !== null" class="count">
            {{ counts[item.value] }}
          </span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" class="panel">
        <ProductDetailsForm
          :key="`details-${data.id}`"
          form-id="product-details"
          :product="data"
          :suppliers="suppliers.data.value ?? []"
          :categories="categoryRows"
          @saved="() => refresh()"
        >
          <template #default="{ saving }">
            <div class="actions">
              <UiButton type="submit" variant="primary" :disabled="saving">
                {{ saving ? 'Saving…' : 'Save details' }}
              </UiButton>
            </div>
          </template>
        </ProductDetailsForm>
      </TabsContent>

      <TabsContent value="variants" class="panel stack">
        <fieldset class="section">
          <legend>Options</legend>
          <ProductOptionsFields
            v-model="sections.options.value"
            @add="sections.addOption"
            @remove="sections.removeOption"
          />
          <div class="actions">
            <UiButton
              variant="primary"
              :disabled="acting"
              @click="saveSection(sections.saveOptions)"
            >
              Save options
            </UiButton>
          </div>
        </fieldset>

        <fieldset class="section">
          <legend>Variants</legend>
          <ProductVariantsTable
            v-model="sections.variants.value"
            :option-names="sections.optionNames.value"
            :currency="currency"
            :units="units.data.value ?? []"
            :images="sections.media.value"
          />
          <div class="actions">
            <UiButton
              variant="primary"
              :disabled="acting"
              @click="saveSection(sections.saveVariants)"
            >
              Save variants
            </UiButton>
          </div>
        </fieldset>
      </TabsContent>

      <TabsContent value="specs" class="panel">
        <fieldset class="section">
          <legend>Specs</legend>
          <ProductSpecsTable
            v-model="sections.specs.value"
            :attributes="specAttributes.data.value ?? []"
            @add="sections.addSpec"
            @remove="sections.removeSpec"
          />
          <div class="actions">
            <UiButton
              variant="primary"
              :disabled="acting"
              @click="saveSection(sections.saveSpecs)"
            >
              Save specs
            </UiButton>
          </div>
        </fieldset>
      </TabsContent>

      <TabsContent value="media" class="panel">
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

          <div class="actions">
            <UiButton
              variant="primary"
              :disabled="acting"
              @click="saveSection(sections.saveMedia)"
            >
              Save media
            </UiButton>
          </div>
        </fieldset>
      </TabsContent>
    </TabsRoot>

    <ProductUploadDialog v-model:open="uploading" @ready="sections.addMedia" />

    <UiConfirmDialog
      v-model:open="confirming"
      title="Delete product?"
      :description="`${data.name} is removed for good, with its options, variants, specs and media links. The image files stay in Media.`"
      @confirm="confirmRemove"
    />
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

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.summary {
  margin-block-start: calc(-1 * var(--space-6));
  font-size: var(--text-xs);
}

.tabs {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.tab-strip {
  display: flex;
  align-items: flex-end;
  gap: var(--space-11);
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.tab {
  padding: 0 0 var(--space-4);
  margin-block-end: calc(-1 * var(--border-hairline));
  border: 0;
  border-block-end: 2px solid transparent;
  color: var(--color-muted);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
}

.tab .count {
  margin-inline-start: var(--space-3);
  color: var(--color-faint);
}

.tab[data-state='active'] .count {
  color: var(--color-muted);
}

.tab[data-state='active'] {
  border-block-end-color: var(--color-rule-strong);
  color: var(--color-ink);
  font-weight: var(--weight-medium);
}

.panel {
  padding-block-start: var(--space-2);
}

.panel[hidden] {
  display: none;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
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

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}
</style>
