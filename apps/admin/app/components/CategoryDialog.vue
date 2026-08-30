<script setup lang="ts">
import { useForm } from 'vee-validate'

import { categoryFormSchema, TAXONOMY_LIMITS } from '@forge-kivu/types'

const props = defineProps<{
  rows: CategoryRow[]
  editing: CategoryRow | null
  parentId: string | null
}>()

const emit = defineEmits<{ close: []; saved: [] }>()

const { createCategory, updateCategory } = useTaxonomy()

const banned = computed(() =>
  props.editing
    ? descendantIds(props.rows, props.editing.id)
    : new Set<string>(),
)

const parents = computed(() =>
  props.rows.filter((row) => !banned.value.has(row.id)),
)

const targetName = computed(
  () => props.rows.find((row) => row.id === props.parentId)?.name ?? null,
)

const title = computed(() => {
  if (props.editing) return `Edit “${props.editing.name}”`
  if (targetName.value) return `New child of “${targetName.value}”`
  return 'New root category'
})

const description = computed(() => {
  if (props.editing) {
    return 'Renaming is safe. Changing the slug breaks any saved shop filter link that used the old one.'
  }
  if (targetName.value) {
    return 'The parent is filled in from the row you clicked. Change it to place this category somewhere else.'
  }
  return 'A root category is what the shop lists as a top-level filter, so keep these few and broad.'
})

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(categoryFormSchema),
  initialValues: {
    name: props.editing?.name ?? '',
    slug: props.editing?.slug ?? '',
    parentId: props.parentId ?? '',
    sortOrder: props.editing?.sortOrder ?? 0,
  },
})

const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')
const [parent, parentAttrs] = defineField('parentId')
const [sortOrder, sortOrderAttrs] = defineField('sortOrder')

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) => {
  if (saving.value) return
  return run(async () => {
    if (props.editing) await updateCategory(props.editing.id, values)
    else await createCategory(values)
    emit('saved')
  })
})
</script>

<template>
  <UiDialog
    :open="true"
    :title="title"
    :description="description"
    @update:open="(value) => !value && emit('close')"
  >
    <form class="form" novalidate @submit="submit">
      <fieldset class="fields" :disabled="saving">
        <div class="field">
          <Label for="category-name">Name</Label>
          <input
            id="category-name"
            v-model="name"
            v-bind="nameAttrs"
            type="text"
            placeholder="Roofing Sheets"
            :maxlength="TAXONOMY_LIMITS.name"
          />
          <span v-if="errors.name" class="hint status-bad">
            {{ errors.name }}
          </span>
        </div>

        <div class="field">
          <Label for="category-slug">Slug</Label>
          <input
            id="category-slug"
            v-model="slug"
            v-bind="slugAttrs"
            type="text"
            placeholder="roofing-sheets"
            :maxlength="TAXONOMY_LIMITS.slug"
          />
          <span v-if="errors.slug" class="hint status-bad">
            {{ errors.slug }}
          </span>
          <span v-else class="hint">
            Globally unique — it shows up in shop URLs and filter queries.
          </span>
        </div>

        <div class="field">
          <Label for="category-parent">Parent</Label>
          <select id="category-parent" v-model="parent" v-bind="parentAttrs">
            <option value="">— none (root) —</option>
            <option v-for="row in parents" :key="row.id" :value="row.id">
              {{ '— '.repeat(row.depth) }}{{ row.name }}
            </option>
          </select>
          <span v-if="errors.parentId" class="hint status-bad">
            {{ errors.parentId }}
          </span>
          <span v-else class="hint">
            A category cannot move under one of its own descendants, so those
            are left out of this list.
          </span>
        </div>

        <div class="field">
          <Label for="category-sort">Sort order</Label>
          <input
            id="category-sort"
            v-model="sortOrder"
            v-bind="sortOrderAttrs"
            type="number"
            min="0"
            :max="TAXONOMY_LIMITS.sortOrder"
          />
          <span v-if="errors.sortOrder" class="hint status-bad">
            {{ errors.sortOrder }}
          </span>
        </div>

        <p v-if="error" class="note status-bad" role="alert">
          {{ errorMessage(error) }}
        </p>

        <div class="actions">
          <UiButton @click="emit('close')">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :disabled="saving">
            {{
              saving ? 'Saving…' : editing ? 'Save category' : 'Create category'
            }}
          </UiButton>
        </div>
      </fieldset>
    </form>
  </UiDialog>
</template>

<style scoped>
.form {
  display: contents;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
  margin: 0;
  padding: 0;
  border: 0;
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.hint {
  color: var(--color-faint);
  font-size: var(--text-2xs);
}

.hint.status-bad {
  color: var(--color-status-bad);
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-4);
  margin-top: var(--space-2);
}
</style>
