<script setup lang="ts">
import { useForm } from 'vee-validate'

import type { SpecAttribute } from '@forge-kivu/api-client'
import { attributeFormSchema, TAXONOMY_LIMITS } from '@forge-kivu/types'

const props = defineProps<{ editing: SpecAttribute | null }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const { createAttribute, updateAttribute } = useTaxonomy()

const title = computed(() =>
  props.editing ? `Edit “${props.editing.name}”` : 'New attribute',
)

const description = computed(() =>
  props.editing
    ? 'Renaming is safe. Changing the slug breaks any saved shop filter link that used the old one.'
    : 'Attributes defined here are the only ones a product can carry a spec value for, and they drive the shop filters.',
)

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(attributeFormSchema),
  initialValues: {
    name: props.editing?.name ?? '',
    slug: props.editing?.slug ?? '',
    unit: props.editing?.unit ?? '',
  },
})

const [name, nameAttrs] = defineField('name')
const [slug, slugAttrs] = defineField('slug')
const [unit, unitAttrs] = defineField('unit')

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) => {
  if (saving.value) return
  return run(async () => {
    if (props.editing) await updateAttribute(props.editing.id, values)
    else await createAttribute(values)
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
          <Label for="attribute-name">Name</Label>
          <input
            id="attribute-name"
            v-model="name"
            v-bind="nameAttrs"
            type="text"
            placeholder="Roll Length"
            :maxlength="TAXONOMY_LIMITS.name"
          />
          <span v-if="errors.name" class="hint status-bad">
            {{ errors.name }}
          </span>
          <span v-else class="hint">
            Unique regardless of case — “material” is refused while “Material”
            exists.
          </span>
        </div>

        <div class="field">
          <Label for="attribute-slug">Slug</Label>
          <input
            id="attribute-slug"
            v-model="slug"
            v-bind="slugAttrs"
            type="text"
            placeholder="roll-length"
            :maxlength="TAXONOMY_LIMITS.slug"
          />
          <span v-if="errors.slug" class="hint status-bad">
            {{ errors.slug }}
          </span>
        </div>

        <div class="field">
          <Label for="attribute-unit">Unit</Label>
          <input
            id="attribute-unit"
            v-model="unit"
            v-bind="unitAttrs"
            type="text"
            placeholder="m"
            :maxlength="TAXONOMY_LIMITS.unit"
          />
          <span v-if="errors.unit" class="hint status-bad">
            {{ errors.unit }}
          </span>
          <span v-else class="hint">
            Leave empty for anything not measured, such as Material or Finish.
          </span>
        </div>

        <p v-if="error" class="note status-bad" role="alert">
          {{ errorMessage(error) }}
        </p>

        <div class="actions">
          <UiButton @click="emit('close')">Cancel</UiButton>
          <UiButton type="submit" variant="primary" :disabled="saving">
            {{
              saving
                ? 'Saving…'
                : editing
                  ? 'Save attribute'
                  : 'Create attribute'
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
