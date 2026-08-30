<script setup lang="ts">
import { CATALOGUE_LIMITS } from '@forge-kivu/types'

const options = defineModel<OptionDraft[]>({ required: true })

const emit = defineEmits<{ add: []; remove: [index: number] }>()

const combinations = computed(() =>
  options.value.reduce((total, option) => {
    const count = option.values
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean).length
    return count > 0 ? total * count : total
  }, 1),
)

const summary = computed(() => {
  const named = options.value.filter(
    (option) =>
      option.name.trim() !== '' &&
      option.values.split(',').some((value) => value.trim() !== ''),
  )
  if (named.length === 0) {
    return 'Name an option and list its values to build variants from it.'
  }
  const parts = named.map((option) => {
    const count = option.values
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean).length
    return `${count} × ${option.name.trim().toLowerCase()}`
  })
  const total = combinations.value
  return `${parts.join(', ')} → ${total} ${total === 1 ? 'variant' : 'variants'}`
})
</script>

<template>
  <div class="options">
    <div class="rows">
      <div v-for="(option, index) in options" :key="index" class="row">
        <div class="field name">
          <Label :for="`option-name-${index}`">Option name</Label>
          <input
            :id="`option-name-${index}`"
            v-model="option.name"
            type="text"
            placeholder="Colour"
            :maxlength="CATALOGUE_LIMITS.name"
          />
        </div>
        <div class="field">
          <Label :for="`option-values-${index}`">Values, comma separated</Label>
          <input
            :id="`option-values-${index}`"
            v-model="option.values"
            type="text"
            placeholder="Charcoal, Brick Red"
          />
        </div>
        <UiButton variant="ghost" @click="emit('remove', index)">
          Remove
        </UiButton>
      </div>
    </div>

    <div class="footer">
      <UiButton
        :disabled="options.length >= CATALOGUE_LIMITS.options"
        @click="emit('add')"
      >
        Add option
      </UiButton>
      <p class="muted summary">{{ summary }}</p>
    </div>
  </div>
</template>

<style scoped>
.options {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.row {
  display: flex;
  align-items: flex-end;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  flex-grow: 1;
  min-inline-size: 0;
}

.field.name {
  flex-grow: 0;
  inline-size: 12rem;
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.summary {
  font-size: var(--text-xs);
}
</style>
