<script setup lang="ts">
import type { SpecAttribute } from '@forge-kivu/api-client'
import { CATALOGUE_LIMITS } from '@forge-kivu/types'

const specs = defineModel<SpecDraft[]>({ required: true })

const props = defineProps<{ attributes: SpecAttribute[] }>()

const emit = defineEmits<{ add: []; remove: [index: number] }>()

const unitFor = (attributeId: string): string =>
  props.attributes.find((attribute) => attribute.id === attributeId)?.unit ??
  '—'

const taken = computed(
  () => new Set(specs.value.map((spec) => spec.attributeId)),
)

const available = (current: string) =>
  props.attributes.filter(
    (attribute) => attribute.id === current || !taken.value.has(attribute.id),
  )
</script>

<template>
  <div class="specs">
    <table>
      <thead>
        <tr>
          <th class="attribute-column">Attribute</th>
          <th>Value</th>
          <th class="unit-column">Unit</th>
          <th class="actions-column">Actions</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(spec, index) in specs" :key="index">
          <td>
            <select v-model="spec.attributeId" aria-label="Attribute">
              <option value="">Choose an attribute</option>
              <option
                v-for="attribute in available(spec.attributeId)"
                :key="attribute.id"
                :value="attribute.id"
              >
                {{ attribute.name }}
              </option>
            </select>
          </td>
          <td>
            <input
              v-model="spec.value"
              type="text"
              aria-label="Value"
              :maxlength="CATALOGUE_LIMITS.specValue"
            />
          </td>
          <td :class="{ muted: unitFor(spec.attributeId) === '—' }">
            {{ unitFor(spec.attributeId) }}
          </td>
          <td>
            <div class="actions">
              <UiButton variant="ghost" @click="emit('remove', index)">
                Remove
              </UiButton>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="footer">
      <UiButton
        :disabled="specs.length >= attributes.length"
        @click="emit('add')"
      >
        Add spec
      </UiButton>
      <p class="hint">
        <NuxtLink to="/taxonomy/spec-attributes">
          Add an attribute in Taxonomy
        </NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
.specs {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.attribute-column {
  width: 15rem;
}

.unit-column {
  width: 5rem;
}

.actions-column {
  width: 6rem;
}

td input,
td select {
  inline-size: 100%;
}

.actions {
  display: flex;
  margin: 0 calc(-1 * var(--space-4));
}

.footer {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.hint {
  font-size: var(--text-xs);
}
</style>
