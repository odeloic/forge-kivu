<script setup lang="ts">
import { useForm } from 'vee-validate'

import type { Project } from '@forge-kivu/api-client'
import { projectScheduleFormSchema } from '@forge-kivu/types'

const props = defineProps<{
  formId: string
  project: Project
  currency: string
}>()

const emit = defineEmits<{ saved: [project: Project] }>()

const { update } = useProjects()

const { defineField, errors, handleSubmit } = useForm({
  validationSchema: toTypedSchema(projectScheduleFormSchema),
  initialValues: {
    startDate: props.project.startDate ?? '',
    endDate: props.project.endDate ?? '',
    budget: props.project.budget === null ? '' : String(props.project.budget),
    phase: props.project.phase ?? '',
  },
})

const [startDate, startDateAttrs] = defineField('startDate')
const [endDate, endDateAttrs] = defineField('endDate')
const [budget, budgetAttrs] = defineField('budget')
const [phase, phaseAttrs] = defineField('phase')

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
      <legend>Schedule &amp; budget</legend>

      <div class="row">
        <div class="field">
          <Label :for="`${formId}-start`">Start date</Label>
          <input
            :id="`${formId}-start`"
            v-model="startDate"
            v-bind="startDateAttrs"
            type="date"
          />
          <span v-if="errors.startDate" class="hint status-bad">
            {{ errors.startDate }}
          </span>
          <span v-else class="hint">Optional</span>
        </div>

        <div class="field">
          <Label :for="`${formId}-end`">End date</Label>
          <input
            :id="`${formId}-end`"
            v-model="endDate"
            v-bind="endDateAttrs"
            type="date"
          />
          <span v-if="errors.endDate" class="hint status-bad">
            {{ errors.endDate }}
          </span>
          <span v-else class="hint">Optional</span>
        </div>

        <div class="field">
          <Label :for="`${formId}-budget`">Budget</Label>
          <input
            :id="`${formId}-budget`"
            v-model="budget"
            v-bind="budgetAttrs"
            type="text"
            inputmode="decimal"
            placeholder="42000000"
          />
          <span v-if="errors.budget" class="hint status-bad">
            {{ errors.budget }}
          </span>
          <span v-else class="hint">{{ currency }} · optional</span>
        </div>

        <div class="field">
          <Label :for="`${formId}-phase`">Current phase</Label>
          <select :id="`${formId}-phase`" v-model="phase" v-bind="phaseAttrs">
            <option value="">Not set</option>
            <option
              v-for="option in projectPhaseOptions"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
          <span v-if="errors.phase" class="hint status-bad">
            {{ errors.phase }}
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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
