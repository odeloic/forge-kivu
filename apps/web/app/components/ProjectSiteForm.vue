<script setup lang="ts">
import { useForm } from 'vee-validate'

import type { Project } from '@forge-kivu/api-client'
import { PROJECT_LIMITS, projectSiteFormSchema } from '@forge-kivu/types'

const props = defineProps<{
  formId: string
  project: Project
}>()

const emit = defineEmits<{ saved: [project: Project] }>()

const { update } = useProjects()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(projectSiteFormSchema),
  initialValues: {
    clientName: props.project.clientName ?? '',
    location: props.project.location ?? '',
    description: props.project.description ?? '',
  },
})

const [clientName, clientNameAttrs] = defineField('clientName')
const [location, locationAttrs] = defineField('location')
const [description, descriptionAttrs] = defineField('description')

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) => {
  if (saving.value) return
  return run(async () => {
    emit('saved', await update(props.project.id, values))
  })
})

defineExpose({ saving })
</script>

<template>
  <form :id="formId" class="form" novalidate @submit="submit">
    <fieldset class="section" :disabled="saving">
      <legend>Site &amp; client</legend>

      <div class="row">
        <div class="field">
          <Label :for="`${formId}-client`">Client</Label>
          <input
            :id="`${formId}-client`"
            v-model="clientName"
            v-bind="clientNameAttrs"
            type="text"
            placeholder="Uwase Construction Ltd"
            :maxlength="PROJECT_LIMITS.clientName"
          />
          <span v-if="errors.clientName" class="hint status-bad">
            {{ errors.clientName }}
          </span>
          <span v-else class="hint">Optional</span>
        </div>

        <div class="field">
          <Label :for="`${formId}-location`">Location</Label>
          <input
            :id="`${formId}-location`"
            v-model="location"
            v-bind="locationAttrs"
            type="text"
            placeholder="Rubavu, Western Province"
            :maxlength="PROJECT_LIMITS.location"
          />
          <span v-if="errors.location" class="hint status-bad">
            {{ errors.location }}
          </span>
          <span v-else class="hint">Optional</span>
        </div>
      </div>

      <div class="field">
        <Label :for="`${formId}-description`">Description</Label>
        <textarea
          :id="`${formId}-description`"
          v-model="description"
          v-bind="descriptionAttrs"
          rows="3"
          :maxlength="PROJECT_LIMITS.description"
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

.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-9);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.hint {
  color: var(--color-muted);
  font-size: var(--text-2xs);
}

.hint.status-bad {
  color: var(--color-status-bad);
}
</style>
