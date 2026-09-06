<script setup lang="ts">
import { PROJECT_LIMITS } from '@forge-kivu/types'

interface Props {
  unit: string
  fieldId?: string
  label?: string
  labelHidden?: boolean
  steppers?: 'narrow' | 'always'
  invalid?: boolean
}

const quantity = defineModel<string>({ required: true })

const props = withDefaults(defineProps<Props>(), {
  fieldId: 'project-quantity',
  label: 'Quantity',
  labelHidden: false,
  steppers: 'narrow',
  invalid: false,
})

const emit = defineEmits<{ commit: [] }>()

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
  <div
    class="field"
    :class="{ 'steppers-always': props.steppers === 'always' }"
  >
    <Label :for="props.fieldId" :class="{ 'sr-only': props.labelHidden }">
      {{ props.label }}
    </Label>
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
          :aria-invalid="props.invalid || undefined"
          @input="quantity = ($event.target as HTMLInputElement).value"
          @blur="emit('commit')"
          @keydown.enter.prevent="emit('commit')"
        />
      </div>
      <span class="muted unit">{{ props.unit }}</span>
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
  min-inline-size: 3.5rem;
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  text-align: end;
}

.unit {
  flex: none;
  font-size: var(--text-xs);
}

.input[aria-invalid='true'] {
  border-color: var(--color-status-bad);
}

.sr-only {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.stepper {
  display: none;
}

.steppers-always .row {
  align-items: center;
  gap: 0;
}

.steppers-always .entry {
  flex-grow: 0;
}

.steppers-always .stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  padding: var(--space-4) var(--space-5);
  border: 0;
  background: none;
  color: var(--color-muted);
  font-size: var(--text-sm);
}

.steppers-always .stepper:hover {
  color: var(--color-ink);
}

.steppers-always .input {
  inline-size: 3rem;
  min-inline-size: 2rem;
  padding: 0;
  border: 0;
  background: transparent;
  font-size: var(--text-xs);
  text-align: center;
  -moz-appearance: textfield;
}

.steppers-always .input::-webkit-outer-spin-button,
.steppers-always .input::-webkit-inner-spin-button {
  margin: 0;
  -webkit-appearance: none;
}

.steppers-always .input[aria-invalid='true'] {
  color: var(--color-status-bad);
  box-shadow: inset 0 -2px 0 var(--color-status-bad);
}

.steppers-always .unit {
  order: 4;
  padding-inline-end: var(--space-5);
  font-family: var(--font-mono);
  font-size: var(--text-2xs);
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
