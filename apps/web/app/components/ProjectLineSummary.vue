<script setup lang="ts">
import {
  BOQ_DEFAULT_SORT,
  type BoqGroup,
  arrangeLines,
  sumAmounts,
} from '@forge-kivu/types'

import {
  type LineView,
  isUnpriced,
  isWithdrawn,
  lineName,
  lineTotalOf,
} from '../utils/lines'

const props = defineProps<{
  lines: LineView[]
  groupBy: BoqGroup | null
  budget: number | null
  currency: string
}>()

const materials = computed(() => sumAmounts(props.lines, lineTotalOf))

const groups = computed(() => {
  if (props.groupBy === null) return []
  return arrangeLines(props.lines, {
    groupBy: props.groupBy,
    sort: BOQ_DEFAULT_SORT,
  }).sort((left, right) => right.subtotal - left.subtotal)
})

const peak = computed(() => groups.value[0]?.subtotal ?? 0)

const largest = computed(() =>
  props.lines.reduce<LineView | null>(
    (best, line) =>
      best === null || lineTotalOf(line) > lineTotalOf(best) ? line : best,
    null,
  ),
)

const withdrawn = computed(() => props.lines.filter(isWithdrawn))

const unpriced = computed(() =>
  props.lines.filter((line) => !isWithdrawn(line) && isUnpriced(line)),
)

const budgetShare = computed(() => {
  const budget = props.budget
  if (budget === null || budget === 0) return null
  return materials.value / budget
})

const shareOf = (value: number) =>
  materials.value === 0 ? 0 : value / materials.value
</script>

<template>
  <div class="columns" :class="{ 'no-chart': groupBy === null }">
    <div v-if="groupBy !== null" class="chart">
      <h2>Cost by {{ BOQ_GROUP_LABELS[groupBy].toLowerCase() }}</h2>
      <ul class="chart-rows">
        <li v-for="group in groups" :key="group.key" class="chart-row">
          <span class="chart-label">{{ group.label }}</span>
          <span class="chart-track">
            <span
              class="chart-fill"
              :style="{
                inlineSize:
                  peak === 0 ? '0%' : `${(group.subtotal / peak) * 100}%`,
              }"
            />
          </span>
          <span class="num chart-value">{{
            formatAmount(group.subtotal)
          }}</span>
          <span class="muted chart-share">
            {{ formatPercent(shareOf(group.subtotal)) }}
          </span>
        </li>
      </ul>
    </div>

    <ul class="tiles">
      <li class="tile lead">
        <span class="eyebrow">Materials total</span>
        <span class="tile-value">{{ formatAmount(materials) }}</span>
        <span class="muted tile-note">
          {{ currency
          }}<template v-if="budgetShare !== null">
            · {{ formatPercent(budgetShare) }} of budget
          </template>
        </span>
      </li>
      <li v-if="largest" class="tile">
        <span class="eyebrow">Largest line</span>
        <span class="tile-line">{{ lineName(largest) }}</span>
        <span class="muted tile-note">
          {{ formatAmount(lineTotalOf(largest)) }} {{ currency }} ·
          {{ formatPercent(shareOf(lineTotalOf(largest))) }} of materials
        </span>
      </li>
      <li class="tile">
        <span class="eyebrow">Attention</span>
        <span v-if="withdrawn.length" class="status-bad tile-line">
          {{ withdrawn.length }}
          {{ withdrawn.length === 1 ? 'product' : 'products' }}
          no longer available
        </span>
        <span v-else-if="unpriced.length" class="status-warn tile-line">
          {{ unpriced.length }}
          {{ unpriced.length === 1 ? 'line' : 'lines' }} without a price
        </span>
        <span v-else class="status-ok tile-line">
          Every line is priced and available
        </span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 20rem);
  gap: var(--space-12);
  align-items: start;
}

.columns.no-chart {
  grid-template-columns: minmax(0, 1fr);
}

.no-chart .tiles {
  flex-direction: row;
  gap: var(--space-12);
}

.no-chart .tile {
  flex: 1 1 0;
}

.chart {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  min-inline-size: 0;
}

.chart-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.chart-row {
  display: flex;
  align-items: center;
  gap: var(--space-6);
}

.chart-label {
  inline-size: 6rem;
  flex: none;
  overflow: hidden;
  font-size: var(--text-xs);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-track {
  flex-grow: 1;
  block-size: var(--space-5);
  background: var(--color-canvas);
}

.chart-fill {
  display: block;
  block-size: 100%;
  background: var(--color-accent);
}

.chart-value {
  inline-size: 5.5rem;
  flex: none;
}

.chart-share {
  inline-size: 3rem;
  flex: none;
  font-size: var(--text-2xs);
  text-align: end;
}

.tiles {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.tile {
  border-block-start: var(--border-hairline) solid var(--color-rule);
  padding-block-start: var(--space-5);
}

.tile.lead {
  border-block-start: 2px solid var(--color-rule-strong);
}

.tile-value {
  display: block;
  margin-block-start: var(--space-1);
  font-size: var(--text-lg);
  font-weight: var(--weight-medium);
  font-variant-numeric: tabular-nums;
}

.tile-line {
  display: block;
  margin-block-start: var(--space-1);
  font-size: var(--text-sm);
}

.tile-note {
  font-size: var(--text-2xs);
}

.num {
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-variant-numeric: tabular-nums;
  text-align: end;
}
</style>
