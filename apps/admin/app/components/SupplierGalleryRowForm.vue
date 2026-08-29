<script setup lang="ts">
import { useForm } from 'vee-validate'

import type { AdminSupplierDetail } from '@forge-kivu/api-client'
import { galleryItemFormSchema, SUPPLIER_LIMITS } from '@forge-kivu/types'

const props = defineProps<{
  supplierId: string
  item: AdminSupplierDetail['gallery'][number]
}>()
const emit = defineEmits<{ saved: []; cancel: [] }>()

const { updateGalleryItem } = useSuppliers()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(galleryItemFormSchema),
  initialValues: {
    altText: props.item.altText ?? '',
    caption: props.item.caption ?? '',
    linkUrl: props.item.linkUrl ?? '',
  },
})

const [altText, altTextAttrs] = defineField('altText')
const [caption, captionAttrs] = defineField('caption')
const [linkUrl, linkUrlAttrs] = defineField('linkUrl')

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) =>
  run(async () => {
    await updateGalleryItem(props.supplierId, props.item.id, values)
    emit('saved')
  }),
)
</script>

<template>
  <form class="editor" novalidate @submit="submit">
    <fieldset class="fields" :disabled="saving">
      <legend>Describe this image</legend>

      <div class="field">
        <Label :for="`alt-${item.id}`">Alt text</Label>
        <input
          :id="`alt-${item.id}`"
          v-model="altText"
          v-bind="altTextAttrs"
          type="text"
          :maxlength="SUPPLIER_LIMITS.altText"
        />
        <span v-if="errors.altText" class="hint status-bad">
          {{ errors.altText }}
        </span>
        <span v-else class="hint">
          What the image shows, for people who cannot see it.
        </span>
      </div>

      <div class="row">
        <div class="field">
          <Label :for="`caption-${item.id}`">Caption</Label>
          <input
            :id="`caption-${item.id}`"
            v-model="caption"
            v-bind="captionAttrs"
            type="text"
            :maxlength="SUPPLIER_LIMITS.caption"
          />
          <span v-if="errors.caption" class="hint status-bad">
            {{ errors.caption }}
          </span>
        </div>

        <div class="field">
          <Label :for="`link-${item.id}`">Link</Label>
          <input
            :id="`link-${item.id}`"
            v-model="linkUrl"
            v-bind="linkUrlAttrs"
            type="url"
            :maxlength="SUPPLIER_LIMITS.url"
            placeholder="https://"
          />
          <span v-if="errors.linkUrl" class="hint status-bad">
            {{ errors.linkUrl }}
          </span>
        </div>
      </div>

      <p v-if="error" class="note status-bad" role="alert">
        {{ errorMessage(error) }}
      </p>

      <div class="actions">
        <UiButton type="submit" variant="primary" :disabled="saving">
          {{ saving ? 'Saving…' : 'Save' }}
        </UiButton>
        <UiButton :disabled="saving" @click="emit('cancel')">Cancel</UiButton>
      </div>
    </fieldset>
  </form>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  margin: 0;
  padding: var(--space-7) 0 var(--space-8);
  border: 0;
}

.fields legend {
  padding: 0;
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

.actions {
  display: flex;
  gap: var(--space-4);
}
</style>
