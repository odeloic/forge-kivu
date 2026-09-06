<script setup lang="ts">
import {
  BOQ_GROUPS,
  BOQ_VIEWS,
  type BoqGroup,
  type BoqView,
  type BoqViewQuery,
} from '@forge-kivu/types'

const search = defineModel<string>('search', { required: true })

const props = defineProps<{
  view: BoqViewQuery
  projectId: string
  workingCopy: boolean
}>()

const emit = defineEmits<{ update: [patch: Partial<BoqViewQuery>] }>()

const VIEWS: { value: BoqView; label: string }[] = [
  { value: BOQ_VIEWS.GALLERY, label: 'Gallery' },
  { value: BOQ_VIEWS.BOQ, label: 'BOQ' },
]

const setView = (value: string) => {
  if (!value) return
  emit('update', { view: value as BoqView })
}

const setGroup = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update', { groupBy: value ? (value as BoqGroup) : null })
}
</script>

<template>
  <div class="controls">
    <div class="field">
      <Label id="view-label">View</Label>
      <ToggleGroupRoot
        :model-value="props.view.view"
        type="single"
        class="switch"
        aria-labelledby="view-label"
        @update:model-value="setView(String($event ?? ''))"
      >
        <ToggleGroupItem
          v-for="entry in VIEWS"
          :key="entry.value"
          :value="entry.value"
          class="switch-item"
        >
          {{ entry.label }}
        </ToggleGroupItem>
      </ToggleGroupRoot>
    </div>

    <div class="field arrange">
      <Label for="arrange-by">Arrange by</Label>
      <select
        id="arrange-by"
        :value="props.view.groupBy ?? ''"
        @change="setGroup"
      >
        <option value="">None</option>
        <option v-for="group in BOQ_GROUPS" :key="group" :value="group">
          {{ BOQ_GROUP_LABELS[group] }}
        </option>
      </select>
    </div>

    <ProjectColumnsMenu
      v-if="props.view.view === BOQ_VIEWS.BOQ"
      :view="props.view"
      @update="emit('update', { columns: $event })"
      @reset="emit('update', { columns: undefined })"
    />

    <div class="field search">
      <Label for="lines-search">Search lines</Label>
      <input id="lines-search" v-model="search" type="search" />
    </div>

    <div class="spacer" />

    <UiButton v-if="props.workingCopy" as-child>
      <NuxtLink :to="`/workshop/projects/${props.projectId}/products`">
        Add products
      </NuxtLink>
    </UiButton>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-6);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.switch {
  display: flex;
  align-items: center;
}

.switch-item {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-3) var(--space-7);
  border: var(--border-hairline) solid var(--color-control-border);
  border-radius: 0;
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: var(--leading-tight);
}

.switch-item + .switch-item {
  margin-inline-start: calc(-1 * var(--border-hairline));
}

.switch-item[data-state='on'] {
  border-color: var(--color-ink);
  background: var(--color-ink);
  color: var(--color-paper);
}

.arrange {
  inline-size: 9.375rem;
}

.search {
  inline-size: 13rem;
}

.spacer {
  flex-grow: 1;
}
</style>
