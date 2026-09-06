<script setup lang="ts">
import {
  BOQ_COLUMNS,
  BOQ_LOCKED_COLUMNS,
  type BoqColumn,
  type BoqViewQuery,
  groupedColumn,
} from '@forge-kivu/types'

const props = defineProps<{ view: BoqViewQuery }>()

const emit = defineEmits<{
  update: [columns: BoqColumn[]]
  reset: []
}>()

const locked = new Set<BoqColumn>(BOQ_LOCKED_COLUMNS)

const grouped = computed(() => groupedColumn(props.view.groupBy))

const selected = computed(() => new Set(props.view.columns))

const shown = computed(
  () => props.view.columns.filter((column) => column !== grouped.value).length,
)

const toggle = (column: BoqColumn, checked: boolean) => {
  const next = new Set(selected.value)
  if (checked) next.add(column)
  else next.delete(column)
  emit(
    'update',
    BOQ_COLUMNS.filter((entry) => next.has(entry)),
  )
}
</script>

<template>
  <div class="field">
    <Label for="columns-trigger">Columns</Label>
    <PopoverRoot>
      <PopoverTrigger id="columns-trigger" class="trigger">
        <span>{{ shown }} of {{ BOQ_COLUMNS.length }}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M2 3.5 L5 6.5 L8 3.5" />
        </svg>
      </PopoverTrigger>
      <PopoverPortal>
        <PopoverContent class="menu" align="start" :side-offset="6">
          <div class="head">
            <span class="eyebrow">Columns</span>
            <span class="spacer" />
            <button type="button" class="reset" @click="emit('reset')">
              Reset
            </button>
          </div>
          <ul class="rows">
            <li
              v-for="column in BOQ_COLUMNS"
              :key="column"
              class="row"
              :class="{ locked: locked.has(column) }"
            >
              <CheckboxRoot
                :id="`column-${column}`"
                class="box"
                :model-value="selected.has(column) && column !== grouped"
                :disabled="locked.has(column) || column === grouped"
                @update:model-value="toggle(column, $event === true)"
              >
                <CheckboxIndicator class="tick">
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 9 9"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    aria-hidden="true"
                  >
                    <path d="M1.5 4.5 L3.5 6.5 L7.5 2.5" />
                  </svg>
                </CheckboxIndicator>
              </CheckboxRoot>
              <Label :for="`column-${column}`" class="name">
                {{ BOQ_COLUMN_LABELS[column] }}
              </Label>
              <span class="spacer" />
              <span v-if="column === grouped" class="eyebrow">Grouped</span>
            </li>
          </ul>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<style scoped>
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-inline-size: 0;
}

.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
  inline-size: 9.375rem;
  padding: var(--space-3) var(--space-4);
  border: var(--border-hairline) solid var(--color-field-border);
  border-radius: 0;
  background: var(--color-paper);
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
  line-height: var(--leading-normal);
  text-align: start;
}

.trigger:focus-visible {
  border-color: var(--color-accent);
  outline: var(--focus-width) solid var(--color-accent);
  outline-offset: var(--focus-offset);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  inline-size: 14.5rem;
  padding: var(--space-6) var(--space-7) var(--space-7);
  border: var(--border-hairline) solid var(--color-rule-strong);
  background: var(--color-paper);
  z-index: 10;
}

.head {
  display: flex;
  align-items: baseline;
  gap: var(--space-4);
}

.spacer {
  flex-grow: 1;
}

.reset {
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-accent);
  font-size: var(--text-2xs);
  font-weight: var(--weight-regular);
}

.reset:hover {
  text-decoration: underline;
  text-underline-offset: 0.125rem;
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.row {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  block-size: 1.375rem;
}

.box {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  inline-size: 0.8125rem;
  block-size: 0.8125rem;
  padding: 0;
  border: var(--border-hairline) solid var(--color-ink);
  border-radius: 0;
  background: var(--color-paper);
  color: var(--color-paper);
}

.box[data-state='checked'] {
  background: var(--color-ink);
}

.tick {
  display: flex;
}

.name {
  color: var(--color-ink);
  font-size: var(--text-sm);
  font-weight: var(--weight-regular);
  letter-spacing: 0;
  text-transform: none;
}

.locked .name {
  color: var(--color-faint);
}

.locked .box {
  border-color: var(--color-faint);
  background: var(--color-faint);
}
</style>
