<script setup lang="ts">
import { PROJECT_LIMITS } from '@forge-kivu/types'

interface Props {
  unit: string
  fieldId?: string
  label?: string
}

const quantity = defineModel<string>({ required: true })

const props = withDefaults(defineProps<Props>(), {
  fieldId: 'project-quantity',
  label: 'Quantity',
})

const STEP = 1

const clamp = (value: number): number =>
  Math.min(PROJECT_LIMITS.quantity, Math.max(0.01, value))

const nudge = (direction: number) => {
  const current = Number(quantity.value)
  const base = Number.isFinite(current) ? current : 0
  quantity.value = String(
    clamp(Math.round((base + direction * STEP) * 100) / 100),
  )
}
</script>

<template>
  <div class="field">
    <Label :for="props.fieldId">{{ props.label }}</Label>
    <div class="row">
      <UiButton
        class="stepper"
        :aria-label="`Decrease ${props.label.toLowerCase()}`"
        @click="nudge(-1)"
      >
        −
      </UiButton>
      <div class="entry">
        <input
          :id="props.fieldId"
          class="input"
          type="number"
          inputmode="decimal"
          step="0.01"
          min="0.01"
          :max="PROJECT_LIMITS.quantity"
          :value="quantity"
          @input="quantity = ($event.target as HTMLInputElement).value"
        />
        <span class="muted unit">{{ props.unit }}</span>
      </div>
      <UiButton
        class="stepper"
        :aria-label="`Increase ${props.label.toLowerCase()}`"
        @click="nudge(1)"
      >
        +
      </UiButton>
    </div>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.row {
  display: flex;
  align-items: stretch;
  gap: var(--space-4);
}

.entry {
  display: flex;
  align-items: center;
  flex-grow: 1;
  gap: var(--space-4);
  min-inline-size: 0;
}

.input {
  inline-size: 100%;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.unit {
  flex: none;
  font-size: var(--text-xs);
}

.stepper {
  display: none;
}

@media (max-width: 56.25rem) {
  .stepper {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    inline-size: 2.75rem;
    min-block-size: 2.75rem;
    font-size: var(--text-md);
  }

  .input {
    min-block-size: 2.75rem;
  }
}
</style>
