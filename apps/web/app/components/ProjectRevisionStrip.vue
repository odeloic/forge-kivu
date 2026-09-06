<script setup lang="ts">
import type {
  BoqDetail,
  BoqSummary,
  ProjectDetail,
} from '@forge-kivu/api-client'
import {
  BOQ_DEFAULT_SORT,
  type BoqViewQuery,
  EXPORT_FORMATS,
  visibleColumns,
} from '@forge-kivu/types'

const props = defineProps<{
  revisions: BoqSummary[]
  selectedId: string | null
  workingCount: number
  latestBoq: ProjectDetail['latestBoq']
  boq: BoqDetail | null
  view: BoqViewQuery
  currency: string
  canGenerate: boolean
  generating: boolean
}>()

const emit = defineEmits<{
  select: [id: string | null]
  generate: []
}>()

const { exportUrl } = useBoqs()

const nextRevision = computed(() => (props.revisions[0]?.revision ?? 0) + 1)

const isLatest = (row: { id: string }) => row.id === props.revisions[0]?.id

const stale = computed(() => props.latestBoq?.stale === true)

const pick = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('select', value || null)
}

const exportView = computed<Partial<BoqViewQuery>>(() => {
  const { sort, groupBy } = props.view
  const defaultSort =
    sort.field === BOQ_DEFAULT_SORT.field &&
    sort.direction === BOQ_DEFAULT_SORT.direction
  return {
    columns: visibleColumns(props.view),
    ...(groupBy ? { groupBy } : {}),
    ...(defaultSort ? {} : { sort }),
  }
})
</script>

<template>
  <div class="strip">
    <div class="row">
      <div class="field">
        <Label for="boq-source">Showing</Label>
        <select id="boq-source" :value="selectedId ?? ''" @change="pick">
          <option value="">
            Working copy · {{ workingCount }}
            {{ workingCount === 1 ? 'line' : 'lines' }}
          </option>
          <option v-for="row in revisions" :key="row.id" :value="row.id">
            Revision {{ row.revision }} · {{ formatDate(row.createdAt)
            }}<template v-if="isLatest(row) && stale"> · Stale</template>
          </option>
        </select>
      </div>

      <template v-if="selectedId === null">
        <span v-if="stale && latestBoq" class="flag status-warn aligned">
          Changed since revision {{ latestBoq.revision }}
        </span>
        <span v-if="revisions.length === 0" class="muted hint aligned">
          No revisions yet
        </span>
        <div class="spacer" />
        <span class="muted hint aligned">Exports come from revisions</span>
        <UiButton
          variant="primary"
          :disabled="!canGenerate || generating"
          @click="emit('generate')"
        >
          {{ generating ? 'Working…' : `Generate revision ${nextRevision}` }}
        </UiButton>
      </template>
      <template v-else-if="boq">
        <div class="spacer" />
        <a
          class="export aligned"
          :href="exportUrl(boq.id, EXPORT_FORMATS.XLSX, exportView)"
        >
          Export XLSX
        </a>
        <a
          class="export aligned"
          :href="exportUrl(boq.id, EXPORT_FORMATS.CSV, exportView)"
        >
          Export CSV
        </a>
      </template>
    </div>

    <p v-if="selectedId !== null && boq" class="note banner">
      <span class="title">Revision {{ boq.revision }}</span>
      <span class="muted stamp">
        Generated {{ formatDateTime(boq.createdAt) }} · {{ boq.items.length }}
        {{ boq.items.length === 1 ? 'line' : 'lines' }} ·
        {{ formatAmount(boq.total) }} {{ currency }}
      </span>
      <span class="divider" />
      <span class="muted ellip frozen">
        Frozen at generation: names, prices, units, quantities, suppliers,
        categories, spaces, colours.
      </span>
      <span v-if="isLatest(boq) && stale" class="flag status-warn">
        Stale · changed since
      </span>
    </p>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  flex-direction: column;
  gap: var(--space-9);
}

.row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-9);
  padding-block-end: var(--space-7);
  border-block-end: var(--border-hairline) solid var(--color-rule);
}

.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  inline-size: 14.25rem;
}

.aligned {
  padding-block-end: var(--space-5);
}

.spacer {
  flex-grow: 1;
}

.flag {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-label);
  text-transform: uppercase;
}

.hint,
.export {
  font-size: var(--text-xs);
}

.banner {
  display: flex;
  align-items: center;
  gap: var(--space-7);
}

.title {
  flex: none;
  font-weight: var(--weight-medium);
}

.stamp {
  flex: none;
}

.divider {
  flex: none;
  inline-size: 1px;
  block-size: 0.875rem;
  background: var(--color-rule);
}

.frozen {
  flex: 1 1 auto;
  min-inline-size: 0;
}

.ellip {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
