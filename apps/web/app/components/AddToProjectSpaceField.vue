<script setup lang="ts">
import type { ProjectSpace, Space } from '@forge-kivu/api-client'
import { PROJECT_LIMITS, type ErrorCode } from '@forge-kivu/types'

interface Props {
  space: SpaceChoice
  spaces: ProjectSpace[]
  suggestions: Space[]
  error: ErrorCode | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  choose: [choice: SpaceChoice]
  name: [name: string, canonicalId: string | null]
}>()

const NEW_SPACE = '__new'
const SUGGESTION_LIMIT = 6

const selected = computed(() => {
  if (props.space.kind === 'new') return NEW_SPACE
  return props.space.kind === 'existing' ? props.space.id : ''
})

const naming = computed(() => props.space.kind === 'new')

const draft = computed(() =>
  props.space.kind === 'new' ? props.space.name : '',
)

const matches = computed(() => {
  if (props.space.kind !== 'new') return []
  const term = props.space.name.trim().toLowerCase()
  return props.suggestions
    .filter((row) => row.name.toLowerCase().startsWith(term))
    .slice(0, SUGGESTION_LIMIT)
})

const choose = (value: string) => {
  if (value === NEW_SPACE) {
    emit('choose', { kind: 'new', name: '', canonicalId: null })
    return
  }
  emit('choose', value ? { kind: 'existing', id: value } : { kind: 'none' })
}
</script>

<template>
  <div class="space-field">
    <div class="field">
      <Label for="add-space">Space</Label>
      <select
        id="add-space"
        :value="selected"
        @change="choose(($event.target as HTMLSelectElement).value)"
      >
        <option value="">Whole project — no space</option>
        <option v-for="row in spaces" :key="row.id" :value="row.id">
          {{ row.name }}
        </option>
        <option :value="NEW_SPACE">New space…</option>
      </select>
    </div>

    <p v-if="spaces.length === 0 && !naming" class="muted note">
      This project has no spaces yet — name one, or add to the whole project.
    </p>

    <div v-if="naming" class="field">
      <Label for="add-space-name">New space name</Label>
      <input
        id="add-space-name"
        :value="draft"
        type="text"
        :maxlength="PROJECT_LIMITS.spaceName"
        autocomplete="off"
        @input="emit('name', ($event.target as HTMLInputElement).value, null)"
      />

      <p v-if="error" class="note status-bad" role="alert">
        {{ errorMessage(error) }}
      </p>

      <ul v-if="matches.length" class="suggestions">
        <li v-for="row in matches" :key="row.id">
          <button
            type="button"
            class="suggestion"
            @click="emit('name', row.name, row.id)"
          >
            {{ row.name }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.space-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.note {
  font-size: var(--text-xs);
}

.suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-block-start: var(--space-2);
}

.suggestion {
  padding: var(--space-2) var(--space-5);
  border: var(--border-hairline) solid var(--color-control-border);
  background: var(--color-paper);
  color: var(--color-muted);
  font-size: var(--text-2xs);
  cursor: pointer;
}

.suggestion:hover {
  border-color: var(--color-rule-strong);
  color: var(--color-ink);
}
</style>
