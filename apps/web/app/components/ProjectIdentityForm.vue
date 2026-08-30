<script setup lang="ts">
import { useForm } from 'vee-validate'

import type { Project } from '@forge-kivu/api-client'
import { PROJECT_LIMITS, projectIdentityFormSchema } from '@forge-kivu/types'

const props = defineProps<{
  formId: string
  project: Project | null
}>()

const emit = defineEmits<{ saved: [project: Project] }>()

const { create, update } = useProjects()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(projectIdentityFormSchema),
  initialValues: {
    name: props.project?.name ?? '',
    projectType: props.project?.projectType ?? '',
    workType: props.project?.workType ?? '',
  },
})

const [name, nameAttrs] = defineField('name')
const [projectType, projectTypeAttrs] = defineField('projectType')
const [workType, workTypeAttrs] = defineField('workType')

const { pending: saving, error, run } = useAsyncAction()

const submit = handleSubmit((values) => {
  if (saving.value) return
  return run(async () => {
    const saved = props.project
      ? await update(props.project.id, values)
      : await create(values)
    emit('saved', saved)
  })
})

defineExpose({ saving })
</script>

<template>
  <form :id="formId" class="form" novalidate @submit="submit">
    <fieldset class="section" :disabled="saving">
      <legend>Identity</legend>

      <div class="row">
        <div class="field">
          <Label :for="`${formId}-name`">Project name</Label>
          <input
            :id="`${formId}-name`"
            v-model="name"
            v-bind="nameAttrs"
            type="text"
            placeholder="Gisenyi Beach Cottages"
            :maxlength="PROJECT_LIMITS.name"
          />
          <span v-if="errors.name" class="hint status-bad">
            {{ errors.name }}
          </span>
          <span v-else class="hint">Required</span>
        </div>

        <div class="field">
          <Label :for="`${formId}-type`">Project type</Label>
          <select
            :id="`${formId}-type`"
            v-model="projectType"
            v-bind="projectTypeAttrs"
          >
            <option value="">Choose a type</option>
            <option
              v-for="option in projectTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <span v-if="errors.projectType" class="hint status-bad">
            {{ errors.projectType }}
          </span>
          <span v-else class="hint">Required</span>
        </div>

        <div class="field">
          <Label :for="`${formId}-work`">Work type</Label>
          <select
            :id="`${formId}-work`"
            v-model="workType"
            v-bind="workTypeAttrs"
          >
            <option value="">Not set</option>
            <option
              v-for="option in workTypeOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <span v-if="errors.workType" class="hint status-bad">
            {{ errors.workType }}
          </span>
          <span v-else class="hint">Optional</span>
        </div>
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
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr);
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
