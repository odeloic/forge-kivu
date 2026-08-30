<script setup lang="ts">
import { useForm } from 'vee-validate'

import type {
  AdminProductDetail,
  AdminSupplierListItem,
} from '@forge-kivu/api-client'
import { CATALOGUE_LIMITS, productFormSchema } from '@forge-kivu/types'

const props = defineProps<{
  formId: string
  product: AdminProductDetail | null
  suppliers: AdminSupplierListItem[]
  categories: CategoryRow[]
}>()

const emit = defineEmits<{ saved: [product: AdminProductDetail] }>()

const { create, update } = useProducts()

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(productFormSchema),
  initialValues: {
    supplierId: props.product?.supplier.id ?? '',
    categoryId: props.product?.category.id ?? '',
    name: props.product?.name ?? '',
    slug: props.product?.slug ?? '',
    description: props.product?.description ?? '',
  },
})

const [supplierId, supplierIdAttrs] = defineField('supplierId')
const [categoryId, categoryIdAttrs] = defineField('categoryId')
const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')
const [description, descriptionAttrs] = defineField('description')

const slugTouched = ref(props.product !== null)

watch(name, (value) => {
  if (!slugTouched.value) slug.value = slugify(value ?? '')
})

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) => {
  if (saving.value) return
  return run(async () => {
    const saved = props.product
      ? await update(props.product.id, values)
      : await create(values)
    emit('saved', saved)
  })
})

defineExpose({ saving })
</script>

<template>
  <form :id="formId" class="form" novalidate @submit="submit">
    <fieldset class="fields" :disabled="saving">
      <legend>Details</legend>

      <div class="row">
        <div class="field">
          <Label :for="`${formId}-supplier`">Supplier</Label>
          <select
            :id="`${formId}-supplier`"
            v-model="supplierId"
            v-bind="supplierIdAttrs"
          >
            <option value="">Choose a supplier</option>
            <option
              v-for="supplier in suppliers"
              :key="supplier.id"
              :value="supplier.id"
            >
              {{ supplier.name }}
            </option>
          </select>
          <span v-if="errors.supplierId" class="hint status-bad">
            {{ errors.supplierId }}
          </span>
        </div>

        <div class="field">
          <Label :for="`${formId}-category`">Category</Label>
          <select
            :id="`${formId}-category`"
            v-model="categoryId"
            v-bind="categoryIdAttrs"
          >
            <option value="">Choose a category</option>
            <option v-for="row in categories" :key="row.id" :value="row.id">
              {{ '— '.repeat(row.depth) }}{{ row.name }}
            </option>
          </select>
          <span v-if="errors.categoryId" class="hint status-bad">
            {{ errors.categoryId }}
          </span>
        </div>
      </div>

      <p class="hint">
        No category fits?
        <NuxtLink to="/taxonomy/categories">
          Add one in Taxonomy › Categories
        </NuxtLink>
        — the tree is shared by every supplier.
      </p>

      <div class="row">
        <div class="field">
          <Label :for="`${formId}-name`">Name</Label>
          <input
            :id="`${formId}-name`"
            v-model="name"
            v-bind="nameAttrs"
            type="text"
            placeholder="Corrugated Roofing Sheet"
            :maxlength="CATALOGUE_LIMITS.name"
          />
          <span v-if="errors.name" class="hint status-bad">
            {{ errors.name }}
          </span>
        </div>

        <div class="field">
          <Label :for="`${formId}-slug`">Slug</Label>
          <input
            :id="`${formId}-slug`"
            v-model="slug"
            v-bind="slugAttrs"
            type="text"
            placeholder="corrugated-roofing-sheet"
            :maxlength="CATALOGUE_LIMITS.slug"
            @input="slugTouched = true"
          />
          <span v-if="errors.slug" class="hint status-bad">
            {{ errors.slug }}
          </span>
        </div>
      </div>

      <p class="hint">
        {{
          product
            ? 'Changing the slug changes the public URL. The old one stops resolving; nothing redirects.'
            : 'The slug follows the name until you edit it. It has to be unique for this supplier, not across the whole catalogue.'
        }}
      </p>

      <div class="field">
        <Label :for="`${formId}-description`">Description</Label>
        <textarea
          :id="`${formId}-description`"
          v-model="description"
          v-bind="descriptionAttrs"
          rows="3"
          :maxlength="CATALOGUE_LIMITS.description"
        />
        <span v-if="errors.description" class="hint status-bad">
          {{ errors.description }}
        </span>
      </div>

      <p v-if="error" class="note status-bad" role="alert">
        {{ errorMessage(error) }}
      </p>

      <slot :saving="saving" />
    </fieldset>
  </form>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.row {
  display: flex;
  gap: var(--space-7);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-grow: 1;
  min-inline-size: 0;
}

.hint {
  color: var(--color-faint);
  font-size: var(--text-2xs);
}

.hint.status-bad {
  color: var(--color-status-bad);
}
</style>
