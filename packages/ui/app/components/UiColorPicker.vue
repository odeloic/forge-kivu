<script setup lang="ts">
import { hexSchema } from '@forge-kivu/types'

const props = withDefaults(
  defineProps<{ modelValue: string | null; disabled?: boolean }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string | null] }>()

const draft = ref<string | null>(null)
const native = useTemplateRef<HTMLInputElement>('native')

const text = computed(() => draft.value ?? props.modelValue ?? '')
const invalid = computed(() => draft.value !== null)
const swatch = computed(() => props.modelValue ?? 'transparent')

const normalise = (value: string): string | null => {
  const trimmed = value.trim()
  const parsed = hexSchema.safeParse(
    trimmed.startsWith('#') ? trimmed : `#${trimmed}`,
  )
  return parsed.success ? parsed.data : null
}

const commit = (value: string) => {
  if (value.trim() === '') {
    draft.value = null
    emit('update:modelValue', null)
    return
  }
  const hex = normalise(value)
  if (hex === null) {
    draft.value = value
    return
  }
  draft.value = null
  emit('update:modelValue', hex)
}

const onType = (event: Event) => {
  commit((event.target as HTMLInputElement).value)
}

const onPick = (event: Event) => {
  commit((event.target as HTMLInputElement).value)
}

const open = () => {
  if (!props.disabled) native.value?.click()
}
</script>

<template>
  <div class="picker" :class="{ invalid, disabled }">
    <button
      type="button"
      class="swatch"
      :class="{ empty: modelValue === null }"
      :style="{ background: swatch }"
      :disabled="disabled"
      aria-label="Pick a colour"
      @click="open"
    />
    <input
      ref="native"
      class="native"
      type="color"
      tabindex="-1"
      aria-hidden="true"
      :value="modelValue ?? '#000000'"
      :disabled="disabled"
      @input="onPick"
    />
    <input
      class="hex"
      type="text"
      inputmode="text"
      spellcheck="false"
      maxlength="7"
      placeholder="#rrggbb"
      aria-label="Hex colour"
      :aria-invalid="invalid"
      :value="text"
      :disabled="disabled"
      @input="onType"
    />
  </div>
</template>

<style scoped>
.picker {
  display: inline-flex;
  align-items: stretch;
  gap: var(--space-3);
}

.swatch {
  inline-size: 2rem;
  border: var(--border-hairline) solid var(--color-control-border);
  padding: 0;
  cursor: pointer;
}

.swatch.empty {
  background-image: linear-gradient(
    135deg,
    var(--color-paper) 45%,
    var(--color-status-bad) 45%,
    var(--color-status-bad) 55%,
    var(--color-paper) 55%
  );
}

.swatch:focus-visible {
  outline: var(--focus-width-strong) solid var(--color-accent);
  outline-offset: var(--focus-offset);
}

.native {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  opacity: 0;
  pointer-events: none;
}

.hex {
  inline-size: 6.5rem;
  font-family: var(--font-mono);
}

.invalid .hex {
  border-color: var(--color-status-bad);
  outline-color: var(--color-status-bad);
}

.disabled {
  opacity: 0.5;
}
</style>
